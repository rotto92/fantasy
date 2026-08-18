#!/usr/bin/env python3

from pathlib import Path
import sys
import tempfile
import zlib


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

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

print("Generation runtime fingerprint contract passed.")
