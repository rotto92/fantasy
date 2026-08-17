# Character Atlas — Interaction Design

## The design correction

The old visualization treated sources, domains, archetypes, source entries,
orientation phrases, and adaptations as peer-level nodes. That made an
ontological category look like the same kind of thing as a character and made
the complete corpus appear as an edge hairball.

Version 4 uses one visual noun:

> Every point is a character. Everything else is a lens, region, encoding,
> filter, relationship label, or detail field.

The workbook may remain relational, but the public visualization does not need
to expose the storage model.

## Precedents and what to borrow

- [Open Knowledge Maps](https://openknowledgemaps.org/about): show a small number of labelled topical areas first,
  then zoom into the resources contained inside them. Borrow the visual
  hierarchy and the distinction between a region and the items in it.
- [D3 zoomable circle packing](https://observablehq.com/notebook-kit/ex/d3/zoomable-pack): use containment, whitespace, and focus transitions
  to reveal hierarchy without drawing connecting lines.
- [Neo4j Bloom](https://neo4j.com/docs/bloom-user-guide/current/bloom-visual-tour/bloom-scene-interactions/): begin with a searched or selected scene, expand only chosen
  relationships, group parallel relationships, and support “dismiss others.”
  Borrow this only for the local relationship view, not for the global atlas.
- [VOSviewer](https://www.vosviewer.com/documentation/Manual_VOSviewer_1.3.1.pdf): maintain a strict label budget and update visible labels with zoom
  instead of attempting to label every point.
- [Gapminder](https://www.gapminder.org/tools/assets/guide.pdf): let the user remap visual channels to different data dimensions.
  Borrow explicit “arrange by,” “color by,” and comparison controls.
- [TensorFlow Embedding Projector](https://projector.tensorflow.org/): allow search, isolate selection, nearest
  neighbours, and saved views. Treat similarity projection as an optional
  analytical lens, never as unexplained geography.

## Three coordinated views

### 1. Atlas map — default

A zoomable circle-packed map. Large translucent regions are groups, not nodes;
small luminous marks inside them are characters.

- `Arrange by`: source, being type, culture, role, power tradition,
  affiliation, transformation, narrative function, medium, or continuity.
- `Then by`: optional nested dimension.
- `Color by`: an independent dimension or evidence status.
- `Size by`: uniform by default; optional relationship degree or attribute
  richness.
- Zoomed out: region names, character counts, and selected coverage signal.
- Mid zoom: character marks and only a small label budget.
- Close zoom: character labels and high-confidence attribute glyphs.

Changing the arrangement is a deliberate animated regrouping. Positions do not
pretend to have geographic meaning.

### 2. Attribute matrix — comparison

A categorical x/y grid for answering explicit questions such as “which being
types occupy which roles?” Characters remain the only marks.

- `X dimension` and `Y dimension` are user-selected.
- Multi-valued characters appear once using a declared primary/highest-
  confidence value; alternate values remain visible in the profile and can be
  expanded deliberately.
- Color supplies a third dimension.
- Empty cells are informative and remain visible.
- A small-multiple mode compares selected sources without drawing edges.

### 3. Relationship constellation — local only

Selecting a character opens a one-hop character-to-character constellation.

- The selected character is central.
- Neighbours are grouped by relationship family.
- Edges are typed and readable because the scene is deliberately small.
- `Expand` adds one chosen relationship type or one additional hop.
- `Isolate`, `undo`, and breadcrumbs prevent loss of context.
- Sources, races, classes, powers, artifacts, and places never become endpoints.

## Detail profile

The profile is a readable character card, not a database dump:

1. Name, aliases, source, continuity, and evidence state.
2. Source-native identity statement.
3. Dimension ribbons: being, culture, role, power, affiliation,
   transformation, artifact, cosmology, law/ritual, narrative, mechanics.
4. Relationships to other characters.
5. Comparison cautions and continuity differences.
6. Claim-level evidence with work/chapter/page/section locators.

Clicking a dimension value changes the atlas lens to that dimension and isolates
the matching characters.

## Visual grammar

- Character: a circular star mark. Shape does not change by ontology.
- Selected character: larger corona and persistent name.
- Group: softly bounded field with label and count; never selectable as though
  it were a character. Clicking its field zooms into it.
- Color: one declared meaning at a time, stated in the legend.
- Evidence: small outer ring or profile badge, never the same fill channel used
  by the active color dimension.
- Relationship: line shown only in the local constellation.
- Unresearched source: coverage dashboard row, not a grey pseudo-character.

## Density rules

- No global edges.
- No more than 24 persistent character labels in a scene.
- No more than 12 group labels at one hierarchy level without aggregation.
- Groups with fewer than three visible characters may be combined under
  `Other` unless explicitly selected.
- Search and direct selection override the label budget.
- Zoom changes the level of detail and the contents of the scene, not merely
  the font size.

## Coverage is a dashboard, not a graph

Corpus progress belongs in a separate compact matrix:

- Rows: source or source family.
- Columns: scoped, character pass, terminology pass, relationship pass,
  second review, and continuity review.
- Cells: not started, in progress, pass complete, reviewed, or disputed.
- Filters: priority, medium, region/tradition, and continuity type.

This keeps research incompleteness visible without allowing 260 uncovered
sources to dominate the character map.

## First implementation slice

1. Compile validated character research into `public/data/characters.json`.
2. Replace the global Sigma graph with a D3 circle-packed atlas map.
3. Add arrange/color lenses and semantic labels.
4. Add the local character-only relationship constellation.
5. Add the source-coverage matrix.
6. Add the x/y attribute matrix after the foundational interaction model is
   stable.
