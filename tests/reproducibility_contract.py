#!/usr/bin/env python3

import json
from pathlib import Path
import shutil
import sys
import tempfile
import zipfile
import zlib


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import reproducible
from reproducible import generation_runtime_identity, source_fingerprint


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
            outputs[compression_level] = (normalized_path.read_bytes(), compressed_size)
    finally:
        reproducible.GENERATION_RUNTIME_CONTRACT_PATH = original_contract_path
    assert outputs[1][0] != outputs[9][0]
    assert outputs[9][1] < outputs[1][1]

print("Generation runtime fingerprint contract passed.")
