#!/usr/bin/env python3

from pathlib import Path
import json
import subprocess
import sys
import tempfile


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.audit_release_import import (
    APPROVED_PUBLIC_PATH_REFERENCES,
    REVIEWED_OPAQUE_FILES,
    review_opaque,
    scan_text,
)


def kinds(findings: list[dict[str, str]]) -> set[str]:
    return {item["kind"] for item in findings}


backslash = chr(92)
assert "machine-local-path" in kinds(scan_text(Path("fixture.txt"), "file:///" + "tmp/private.txt"))
assert "machine-local-path" in kinds(scan_text(Path("fixture.txt"), "/" + "home/alice/private.txt"))
assert "machine-local-path" in kinds(scan_text(Path("fixture.txt"), "C:" + backslash + "Users" + backslash + "alice" + backslash + "private.txt"))
assert "machine-local-path" in kinds(scan_text(Path("fixture.txt"), backslash * 2 + "fileserver" + backslash + "private-share" + backslash + "notes.txt"))
slash = chr(47)
unix_local_paths = [
    slash + "root/.ssh/id_ed25519",
    slash + "etc/private-service.conf",
    slash + "opt/private/config.json",
    slash + "mnt/backup/private.txt",
    "file:" + slash * 3 + "root/.ssh/id_ed25519",
]
assert all("machine-local-path" in kinds(scan_text(Path("fixture.txt"), value)) for value in unix_local_paths)
APPROVED_PUBLIC_PATH_REFERENCES["fixture.txt"] = frozenset({unix_local_paths[2]})
assert "machine-local-path" not in kinds(scan_text(Path("fixture.txt"), unix_local_paths[2]))
APPROVED_PUBLIC_PATH_REFERENCES.pop("fixture.txt")
assert "unreviewed-opaque-binary" in kinds(review_opaque(Path("unreviewed.png"), b"opaque"))
reviewed_path = Path(next(iter(REVIEWED_OPAQUE_FILES)))
assert "opaque-binary-hash-mismatch" in kinds(review_opaque(reviewed_path, b"changed"))

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(dir=root / "tests") as directory:
    artifact = Path(directory)
    relative = artifact.relative_to(root)
    (artifact / "index.html").write_text("<h1>Published artifact</h1>", encoding="utf-8")
    clean = subprocess.run(
        [sys.executable, "scripts/audit_release_import.py", "--artifact-root", relative.as_posix()],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    assert clean.returncode == 0, clean.stdout + clean.stderr
    assert json.loads(clean.stdout)["scope"] == f"published artifact tree: {relative.as_posix()}"
    (artifact / "paths.txt").write_text(
        "D:" + backslash + "private" + backslash + "release.txt\n"
        + backslash * 2 + "server" + backslash + "share" + backslash + "release.txt\n"
        + slash + "root" + slash + ".ssh" + slash + "id_ed25519\n"
        + "file:" + slash * 3 + "etc" + slash + "private-service.conf",
        encoding="utf-8",
    )
    paths = subprocess.run(
        [sys.executable, "scripts/audit_release_import.py", "--artifact-root", relative.as_posix()],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    assert paths.returncode == 1
    assert any(item["kind"] == "machine-local-path" for item in json.loads(paths.stdout)["findings"])
    (artifact / "paths.txt").unlink()
    token = "gh" + "p_" + "a" * 24
    (artifact / "bundle.js").write_text(f'const leaked = "{token}";', encoding="utf-8")
    rejected = subprocess.run(
        [sys.executable, "scripts/audit_release_import.py", "--artifact-root", relative.as_posix()],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    assert rejected.returncode == 1
    assert any(item["kind"] == "github-token" for item in json.loads(rejected.stdout)["findings"])
    secret_values = {
        "github-fine-grained.txt": "github" + "_pat_" + "a" * 32,
        "openai.txt": "sk" + "-proj-" + "b" * 32,
        "anthropic.txt": "sk" + "-ant-api03-" + "c" * 32,
        "google.txt": "AIza" + "d" * 35,
        "basic.txt": "Authorization" + ": " + "Basic " + "d" * 24,
        "ssn.txt": "123" + "-45-" + "6789",
        "npm.txt": "npm" + "_" + "a" * 36,
        "stripe.txt": "sk" + "_live_" + "b" * 24,
        "gitlab.txt": "glpat" + "-" + "c" * 24,
        "bearer.txt": "Authorization" + ": " + "Bearer " + "d" * 32,
        "jwt.txt": "ey" + "JhbGciOiJIUzI1NiJ9" + "." + "ey" + "JzdWIiOiIxMjM0NTY3ODkwIn0" + "." + "signaturevalue123456",
        "private-key.txt": "-" * 5 + "BEGIN PGP PRIVATE KEY BLOCK" + "-" * 5,
        "url.txt": "https://" + "service:" + "password123" + "@example.invalid/private",
    }
    for filename, value in secret_values.items():
        (artifact / filename).write_text(value, encoding="utf-8")
    credentials = subprocess.run(
        [sys.executable, "scripts/audit_release_import.py", "--artifact-root", relative.as_posix()],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    assert credentials.returncode == 1
    credential_kinds = kinds(json.loads(credentials.stdout)["findings"])
    assert {
        "github-token",
        "openai-token",
        "anthropic-token",
        "google-api-key",
        "basic-auth",
        "social-security-number",
        "npm-token",
        "stripe-live-secret",
        "gitlab-token",
        "bearer-token",
        "jwt-token",
        "private-key",
        "credential-url",
    } <= credential_kinds
    (artifact / "linked.html").symlink_to("index.html")
    linked = subprocess.run(
        [sys.executable, "scripts/audit_release_import.py", "--artifact-root", relative.as_posix()],
        cwd=root,
        check=False,
        capture_output=True,
        text=True,
    )
    assert linked.returncode == 1
    assert any(
        item["path"].endswith("linked.html") and item["kind"] == "published-symlink"
        for item in json.loads(linked.stdout)["findings"]
    )

tracked = subprocess.run(
    [sys.executable, "scripts/audit_release_import.py"],
    cwd=root,
    check=False,
    capture_output=True,
    text=True,
)
assert tracked.returncode == 0, tracked.stdout + tracked.stderr

print("Release audit regression test passed.")
