# Concept Constellations — Interaction Design

## The design correction

Earlier visualizations treated sources, concepts, and characters as peer-level
nodes, then briefly made every character a graph point. Both approaches made
the bounded evidence corpus visually compete with the comparison vocabulary.

The public release uses one visual noun:

> Every point is a normalized concept. Characters, source-native terms,
> sources, and continuities are evidence, discovery results, or detail fields.

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

A zoomable constellation map. Large luminous marks are normalized families;
smaller marks are specific normalized concepts.

- `Arrange by`: source, being type, culture, role, power tradition,
  affiliation, transformation, narrative function, medium, or continuity.
- `Then by`: optional nested dimension.
- `Color by`: an independent dimension or evidence status.
- `Size by`: uniform by default; optional relationship degree or attribute
  richness.
- Zoomed out: concept-family names and selected coverage signal.
- Mid zoom: specific concept marks and a small readable label budget.
- Close zoom: selected, related, and nearby concept labels.

Changing the arrangement is a deliberate animated regrouping. Positions do not
pretend to have geographic meaning.

### 2. Attribute matrix — comparison

A categorical x/y grid can answer explicit evidence questions such as “which
being types occupy which roles?” without changing the concept graph.

- `X dimension` and `Y dimension` are user-selected.
- Multi-valued character evidence uses declared confidence and keeps alternate
  values visible in the evidence profile.
- Color supplies a third dimension.
- Empty cells are informative and remain visible.
- A small-multiple mode compares selected sources without drawing edges.

### 3. Relationship constellation — local only

Selecting a concept opens a bounded concept-to-concept constellation.

- The selected concept is central.
- Taxonomy neighbours and siblings come from the normalized taxonomy.
- Cross-family affinities require shared mapped concepts or explicit evidence.
- Text coincidence never creates an edge.
- Source, character, and source-term records remain evidence rather than nodes.

## Detail profile

The profile is a readable concept card, not a database dump:

1. Normalized label, family, domain, definition, and framework status.
2. Source traditions and representative characters.
3. Source-native terms with mapping distinctions.
4. Evidence-backed related concepts.
5. Comparison cautions and continuity differences.
6. Claim-level evidence with work/chapter/page/section locators.

Activating source evidence preserves its discovery explanation while opening a
supported normalized concept.

## Visual grammar

- Concept: a circular or star-shaped luminous mark.
- Selected concept: larger corona and persistent name.
- Family: a larger mark and softly bounded field around specific concepts.
- Color: one declared meaning at a time, stated in the legend.
- Evidence: small outer ring or profile badge, never the same fill channel used
  by the active color dimension.
- Relationship: line shown only in the local constellation.
- Unresearched source: coverage dashboard row, not a grey pseudo-character.

## Density rules

- No global edges.
- No more than 24 persistent concept labels in a scene.
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

1. Compile validated research into `public/data/characters.json`.
2. Compile normalized concepts and evidence-backed affinities into
   `public/data/constellations.json`.
3. Compile corpus-wide discovery into `public/data/discovery.json`.
4. Render normalized concepts as the only global and local graph nodes.
5. Keep source coverage in the Research dashboard.
6. Preserve character and source-term records as evidence and discovery detail.
