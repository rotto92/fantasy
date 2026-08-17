# Canonical Concept-Evidence Research Protocol

## Purpose

The public atlas compares fantasy through normalized concepts. A visible point
in the main visualization is a normalized being/entity or class/vocation
concept. Named characters, source-native terms, sources, and continuities are
evidence records attached to those concepts or corpus-wide discovery results;
they are not promoted to graph nodes.

This protocol governs the character and source-term evidence layer. Character
records remain the claim-level research unit, while the compiler projects their
supported normalized archetypes into the concept graph.

The existing normalized taxonomy remains a comparison vocabulary. It does not
replace a source's own terminology, and a mapping never establishes exact
equivalence by itself.

## Research unit

Each source pass produces four JSON files:

- `sources.json`: scope, continuity, witness/edition, coverage rule, and audit.
- `characters.json`: one record per canonical named character or collective
  character deliberately included by the stated coverage rule.
- `relationships.json`: typed character-to-character relationships only.
- `source_terms.json`: source-native attribute terms and their cautious
  mappings to the normalized taxonomy.

Every file must contain a JSON array. Do not edit the workbook directly during
research; integration happens only after validation.

### Source audit record

```json
{
  "source_id": "SRC-001",
  "source_title": "",
  "continuity_scope": "",
  "work_or_witnesses": [],
  "coverage_rule": "",
  "in_scope_character_count": 0,
  "completed_character_count": 0,
  "omissions": [],
  "uncertainties": [],
  "completion_status": "scoped|in-progress|pass-complete|blocked",
  "evidence_basis": "",
  "citations": [{"url": "", "locator": "", "supports": [""]}],
  "last_reviewed": "YYYY-MM-DD"
}
```

`pass-complete` means complete only against the stated witness set and coverage
rule. It never means that every regional, oral, commentarial, adaptive, or
living version of a broad tradition has been exhausted.

## Character coverage rule

"Comprehensive" does not mean every name occurring in a corpus. Each source
must declare and satisfy a reproducible inclusion rule:

- Bounded work: all protagonists, antagonists, named party/ensemble members,
  faction leaders, divine/supernatural agents who materially act in the plot,
  and additional named exemplars needed to cover a unique source-native
  attribute.
- Long franchise: the same categories for the named continuity unit under
  review; later works/editions receive separate passes.
- Mythic, folkloric, or sacred corpus: major named agents in the identified
  textual witnesses plus named figures required to represent distinct
  ontological, ritual, cosmological, or narrative categories. Regional and
  living variants remain separate rather than being flattened.
- Rules system or setting without a fixed cast: iconic named characters and
  named entities that canonically exemplify the setting, while generic options
  remain in the dimensional ontology rather than becoming invented characters.

The source audit must report in-scope count, completed count, omissions,
uncertainties, and the exact coverage rule. A source cannot be marked complete
while a declared in-scope character lacks an evidence-backed record.

## Character record

Required fields:

```json
{
  "character_id": "CHR-SRC001-001",
  "canonical_name": "",
  "aliases": [],
  "source_id": "SRC-001",
  "source_title": "",
  "continuity": "",
  "work_or_witness": "",
  "character_kind": "individual",
  "description": "",
  "dimensions": {
    "being_types": [{"term": "", "archetype_ids": [], "confidence": "high|moderate|low", "note": ""}],
    "cultures": [],
    "roles_and_vocations": [],
    "power_traditions": [],
    "affiliations": [],
    "states_and_transformations": [],
    "artifacts_and_vehicles": [],
    "cosmologies_and_realms": [],
    "metaphysical_laws_and_rituals": [],
    "narrative_archetypes": [],
    "game_mechanics": []
  },
  "canon_status": "",
  "evidence_level": "primary-text|official-reference|scholarly-reference|secondary-orientation",
  "citations": [{"url": "", "locator": "", "supports": [""]}],
  "comparison_cautions": [],
  "spoiler_level": "none|light|moderate|major",
  "review_status": "researched|needs-review|disputed"
}
```

Empty dimension arrays are acceptable. Invented precision is not.
Every populated dimension uses the same value shape shown under
`being_types`: `term`, `archetype_ids`, `confidence`, and `note`.
Collectives, manifestations that are not separately named dramatic agents,
generic units, artifacts, places, systems, and other concepts belong in
`source_terms`. A separately named and dramatically agentive avatar may be an
individual character while retaining `avatar manifestation` as an attribute.

## Relationship record

Only named characters may be endpoints:

```json
{
  "relationship_id": "REL-SRC001-001",
  "source_id": "SRC-001",
  "source_character_id": "CHR-SRC001-001",
  "target_character_id": "CHR-SRC001-002",
  "relationship_type": "kin|ally|opponent|mentor|student|ruler|subject|creator|created|patron|champion|lover|spouse|companion|member-of-party|transformed-by|other",
  "label": "",
  "direction": "directed|undirected",
  "continuity": "",
  "citations": [{"url": "", "locator": "", "supports": [""]}],
  "confidence": "high|moderate|low",
  "note": ""
}
```

Do not create source, class, race, artifact, faction, place, or archetype nodes
as relationship endpoints.

## Source term record

Source-native terminology is kept independently from character records so it
can act as a filter, grouping dimension, or explanatory legend:

```json
{
  "term_id": "STM-SRC001-001",
  "source_id": "SRC-001",
  "canonical_term": "",
  "work_or_witness": "",
  "original_language": "",
  "original_script": "",
  "transliteration": "",
  "literal_gloss": "",
  "dimension": "being_types|cultures|roles_and_vocations|power_traditions|affiliations|states_and_transformations|artifacts_and_vehicles|cosmologies_and_realms|metaphysical_laws_and_rituals|narrative_archetypes|game_mechanics",
  "archetype_ids": [],
  "mapping_relation": "exact|close|partial|functional|mechanical|visual|none",
  "definition": "",
  "cultural_caution": "",
  "citations": [{"url": "", "locator": "", "supports": [""]}],
  "review_status": "researched|needs-review|disputed"
}
```

`work_or_witness` names the claim-specific textual, edition, episode, game
version, or other bounded witness; citation `locator` values locate the claim
within that witness and do not substitute for its identity.

## Evidence rules

1. Prefer primary texts, critical editions, official rules/codices/databases,
   creator or publisher references, and peer-reviewed or museum/university
   scholarship.
2. A general home page is not evidence for a detailed claim. Include a stable
   URL and the finest practical locator: book/chapter/canto/line, page, rule
   section, quest/codex entry, episode and timestamp, or database record.
3. Wikipedia, fan wikis, unsourced listicles, and AI summaries can orient
   discovery but cannot establish a canonical record.
4. Adaptations, editions, translations, and regional traditions are separate
   continuities when their character identities or attributes materially
   differ.
5. Sacred and living traditions require explicit context cautions. Do not turn
   deities, spirits, offices, castes, rituals, or ethical concepts into generic
   game races/classes through an unqualified mapping.
6. A claim supported only indirectly is marked `needs-review`; it is never
   silently upgraded to researched.
7. Researchers must record absences and uncertainty instead of filling gaps by
   analogy.

## Integration quality gates

- Valid source and normalized-archetype IDs.
- Unique stable IDs and no character-name-only joins.
- Every character has at least one claim-specific citation.
- Every relationship has its own citation.
- No non-character relationship endpoints.
- No source marked complete without its audit and declared coverage rule.
- Canonical research and corpus-orientation data remain visibly separate.
- A second-pass reviewer samples at least 20 percent of claims and all disputed
  or culturally sensitive mappings before workbook promotion.
