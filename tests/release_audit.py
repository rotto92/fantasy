#!/usr/bin/env python3

from pathlib import Path
import sys


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.audit_release_import import REVIEWED_OPAQUE_FILES, review_opaque, scan_text


def kinds(findings: list[dict[str, str]]) -> set[str]:
    return {item["kind"] for item in findings}


assert "machine-local-path" in kinds(scan_text(Path("fixture.txt"), "file:///tmp/private.txt"))
assert "machine-local-path" in kinds(scan_text(Path("fixture.txt"), "/home/alice/private.txt"))
assert "unreviewed-opaque-binary" in kinds(review_opaque(Path("unreviewed.png"), b"opaque"))
reviewed_path = Path(next(iter(REVIEWED_OPAQUE_FILES)))
assert "opaque-binary-hash-mismatch" in kinds(review_opaque(reviewed_path, b"changed"))

print("Release audit regression test passed.")
