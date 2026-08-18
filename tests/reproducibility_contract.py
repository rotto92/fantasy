#!/usr/bin/env python3

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile
import zlib
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import reproducible
from reproducible import generation_runtime_identity, source_fingerprint


for builder in ("build_version3.py", "build_version4.py"):
    rejected = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / builder), "--recalculate"],
        capture_output=True,
        text=True,
    )
    assert rejected.returncode == 2
    assert "unrecognized arguments: --recalculate" in rejected.stderr


with tempfile.TemporaryDirectory(dir=ROOT / "tests") as directory:
    fixture = Path(directory) / "input.json"
    fixture.write_text("{}\n", encoding="utf-8")
    compile_version = zlib.ZLIB_VERSION
    runtime_version = zlib.ZLIB_RUNTIME_VERSION
    baseline = source_fingerprint(
        [fixture],
        runtime_identity=generation_runtime_identity(
            zlib_compile_version=compile_version,
            zlib_runtime_version=runtime_version,
        ),
    )
    changed_runtime = source_fingerprint(
        [fixture],
        runtime_identity=generation_runtime_identity(
            zlib_compile_version=compile_version,
            zlib_runtime_version=f"{runtime_version}-changed",
        ),
    )
    assert changed_runtime != baseline

    source_workbook = Path(directory) / "source.xlsx"
    payload = (bytes(range(256)) * 1024) + (b"Fantasy atlas evidence record\n" * 16_384)
    with zipfile.ZipFile(source_workbook, "w", compression=zipfile.ZIP_STORED) as archive:
        archive.writestr("evidence/payload.bin", payload)
        archive.writestr(
            "docProps/core.xml",
            b'''<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Local User</dc:creator><cp:lastModifiedBy>Another User</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">2026-08-18T12:34:56Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-08-18T12:35:56Z</dcterms:modified></cp:coreProperties>''',
        )
    original_contract_path = reproducible.GENERATION_RUNTIME_CONTRACT_PATH
    outputs: dict[int, tuple[bytes, int]] = {}
    try:
        base_contract = reproducible.generation_runtime_contract()
        for compression_level in (1, 9):
            contract_path = Path(directory) / f"runtime-{compression_level}.json"
            contract = {
                **base_contract,
                "xlsxCompression": {
                    **base_contract["xlsxCompression"],
                    "level": compression_level,
                },
            }
            contract_path.write_text(json.dumps(contract), encoding="utf-8")
            normalized_path = Path(directory) / f"normalized-{compression_level}.xlsx"
            shutil.copyfile(source_workbook, normalized_path)
            reproducible.GENERATION_RUNTIME_CONTRACT_PATH = contract_path
            reproducible.normalize_xlsx(normalized_path)
            with zipfile.ZipFile(normalized_path) as archive:
                compressed_size = archive.getinfo("evidence/payload.bin").compress_size
                assert all(
                    info.create_system == reproducible.ZIP_CREATE_SYSTEM
                    and info.external_attr == reproducible.ZIP_EXTERNAL_ATTRIBUTES
                    for info in archive.infolist()
                )
                core = ElementTree.fromstring(archive.read("docProps/core.xml"))
                namespaces = reproducible.CORE_NAMESPACES
                assert core.findtext(f"{{{namespaces['dc']}}}creator") == reproducible.CORE_CREATOR
                assert core.findtext(f"{{{namespaces['cp']}}}lastModifiedBy") == reproducible.CORE_CREATOR
                assert core.findtext(f"{{{namespaces['dcterms']}}}created") == reproducible.CORE_TIMESTAMP.decode("ascii")
                assert core.findtext(f"{{{namespaces['dcterms']}}}modified") == reproducible.CORE_TIMESTAMP.decode("ascii")
            first_normalized_bytes = normalized_path.read_bytes()
            reproducible.normalize_xlsx(normalized_path)
            assert normalized_path.read_bytes() == first_normalized_bytes
            outputs[compression_level] = (normalized_path.read_bytes(), compressed_size)
    finally:
        reproducible.GENERATION_RUNTIME_CONTRACT_PATH = original_contract_path
    assert outputs[1][0] != outputs[9][0]
    assert outputs[9][1] < outputs[1][1]

print("Generation runtime fingerprint contract passed.")
