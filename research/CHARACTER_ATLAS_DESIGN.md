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
- [TensorFlow Embedding Projector](https://projector.tensorflow.org/): borrow
  search and selection isolation without introducing unexplained similarity
  geography.

## Five coordinated views

### 1. Constellations — default

A zoomable constellation map. Large luminous marks are normalized families;
smaller marks are specific normalized concepts. Two fixed sky fields separate
beings/peoples from classes/vocations.

- Filters narrow the sky by domain, mapped source, and evidence state.
- Detail controls reveal families only, all concepts, or concepts progressively
  as the user zooms.
- Zoomed out: concept-family names and selected coverage signal.
- Mid zoom: specific concept marks and a small readable label budget.
- Close zoom: selected, related, and nearby concept labels.

Positions organize the fixed concept hierarchy and do not pretend to have
geographic meaning.

### 2. Catalogue — readable hierarchy

The catalogue presents the same normalized families and concepts as semantic
buttons and cards instead of spatial marks.

- The visible Family, Source evidence, and Evidence controls narrow the
  catalogue; the map-only Sky control is not active here.
- Entering another view clears domain or family scope that its controls do not
  expose, so no hidden Catalogue or Constellations restriction survives a view
  transition.
- Activating a card opens the same evidence detail used by other views.
- Framework-only concepts remain visible and are labelled as mapping pending.

### 3. Compose — evidence-aware character builder

The composer combines one normalized being/people concept with one normalized
class/vocation concept and an optional user-supplied name.

- The resulting character concept is explicitly user-created, never canonical.
- Each selection shows representative, cited source inspirations where mapped.
- Framework-only choices remain available and retain their mapping-pending label.
- Source and evidence filters narrow the available composition choices without
  turning source-native terms or characters into selectable graph concepts.
- Opening evidence uses the same concept detail shared by the other views.

### 4. Relations — local only

Selecting a concept opens a bounded concept-to-concept constellation.

- The selected concept is central.
- Taxonomy neighbours and siblings come from the normalized taxonomy.
- Cross-family affinities require shared mapped concepts or explicit evidence.
- Text coincidence never creates an edge.
- Source, character, and source-term records remain evidence rather than nodes.

### 5. Research — coverage dashboard

The source table keeps scope, evidence-pass status, independent review, and
continuity review visible without adding source or status pseudo-nodes to the
sky. Corpus search and the source filter narrow its rows.

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
- Search and direct selection take priority within the label budget.
- Families only hides every specific mark after family selection; a specific
  selected directly from search remains as the sole explicit exception.
- Zoom changes the level of detail and the contents of the scene, not merely
  the font size.

## Coverage is a dashboard, not a graph

Corpus progress belongs in a separate compact matrix:

- Rows: bounded source passes.
- Columns: scoped, character pass, terminology pass, relationship pass,
  second review, and continuity review.
- Cells: Not started, In progress, Pass complete, Limited metadata pass,
  Evidence insufficient, or Reviewed.
- Search and the all-corpus Source evidence filter narrow the visible rows;
  graph views expose only mapped sources and clear a Research-only source when
  returning to the graph.

This keeps research incompleteness visible without allowing coverage rows to
dominate the concept map.

## Release implementation contract

1. Compile validated research into `public/data/characters.json`.
2. Compile normalized concepts and evidence-backed affinities into
   `public/data/constellations.json`.
3. Compile corpus-wide discovery into `public/data/discovery.json`.
4. Render normalized concepts as the only global and local graph nodes.
5. Keep source coverage in the Research dashboard.
6. Preserve character and source-term records as evidence and discovery detail.
