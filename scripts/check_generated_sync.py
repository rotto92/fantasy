#!/usr/bin/env python3

from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GENERATED_PATHS = (
    "fantasy_high_fantasy_archetype_atlas_v3.xlsx",
    "fantasy_high_fantasy_archetype_atlas_v4.xlsx",
    "generated/atlas.json",
    "public/data/characters.json",
    "public/data/constellations.json",
    "public/data/discovery.json",
    "research/validation_report.json",
)


def main() -> int:
    result = subprocess.run(
        ["git", "diff", "--quiet", "--", *GENERATED_PATHS],
        cwd=ROOT,
    )
    if result.returncode:
        changed = subprocess.run(
            ["git", "diff", "--name-only", "--", *GENERATED_PATHS],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        print(f"Generated artifacts are out of sync: {changed}; run npm run generate.")
        return 1
    print("Generated artifact synchronization passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
