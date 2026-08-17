#!/usr/bin/env python3
"""Inventory and scan tracked release inputs before publication."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAX_FILE_BYTES = 50 * 1024 * 1024
EXCLUDED_PREFIXES = (
    ".git/",
    "node_modules/",
    ".venv/",
    "dist/",
    ".cache/",
    "tmp/",
    "temp/",
    "__pycache__/",
)
EXCLUDED_SUFFIXES = (".pyc", ".pyo", ".swp", ".swo", ".tmp")

PRIVATE_KEY_PATTERN = re.compile("-" * 5 + r"BEGIN [A-Z ]+ PRIVATE KEY" + "-" * 5)
TOKEN_PATTERNS = (
    ("cloud-access-key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("github-token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
)
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
LOCAL_PATH_PATTERN = re.compile(
    r"(?<![A-Za-z0-9:/_-])/(?:home|Users|tmp|var)/(?:[A-Za-z0-9._-]+/){1,}[A-Za-z0-9._-]+"
)
SENSITIVE_NAME_PATTERN = re.compile(
    r"(?:^|[._-])(credentials?|secrets?|tokens?|private|passwords?|\.env)(?:$|[._-])", re.IGNORECASE
)


def tracked_paths() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True, stdout=subprocess.PIPE
    )
    return sorted(Path(path.decode("utf-8")) for path in result.stdout.split(b"\0") if path)


def excluded(path: Path) -> bool:
    value = path.as_posix()
    return value.startswith(EXCLUDED_PREFIXES) or value.endswith(EXCLUDED_SUFFIXES)


def finding(path: Path, kind: str, detail: str) -> dict[str, str]:
    return {"path": path.as_posix(), "kind": kind, "detail": detail}


def scan_file(path: Path) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    if SENSITIVE_NAME_PATTERN.search(path.name):
        findings.append(finding(path, "suspicious-filename", "credential-like filename"))
    absolute = ROOT / path
    size = absolute.stat().st_size
    if size > MAX_FILE_BYTES:
        findings.append(finding(path, "oversized-file", f"{size} bytes exceeds {MAX_FILE_BYTES} bytes"))
        return findings
    content = absolute.read_bytes()
    if b"\0" in content:
        return findings
    text = content.decode("utf-8", errors="replace")
    if PRIVATE_KEY_PATTERN.search(text):
        findings.append(finding(path, "private-key", "private key marker"))
    for label, pattern in TOKEN_PATTERNS:
        if pattern.search(text):
            findings.append(finding(path, label, "credential token pattern"))
    if EMAIL_PATTERN.search(text):
        findings.append(finding(path, "personal-data", "email address"))
    if LOCAL_PATH_PATTERN.search(text):
        findings.append(finding(path, "machine-local-path", "absolute local filesystem path"))
    return findings


def main() -> int:
    paths = tracked_paths()
    included = [path for path in paths if not excluded(path)]
    findings = [item for path in included for item in scan_file(path)]
    findings.sort(key=lambda item: (item["path"], item["kind"], item["detail"]))
    extension_counts = Counter(path.suffix.lower() or "[no extension]" for path in included)
    sizes = sorted(
        ((path.as_posix(), (ROOT / path).stat().st_size) for path in included),
        key=lambda item: (-item[1], item[0]),
    )
    report = {
        "scope": "tracked release inputs in the current worktree",
        "maxFileBytes": MAX_FILE_BYTES,
        "excludedPrefixes": list(EXCLUDED_PREFIXES),
        "excludedSuffixes": list(EXCLUDED_SUFFIXES),
        "includedFileCount": len(included),
        "includedBytes": sum(size for _, size in sizes),
        "extensions": dict(sorted(extension_counts.items())),
        "largestFiles": [{"path": path, "bytes": size} for path, size in sizes[:20]],
        "findings": findings,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    if findings:
        print(f"Release import audit failed with {len(findings)} finding(s).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
