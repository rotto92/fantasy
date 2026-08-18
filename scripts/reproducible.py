from __future__ import annotations

import hashlib
import json
import platform
import sys
import tempfile
import unicodedata
import zipfile
import zlib
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
GENERATION_REQUIREMENTS_PATH = ROOT / "requirements-generation.txt"
GENERATION_RUNTIME_CONTRACT_PATH = ROOT / "generation-runtime.json"
CORE_TIMESTAMP = b"2000-01-01T00:00:00Z"
CORE_CREATOR = "Fantasy Atlas Generator"
CORE_NAMESPACES = {
    "cp": "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
    "dc": "http://purl.org/dc/elements/1.1/",
    "dcterms": "http://purl.org/dc/terms/",
    "xsi": "http://www.w3.org/2001/XMLSchema-instance",
}
ZIP_CREATE_SYSTEM = 0
ZIP_EXTERNAL_ATTRIBUTES = 0x20

for prefix, namespace in CORE_NAMESPACES.items():
    ElementTree.register_namespace(prefix, namespace)


def target_for_treatment(treatment: str) -> int:
    normalized = treatment.casefold()
    if "foundational" in normalized:
        return 30
    if "major" in normalized:
        return 15
    if "adaptation" in normalized:
        return 12
    if "selective" in normalized:
        return 5
    return 8


def generation_runtime_contract() -> dict[str, object]:
    return json.loads(GENERATION_RUNTIME_CONTRACT_PATH.read_text(encoding="utf-8"))


def generation_runtime_identity(
    *,
    zlib_compile_version: str | None = None,
    zlib_runtime_version: str | None = None,
) -> str:
    contract = generation_runtime_contract()
    python_version_path = ROOT / str(contract["pythonVersionFile"])
    expected_python_version = python_version_path.read_text(encoding="utf-8").strip()
    actual_python_version = platform.python_version()
    if actual_python_version != expected_python_version:
        raise RuntimeError(
            f"Generation requires Python {expected_python_version}; found {actual_python_version}"
        )
    values: dict[str, object] = {
        "pythonImplementation": platform.python_implementation(),
        "pythonVersion": actual_python_version,
        "unicodeVersion": unicodedata.unidata_version,
        "maxUnicode": sys.maxunicode,
        "zlibCompileVersion": zlib_compile_version or zlib.ZLIB_VERSION,
        "zlibRuntimeVersion": zlib_runtime_version or zlib.ZLIB_RUNTIME_VERSION,
    }
    fields = contract["fingerprintedRuntimeFields"]
    if not isinstance(fields, list) or any(field not in values for field in fields):
        raise ValueError("Generation runtime contract declares an unknown fingerprint field")
    return json.dumps(
        {str(field): values[str(field)] for field in fields},
        ensure_ascii=True,
        separators=(",", ":"),
    )


def source_fingerprint(paths: list[Path], *, runtime_identity: str | None = None) -> str:
    digest = hashlib.sha256()
    identity = runtime_identity or generation_runtime_identity()
    digest.update(b"python-runtime\0")
    digest.update(identity.encode("utf-8"))
    digest.update(b"\0")
    runtime_contract = generation_runtime_contract()
    runtime_version_path = ROOT / str(runtime_contract["pythonVersionFile"])
    resolved_paths = {
        Path(__file__).resolve(),
        GENERATION_REQUIREMENTS_PATH.resolve(),
        GENERATION_RUNTIME_CONTRACT_PATH.resolve(),
        runtime_version_path.resolve(),
    }
    for path in paths:
        resolved = path.resolve()
        if resolved.is_dir():
            resolved_paths.update(candidate.resolve() for candidate in resolved.rglob("*") if candidate.is_file())
        else:
            resolved_paths.add(resolved)
    for path in sorted(resolved_paths, key=lambda value: value.as_posix()):
        try:
            label = path.relative_to(ROOT).as_posix()
        except ValueError:
            label = path.name
        digest.update(label.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return f"sha256:{digest.hexdigest()}"


def normalize_core_properties(content: bytes) -> bytes:
    root = ElementTree.fromstring(content)
    values = {
        "dc:creator": CORE_CREATOR,
        "cp:lastModifiedBy": CORE_CREATOR,
        "dcterms:created": CORE_TIMESTAMP.decode("ascii"),
        "dcterms:modified": CORE_TIMESTAMP.decode("ascii"),
    }
    for qualified_name, value in values.items():
        prefix, local_name = qualified_name.split(":", 1)
        tag = f"{{{CORE_NAMESPACES[prefix]}}}{local_name}"
        element = root.find(tag)
        if element is None:
            element = ElementTree.SubElement(root, tag)
        element.text = value
        if prefix == "dcterms":
            element.set(
                f"{{{CORE_NAMESPACES['xsi']}}}type",
                "dcterms:W3CDTF",
            )
    return ElementTree.tostring(root, encoding="utf-8", xml_declaration=True)


def normalize_xlsx(path: Path) -> None:
    compression_contract = generation_runtime_contract()["xlsxCompression"]
    if not isinstance(compression_contract, dict):
        raise ValueError("Generation runtime contract has invalid workbook compression settings")
    compression_name = str(compression_contract["method"])
    compression = getattr(zipfile, compression_name, None)
    if not isinstance(compression, int):
        raise ValueError(f"Unsupported workbook compression method: {compression_name}")
    compression_level = int(compression_contract["level"])
    with zipfile.ZipFile(path) as archive:
        entries = [(info.filename, archive.read(info.filename)) for info in archive.infolist()]
    with tempfile.NamedTemporaryFile(dir=path.parent, suffix=".xlsx", delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with zipfile.ZipFile(temporary_path, "w", compression=compression, compresslevel=compression_level) as archive:
            for name, content in sorted(entries):
                if name == "docProps/core.xml":
                    content = normalize_core_properties(content)
                info = zipfile.ZipInfo(name, date_time=(2000, 1, 1, 0, 0, 0))
                info.compress_type = compression
                info.create_system = ZIP_CREATE_SYSTEM
                info.external_attr = ZIP_EXTERNAL_ATTRIBUTES
                archive.writestr(info, content, compresslevel=compression_level)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)
