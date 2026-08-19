#!/usr/bin/env python3

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

from openpyxl import Workbook


ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ROOT = ROOT / "tests" / "fixtures" / "research_schema"
VALIDATOR = ROOT / "scripts" / "validate_character_research.py"


def make_workbook(path: Path) -> None:
    workbook = Workbook()
    source_sheet = workbook.active
    source_sheet.title = "Source Corpus"
    source_sheet.append(["Source_ID"])
    for source_id in ("SRC-001", "SRC-002", "SRC-003"):
        source_sheet.append([source_id])
    taxonomy_sheet = workbook.create_sheet("Master Taxonomy")
    taxonomy_sheet.append(["Archetype_ID"])
    workbook.save(path)


def set_path(record: object, path: list[object], value: object, *, delete: bool = False) -> None:
    target = record
    for part in path[:-1]:
        target = target[part]
    if delete:
        del target[path[-1]]
    else:
        target[path[-1]] = value


def stage_fixture(directory: Path) -> tuple[Path, Path, Path]:
    research_root = directory / "research"
    review_root = directory / "reviews"
    shutil.copytree(FIXTURE_ROOT / "research", research_root)
    shutil.copytree(FIXTURE_ROOT / "reviews", review_root)
    workbook_path = directory / "fixture.xlsx"
    make_workbook(workbook_path)
    return research_root, review_root / "index.json", workbook_path


def run_validator(directory: Path, research_root: Path, review_index: Path, workbook: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(VALIDATOR),
            "--workbook",
            str(workbook),
            "--research-root",
            str(research_root),
            "--review-index",
            str(review_index),
            "--output",
            str(directory / "characters.json"),
            "--report",
            str(directory / "report.json"),
        ],
        capture_output=True,
        text=True,
    )


with tempfile.TemporaryDirectory(dir=ROOT / "tests") as temporary_directory:
    directory = Path(temporary_directory)
    research_root, review_index, workbook = stage_fixture(directory)
    result = run_validator(directory, research_root, review_index, workbook)
    assert result.returncode == 0, result.stdout + result.stderr
    compiled = json.loads((directory / "characters.json").read_text(encoding="utf-8"))
    statuses = {source["completion_status"]: source["review_lanes"]["characterPass"]["label"] for source in compiled["sources"]}
    assert statuses == {
        "pass-complete": "Pass complete",
        "narrow-metadata-pass-complete": "Limited metadata pass",
        "evidence-insufficient-zero-character-audit": "Evidence insufficient",
    }

cases = json.loads((FIXTURE_ROOT / "invalid_cases.json").read_text(encoding="utf-8"))
for case in cases:
    with tempfile.TemporaryDirectory(dir=ROOT / "tests") as temporary_directory:
        directory = Path(temporary_directory)
        research_root, review_index, workbook = stage_fixture(directory)
        fixture_file = next(research_root.glob(f"batch_*/*/{case['file']}"))
        records = json.loads(fixture_file.read_text(encoding="utf-8"))
        set_path(
            records[case["record"]],
            case["path"],
            case.get("value"),
            delete=case.get("operation") == "delete",
        )
        fixture_file.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        result = run_validator(directory, research_root, review_index, workbook)
        assert result.returncode == 1, (case["id"], result.stdout, result.stderr)
        report = json.loads((directory / "report.json").read_text(encoding="utf-8"))
        assert any(case["expected"] in error for error in report["errors"]), (case["id"], report["errors"])
        assert not (directory / "characters.json").exists(), case["id"]

print(f"Research schema contract passed: 3 positive statuses and {len(cases)} invalid fixtures.")
