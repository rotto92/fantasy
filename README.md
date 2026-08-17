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

The promoted public corpus currently contains 281 bounded source passes, 1,568
characters, 1,252 character relationships, 1,879 source-native terms, 482
normalized graph concepts, and 7,619 discovery records. The retained research
bundles contain 1,573 characters, 1,258 relationships, and 1,881 terms; 13
disputed or dependent records remain quarantined, and unreviewed sensitive
normalized mappings are withheld claim by claim without removing their source
evidence. These numbers are a release boundary, not a claim to cover all
fantasy, every edition, every adaptation, or every regional tradition.

`asura` demonstrates the evidence boundary: Guild Wars evidence for Ankka and
the Sanskrit Mahābhārata source-term witness remain separate results. The
`ashura` search alias is explicitly limited to that Sanskrit witness; unrelated
source-native uses are not merged.

The original discovery defect was a graph-boundary defect, not a missing graph
node: mapped normalized concepts were searchable through the constellation
records, while Ankka's accepted source-native `asura` evidence and the SRC-277
Sanskrit `asura` term had no concept ID. The smallest safe counterfactual was to
project every accepted research record into the corpus index, preserving source
identity and leaving unmapped evidence out of the graph. The same boundary
applies to other unmapped source-native characters and terms, including the
Unicode-sensitive `Kreiß` record. Browser regressions compare a mapped concept
with `asura`, scoped `ashura`, `Kreiß`, and punctuation-tolerant Ankka searches;
they also verify that the scoped alias does not reach Rāmāyaṇa's Paraśurāma.

## Local setup

```bash
python -m venv .venv
.venv/bin/pip install -r requirements-generation.txt
npm install
npm run browser:install
npm run dev
```

Open the local Vite URL. Press `/` to focus search. On touch-sized layouts,
the bottom view switcher, map zoom controls, and detail drawer remain usable
without hover. The browser contracts use the pinned Playwright 1.62.1 Chromium
build; set `CHROMIUM_PATH` only when intentionally using another executable.

## Generate, build, and test

```bash
npm run build
npm run check:generated
npm run test:smoke
npm run test:discovery
VITE_BASE=/fantasy/ npm run build
npm run test:static
```

`npm run build` regenerates the Version 3 workbook, extracts the normalized
atlas, validates all non-quarantined research bundles, compiles the concept
constellations, builds the corpus-wide discovery index, regenerates the Version
4 workbook, type-checks the app, and writes the Vite bundle to `dist/`.
`npm run generate` runs only the tracked generation chain. Generated metadata
uses source fingerprints rather than wall-clock timestamps, workbook archives
use stable metadata, and CI runs `npm run check:generated` after generation so
an unchanged checkout must reproduce every tracked workbook, public payload,
and validation report exactly.

The dimension registry (`research/dimensions.json`) is the shared validator,
compiler, and UI naming contract. The discovery compiler
(`scripts/build_discovery_index.py`) is the completeness
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

Before publication, `npm run audit:release-import` inventories all
tracked release inputs and scans them for credential-like filenames, private key
markers, high-signal tokens, email addresses, accidental absolute local paths,
local `file://` URLs, files larger than 50 MiB, and matching text inside retained
binary archives. Opaque files fail closed unless their visually reviewed bytes
match the explicit SHA-256 allowlist in the audit script; any changed or new
opaque artifact requires another publication review.
After Vite builds, `npm run audit:pages` independently scans every file beneath
the exact `dist/` directory uploaded to Pages, including untracked generated
assets.
Reproducible outputs and machine-local folders
(`node_modules/`, `.venv/`, `dist/`, caches, temporary folders, and bytecode)
are explicit exclusions. A finding fails the release workflow; it is not
silently published or counted as accepted research.
The Pages browser smoke step writes only the ephemeral runner log
`$RUNNER_TEMP/fantasy-vite.log`; it is outside tracked release inputs and is
never published.

## GitHub Pages

`.github/workflows/pages.yml` builds from `main`, provisions pinned Chromium for
the browser/data/static contracts, uploads `dist/`, and deploys it with the
least permissions needed by GitHub Pages. The Vite base is `/fantasy/` in
Actions and `/` for local development; `VITE_BASE` can override it for a local
Pages-style build.

## Main files

- `src/main.ts` — constellation, catalogue, relation, research, discovery search, and evidence detail behavior.
- `src/style.css` — responsive night-sky visual system, readable typography, focus states, touch layout, and reduced motion.
- `scripts/build_discovery_index.py` — corpus-wide discovery projection and machine-checked coverage metadata.
- `research/dimensions.json` — authoritative structured-dimension names and presentation labels.
- `scripts/audit_release_import.py` — deterministic pre-publication inventory and sensitive-content scan.
- `scripts/validate_character_research.py` — research bundle validation and accepted-corpus compiler.
- `tests/smoke.mjs` — graph, relations, catalogue, research, and mobile browser contract.
- `tests/discovery.mjs` — mapped/source-native diagnosis, `asura`/`ashura`, Unicode and punctuation-tolerant search, coverage, and result evidence regression contract.
- `tests/static-base.mjs` — Pages asset/data base-path contract.
