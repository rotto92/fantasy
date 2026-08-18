from __future__ import annotations

import hashlib
import re
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GENERATION_REQUIREMENTS_PATH = ROOT / "requirements-generation.txt"
CORE_TIMESTAMP = b"2000-01-01T00:00:00Z"


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


def source_fingerprint(paths: list[Path]) -> str:
    digest = hashlib.sha256()
    resolved_paths = {Path(__file__).resolve(), GENERATION_REQUIREMENTS_PATH.resolve()}
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


def normalize_xlsx(path: Path) -> None:
    with zipfile.ZipFile(path) as archive:
        entries = [(info.filename, archive.read(info.filename)) for info in archive.infolist()]
    with tempfile.NamedTemporaryFile(dir=path.parent, suffix=".xlsx", delete=False) as temporary:
        temporary_path = Path(temporary.name)
    try:
        with zipfile.ZipFile(temporary_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, content in sorted(entries):
                if name == "docProps/core.xml":
                    content = re.sub(
                        rb"(<dcterms:(?:created|modified)[^>]*>)[^<]*(</dcterms:(?:created|modified)>)",
                        rb"\g<1>" + CORE_TIMESTAMP + rb"\g<2>",
                        content,
                    )
                info = zipfile.ZipInfo(name, date_time=(2000, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o600 << 16
                archive.writestr(info, content)
        temporary_path.replace(path)
    finally:
        temporary_path.unlink(missing_ok=True)
