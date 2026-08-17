#!/usr/bin/env python3
"""Inventory and scan tracked release inputs before publication."""

from __future__ import annotations

import argparse
import json
import hashlib
import re
import subprocess
import sys
import zipfile
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

PRIVATE_KEY_PATTERN = re.compile("-" * 5 + r"BEGIN (?:[A-Z ]+ PRIVATE KEY|PGP PRIVATE KEY BLOCK)" + "-" * 5)
TOKEN_PATTERNS = (
    ("cloud-access-key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("github-token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b")),
    ("github-token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}\b")),
    ("openai-token", re.compile(r"\bsk-(?:proj-|svcacct-)[A-Za-z0-9_-]{20,}\b")),
    ("openai-token", re.compile(r"\bsk-[A-Za-z0-9]{32,}\b")),
    ("anthropic-token", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b")),
    ("google-api-key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("gitlab-token", re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}\b")),
    ("npm-token", re.compile(r"\bnpm_[A-Za-z0-9]{36}\b")),
    ("stripe-live-secret", re.compile(r"\bsk_live_[A-Za-z0-9]{16,}\b")),
    ("slack-token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b")),
    ("jwt-token", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")),
)
BEARER_TOKEN_PATTERN = re.compile(
    r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]{24,}"
)
BASIC_AUTH_PATTERN = re.compile(
    r"(?i)\bauthorization\s*:\s*basic\s+[A-Za-z0-9+/]{16,}={0,2}(?![A-Za-z0-9+/=])"
)
SOCIAL_SECURITY_NUMBER_PATTERN = re.compile(
    r"(?<!\d)(?!000|666|9\d{2})\d{3}[- ](?!00)\d{2}[- ](?!0000)\d{4}(?!\d)"
)
CREDENTIAL_URL_PATTERN = re.compile(
    r"\b(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqps?)://[^\s:/?#]+:[^@\s/?#]{4,}@[^\s/]+",
    re.IGNORECASE,
)
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
LOCAL_PATH_PATTERN = re.compile(
    r"(?<![A-Za-z0-9:/_-])/(?:home|Users|tmp|var)/(?:[A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+"
)
LOCAL_FILE_URL_PATTERN = re.compile(
    r"\bfile:///(?:home|Users|tmp|var)/(?:[A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+", re.IGNORECASE
)
SENSITIVE_NAME_PATTERN = re.compile(
    r"(?:^|[._-])(credentials?|secrets?|tokens?|private|passwords?|\.env)(?:$|[._-])", re.IGNORECASE
)
REVIEWED_OPAQUE_FILES = {
    "atlas-preview.png": "db6b98da5539d84858365ff56a39733b026e93113a2cb0dd5899c35d5f238b67",
    "atlas-v4-17sources.png": "59aefdf651b51e470cedbf1209435b97d5b21c422408f91f444d5c786412568f",
    "atlas-v4-aggregated.png": "4f767c294903bb026d1627de6220765be48a4da8f89d9fb73fee66982c57f3f2",
    "atlas-v4-clean.png": "91754e330e6b98589830d50661c577f3d51240fd2e45c4e2e4b3ad1177a4992e",
    "atlas-v4-detail.png": "690645e12ab2d09de69c125dbec15d9e3cd43fe5ab18804ac3c1f3e0a07819ef",
    "atlas-v4-final-atlas.png": "9bc4687a31ecd245973f8ed1e7478a090fb520c908f2dca2c1ec0805cbd108bc",
    "atlas-v4-final-compare.png": "7d3eba9fcfbd842421175ebac7c49fa8d9290d4598f7f4ddfba3cc68f6fa442d",
    "atlas-v4-final-mobile-atlas.png": "3050f51bc0ef3db75e9fc774a142a352a96d03dfbb44eec88dd2bb121a8410af",
    "atlas-v4-final-mobile-research.png": "fb05efaa625467dcd86e60dfc15fac2a0caeaaded2721efc4015a0c03d2cb540",
    "atlas-v4-final-research.png": "fa142669ec79b65670709517ceb75a5cf870c5e141602b69785439852477c4d9",
    "atlas-v4-matrix.png": "0e37651ac1d20d3655628d07094833dc4936884ee0f8aa8a57ad00d7e7a4a14d",
    "atlas-v4-preview.png": "6bca8e4d6e943294e812dfa7cab427262948bce5eea67be8ee6de114280f83d6",
    "atlas-v4-relations.png": "c337ac569a69c4b83464aee4396efe73a15ab14e8dd8d883c1c6924a2ad39dff",
    "atlas-v4-research.png": "8a0519e33c541b575e3cfd3261996a162f88b92753b43c494c564bd202040398",
}
REVIEWED_SYMLINKS = {"CLAUDE.md": "AGENTS.md"}


def tracked_paths() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True, stdout=subprocess.PIPE
    )
    return sorted(Path(path.decode("utf-8")) for path in result.stdout.split(b"\0") if path)


def artifact_paths(directory: Path) -> list[Path]:
    absolute = (ROOT / directory).resolve()
    if absolute != ROOT and ROOT not in absolute.parents:
        raise ValueError(f"artifact root escapes the worktree: {directory}")
    if not absolute.is_dir():
        raise ValueError(f"artifact root is not a directory: {directory}")
    return sorted(path.relative_to(ROOT) for path in absolute.rglob("*") if path.is_file() or path.is_symlink())


