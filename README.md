# Fantasy Concept Constellations

Fantasy Concept Constellations is a source-grounded explorer of reusable fantasy
concepts, source-native terminology, characters, and series connections. The
night-sky graph keeps normalized beings/entities and classes/vocations as its
primary nodes; the searchable discovery layer covers the entire accepted
research corpus without turning every source record into a star.

Public site: <https://rotto92.github.io/fantasy/>

## Explore

Search works from every view and accepts case-insensitive, accent-, spacing-,
and punctuation-tolerant input. Results explain which indexed field matched and
show the source/series, continuity, work or witness, character examples,
normalized concept links, and citations where available.

The accepted corpus currently contains 281 bounded source passes, 1,573
characters, 1,258 character relationships, 1,881 source-native terms, 482
normalized graph concepts, and 7,637 discovery records. These numbers are a
release boundary, not a claim to cover all fantasy, every edition, every
adaptation, or every regional tradition.

`asura` demonstrates the evidence boundary: Guild Wars evidence for Ankka and
the Sanskrit Mahābhārata source-term witness remain separate results. The
`ashura` search alias is explicitly limited to that Sanskrit witness; unrelated
source-native uses are not merged.

## Local setup

```bash
python -m venv .venv
.venv/bin/pip install openpyxl
npm install
npm run dev
```

Open the local Vite URL. Press `/` to focus search. On touch-sized layouts,
the bottom view switcher, map zoom controls, and detail drawer remain usable
without hover.

## Generate, build, and test

```bash
npm run build
npm run test:smoke
npm run test:discovery
VITE_BASE=/fantasy/ npm run build
npm run test:static
```

`npm run build` regenerates the Version 3 workbook, extracts the normalized
atlas, validates all non-quarantined research bundles, compiles the concept
constellations, builds the corpus-wide discovery index, regenerates the Version
4 workbook, type-checks the app, and writes the Vite bundle to `dist/`.

The discovery compiler (`scripts/build_discovery_index.py`) is the completeness
contract. It indexes normalized labels, character names and aliases, every
structured research dimension, source-native terms, source/series titles,
continuity units, and work/witness identifiers. Its generated metadata reports
accepted, discoverable, excluded, and missing rows for each dimension. Being and
role/vocation rows currently have zero exclusions. The index records the
quarantined bundle boundary from `characters.json`; quarantined research is not
silently treated as accepted corpus coverage.

Generated public data:

- `public/data/constellations.json` — normalized concept graph and evidence-backed affinities.
- `public/data/characters.json` — validated character, relationship, term, source, and citation evidence.
- `public/data/discovery.json` — deterministic search projection and coverage report.

The source tree under `research/` is the authoritative research bundle. The
compiler keeps source/continuity identity in every evidence result and derives
cross-series connections only from shared normalized concept IDs.

## GitHub Pages

`.github/workflows/pages.yml` builds from `main`, runs the browser/data/static
contracts, uploads `dist/`, and deploys it with the least permissions needed by
GitHub Pages. The Vite base is `/fantasy/` in Actions and `/` for local
development; `VITE_BASE` can override it for a local Pages-style build.

## Main files

- `src/main.ts` — constellation, catalogue, relation, research, discovery search, and evidence detail behavior.
- `src/style.css` — responsive night-sky visual system, readable typography, focus states, touch layout, and reduced motion.
- `scripts/build_discovery_index.py` — corpus-wide discovery projection and machine-checked coverage metadata.
- `scripts/validate_character_research.py` — research bundle validation and accepted-corpus compiler.
- `tests/smoke.mjs` — graph, relations, catalogue, research, and mobile browser contract.
- `tests/discovery.mjs` — `asura`/`ashura`, punctuation-tolerant search, coverage, and result evidence regression contract.
- `tests/static-base.mjs` — Pages asset/data base-path contract.
