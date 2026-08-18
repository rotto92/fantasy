#!/usr/bin/env python3

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile
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
    runtime_contract = reproducible.generation_runtime_contract()
    assert runtime_contract["fingerprintedRuntimeFields"] == [
        "pythonImplementation",
        "pythonVersion",
        "unicodeVersion",
        "maxUnicode",
    ]
    assert runtime_contract["xlsxCompression"] == {"method": "ZIP_STORED"}
    runtime_identity = generation_runtime_identity()
    baseline = source_fingerprint([fixture], runtime_identity=runtime_identity)
    changed_runtime = source_fingerprint(
        [fixture],
        runtime_identity=f"{runtime_identity}-changed",
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
    try:
        base_contract = reproducible.generation_runtime_contract()
        normalized_path = Path(directory) / "normalized.xlsx"
        shutil.copyfile(source_workbook, normalized_path)
        reproducible.normalize_xlsx(normalized_path)
        with zipfile.ZipFile(normalized_path) as archive:
            assert all(
                info.compress_type == zipfile.ZIP_STORED
                and info.compress_size == info.file_size
                and info.create_system == reproducible.ZIP_CREATE_SYSTEM
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

        rejected_contract_path = Path(directory) / "runtime-compressed.json"
        rejected_contract_path.write_text(
            json.dumps(
                {
                    **base_contract,
                    "xlsxCompression": {"method": "ZIP_DEFLATED"},
                }
            ),
            encoding="utf-8",
        )
        reproducible.GENERATION_RUNTIME_CONTRACT_PATH = rejected_contract_path
        rejected_path = Path(directory) / "rejected.xlsx"
        shutil.copyfile(source_workbook, rejected_path)
        try:
            reproducible.normalize_xlsx(rejected_path)
        except ValueError as error:
            assert "platform-independent ZIP_STORED" in str(error)
        else:
            raise AssertionError("Host-dependent XLSX compression was accepted")
    finally:
        reproducible.GENERATION_RUNTIME_CONTRACT_PATH = original_contract_path

print("Generation runtime fingerprint contract passed.")