def excluded(path: Path) -> bool:
    value = path.as_posix()
    return value.startswith(EXCLUDED_PREFIXES) or value.endswith(EXCLUDED_SUFFIXES)


def finding(path: Path, kind: str, detail: str) -> dict[str, str]:
    return {"path": path.as_posix(), "kind": kind, "detail": detail}


def decode_text(content: bytes) -> str | None:
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        return None
    return None if "\0" in text else text


def scan_text(path: Path, text: str) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    if PRIVATE_KEY_PATTERN.search(text):
        findings.append(finding(path, "private-key", "private key marker"))
    for label, pattern in TOKEN_PATTERNS:
        if pattern.search(text):
            findings.append(finding(path, label, "credential token pattern"))
    if BEARER_TOKEN_PATTERN.search(text):
        findings.append(finding(path, "bearer-token", "authorization bearer credential"))
    if BASIC_AUTH_PATTERN.search(text):
        findings.append(finding(path, "basic-auth", "authorization basic credential"))
    if CREDENTIAL_URL_PATTERN.search(text):
        findings.append(finding(path, "credential-url", "credential-bearing URL"))
    if EMAIL_PATTERN.search(text):
        findings.append(finding(path, "personal-data", "email address"))
    if SOCIAL_SECURITY_NUMBER_PATTERN.search(text):
        findings.append(finding(path, "social-security-number", "US Social Security number"))
    if LOCAL_PATH_PATTERN.search(text) or LOCAL_FILE_URL_PATTERN.search(text):
        findings.append(finding(path, "machine-local-path", "absolute local filesystem path"))
    return findings


def review_opaque(path: Path, content: bytes) -> list[dict[str, str]]:
    expected = REVIEWED_OPAQUE_FILES.get(path.as_posix())
    digest = hashlib.sha256(content).hexdigest()
    if expected is None:
        return [finding(path, "unreviewed-opaque-binary", f"opaque binary requires reviewed SHA-256 allowlist entry ({digest})")]
    if digest != expected:
        return [finding(path, "opaque-binary-hash-mismatch", f"expected {expected}, found {digest}")]
    return []


def scan_file(path: Path) -> list[dict[str, str]]:
    findings: list[dict[str, str]] = []
    if SENSITIVE_NAME_PATTERN.search(path.name):
        findings.append(finding(path, "suspicious-filename", "credential-like filename"))
    absolute = ROOT / path
    if absolute.is_symlink():
        target = absolute.readlink().as_posix()
        if REVIEWED_SYMLINKS.get(path.as_posix()) != target:
            return findings + [finding(path, "published-symlink", f"symlink target {target} is not approved")]
        try:
            resolved = absolute.resolve(strict=True)
        except (OSError, RuntimeError) as error:
            return findings + [finding(path, "published-symlink", f"approved symlink is invalid: {error}")]
        if resolved == ROOT or ROOT not in resolved.parents or not resolved.is_file():
            return findings + [finding(path, "published-symlink", f"approved symlink target {target} is not an in-worktree file")]
        absolute = resolved
    size = absolute.stat().st_size
    if size > MAX_FILE_BYTES:
        findings.append(finding(path, "oversized-file", f"{size} bytes exceeds {MAX_FILE_BYTES} bytes"))
        return findings
    content = absolute.read_bytes()
    if zipfile.is_zipfile(absolute):
        with zipfile.ZipFile(absolute) as archive:
            for member in archive.infolist():
                if member.is_dir():
                    continue
                member_path = Path(f"{path.as_posix()}::{member.filename}")
                if SENSITIVE_NAME_PATTERN.search(Path(member.filename).name):
                    findings.append(finding(member_path, "suspicious-filename", "credential-like archive member filename"))
                if member.file_size > MAX_FILE_BYTES:
                    findings.append(
                        finding(
                            member_path,
                            "oversized-archive-member",
                            f"{member.filename} is {member.file_size} bytes and exceeds {MAX_FILE_BYTES} bytes",
                        )
                    )
                    continue
                member_content = archive.read(member)
                member_text = decode_text(member_content)
                findings.extend(scan_text(member_path, member_text) if member_text is not None else review_opaque(member_path, member_content))
        return findings
    text = decode_text(content)
    findings.extend(scan_text(path, text) if text is not None else review_opaque(path, content))
    return findings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-root", type=Path)
    args = parser.parse_args()
    try:
        if args.artifact_root:
            included = artifact_paths(args.artifact_root)
            scope = f"published artifact tree: {args.artifact_root.as_posix()}"
        else:
            included = [path for path in tracked_paths() if not excluded(path)]
            scope = "tracked release inputs in the current worktree"
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 2
    findings = [item for path in included for item in scan_file(path)]
    findings.sort(key=lambda item: (item["path"], item["kind"], item["detail"]))
    extension_counts = Counter(path.suffix.lower() or "[no extension]" for path in included)
    sizes = sorted(
        ((path.as_posix(), (ROOT / path).lstat().st_size) for path in included),
        key=lambda item: (-item[1], item[0]),
    )
    report = {
        "scope": scope,
        "maxFileBytes": MAX_FILE_BYTES,
        "excludedPrefixes": list(EXCLUDED_PREFIXES),
        "excludedSuffixes": list(EXCLUDED_SUFFIXES),
        "reviewedOpaqueFiles": [
            {"path": path, "sha256": digest} for path, digest in sorted(REVIEWED_OPAQUE_FILES.items())
        ],
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
