# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## Project map

- Build, generation, and focused test entry points live in `package.json`; `npm run generate` owns the tracked workbooks, public data, and validation report, while `npm run check:generated` is the synchronization gate.
- Research acceptance is owned by `scripts/validate_character_research.py` and `research/dimensions.json`; discovery completeness is owned by `scripts/build_discovery_index.py` and its emitted coverage metadata.
- Publication safety has two scopes: `npm run audit:release-import` scans tracked inputs and `npm run audit:pages` scans the exact `dist/` upload tree.
- Browser architecture and interaction live in `src/main.ts`; normalized being/class concepts are graph nodes, while characters, sources, and source-native terms remain evidence records.
- Pages build, browser readiness, artifact audit, upload, and least-privilege deployment are authoritative in `.github/workflows/pages.yml`; the public base-path contract is `tests/static-base.mjs`.
- Release scope, local setup, and public behavior are documented in `README.md`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
