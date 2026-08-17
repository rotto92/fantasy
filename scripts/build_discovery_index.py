#!/usr/bin/env python3
"""Compile the bounded research corpus into a searchable discovery projection.

The constellation graph intentionally contains only normalized being/entity and
class/vocation archetypes. This projection keeps every accepted research
dimension searchable alongside those graph concepts without promoting source-
native evidence to normalized graph nodes.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
RESEARCH_PATH = ROOT / "public" / "data" / "characters.json"
CONCEPTS_PATH = ROOT / "public" / "data" / "constellations.json"
OUTPUT_PATH = ROOT / "public" / "data" / "discovery.json"

DIMENSION_LABELS = {
    "being_types": "Being / species / entity",
    "cultures": "Culture / people",
    "roles_and_vocations": "Role / class / vocation",
    "power_traditions": "Power / tradition",
    "affiliations": "Affiliation / institution",
    "states_and_transformations": "State / transformation",
    "artifacts_and_vehicles": "Artifact / vehicle",
    "cosmologies_and_realms": "Cosmology / realm",
    "metaphysical_laws_and_rituals": "Law / ritual",
    "narrative_archetypes": "Narrative archetype",
    "game_mechanics": "Game mechanic",
}

# This is deliberately narrow. "ashura" is a search spelling alias for the
# Sanskrit source-term witness only; it is not applied to Guild Wars' asura.
VARIANT_RULES = [
    {
        "id": "sanskrit-asura-ashura",
        "sourceIds": ["SRC-277"],
        "canonical": "asura",
        "aliases": ["ashura"],
        "note": "Search alias for the Sanskrit witness only; it does not merge unrelated source-native uses.",
    }
]


def fold(value: Any) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    without_marks = "".join(character for character in normalized if not unicodedata.combining(character))
    return "".join(character for character in without_marks.casefold() if character.isalnum())


def first_url(citations: list[dict[str, Any]]) -> str:
    return str(citations[0].get("url", "")) if citations else ""


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def field(label: str, value: Any) -> dict[str, str]:
    return {"label": label, "value": str(value or "")}


def source_lookup(research: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(source["sourceId"]): source for source in research["corpusSources"]}


def source_fields(source: dict[str, Any]) -> list[dict[str, str]]:
    return [
        field("source / series", source.get("title")),
        field("continuity", source.get("continuityUnit")),
        field("medium", source.get("medium")),
        field("region / tradition", source.get("region")),
        field("creator / studio", source.get("creator")),
    ]


def search_text(fields: list[dict[str, str]], aliases: list[str] | None = None) -> str:
    values = [item["value"] for item in fields]
    values.extend(aliases or [])
    return fold(" ".join(values))


def concept_ids(values: list[dict[str, Any]], valid_ids: set[str]) -> list[str]:
    return sorted(
        {
            str(archetype_id)
            for value in values
            for archetype_id in value.get("archetype_ids", [])
            if str(archetype_id) in valid_ids
        }
    )


def character_dimensions(character: dict[str, Any]) -> list[dict[str, Any]]:
    values: list[dict[str, Any]] = []
    for dimension, rows in character.get("dimensions", {}).items():
        for row in rows:
            term = str(row.get("term", "")).strip()
            if term:
                values.append({"dimension": dimension, **row})
    return values


def main() -> None:
    research = json.loads(RESEARCH_PATH.read_text(encoding="utf-8"))
    concepts = json.loads(CONCEPTS_PATH.read_text(encoding="utf-8"))
    sources = source_lookup(research)
    valid_concept_ids = {str(node["id"]) for node in concepts["nodes"]}
    characters_by_id = {str(character["character_id"]): character for character in research["characters"]}

    records: list[dict[str, Any]] = []
    dimension_groups: dict[tuple[str, str, str], dict[str, Any]] = {}
    dimension_rows_by_key: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    dimension_row_counts: Counter[str] = Counter()

    for character in research["characters"]:
        source = sources.get(str(character["source_id"]), {})
        related_ids = concept_ids(
            [value for value in character.get("dimensions", {}).values() for value in value],
            valid_concept_ids,
        )
        dimension_values = character_dimensions(character)
        fields = [
            field("character", character.get("canonical_name")),
            *[field("alias", alias) for alias in character.get("aliases", [])],
            *source_fields(source),
            field("continuity", character.get("continuity")),
            field("work / witness", character.get("work_or_witness")),
            *[
                field(DIMENSION_LABELS.get(row["dimension"], row["dimension"]), row.get("term"))
                for row in dimension_values
            ],
        ]
        records.append(
            {
                "id": f"character:{character['character_id']}",
                "kind": "character",
                "kindLabel": "Character evidence",
                "label": character["canonical_name"],
                "aliases": character.get("aliases", []),
                "sourceId": character["source_id"],
                "sourceTitle": character["source_title"],
                "dimension": "character",
                "continuity": character["continuity"],
                "work": character["work_or_witness"],
                "characterIds": [character["character_id"]],
                "characterExamples": [character["canonical_name"]],
                "relatedConceptIds": related_ids,
                "url": first_url(character.get("citations", [])),
                "searchFields": fields,
                "searchText": search_text(fields),
            }
        )

        for row in dimension_values:
            dimension = str(row["dimension"])
            term = str(row["term"])
            dimension_row_counts[dimension] += 1
            key = (dimension, fold(term), str(character["source_id"]))
            dimension_rows_by_key[key].append({"character": character, "value": row})

    for term in research["sourceTerms"]:
        canonical = str(term.get("canonical_term", "")).strip()
        if not canonical:
            continue
        term_dimension = str(term.get("dimension", ""))
        if term_dimension in DIMENSION_LABELS:
            dimension_row_counts[term_dimension] += 1
        source = sources.get(str(term["source_id"]), {})
        aliases: list[str] = []
        alias_note = ""
        for rule in VARIANT_RULES:
            if (
                term.get("source_id") in rule["sourceIds"]
                and fold(canonical) == fold(rule["canonical"])
                and fold(term.get("transliteration", "")) == fold(rule["canonical"])
                and str(term.get("original_language", "")).casefold() == "sanskrit"
            ):
                aliases = rule["aliases"]
                alias_note = rule["note"]
                break
        fields = [
            field("source-native term", canonical),
            field("transliteration", term.get("transliteration")),
            field("literal gloss", term.get("literal_gloss")),
            field(DIMENSION_LABELS.get(term.get("dimension", ""), term.get("dimension", "")), canonical),
            *source_fields(source),
            field("original language", term.get("original_language")),
            field("original script", term.get("original_script")),
        ]
        records.append(
            {
                "id": f"source-term:{term['term_id']}",
                "kind": "source-term",
                "kindLabel": "Source-native term",
                "label": canonical,
                "aliases": aliases,
                "aliasNote": alias_note,
                "sourceId": term["source_id"],
                "sourceTitle": source.get("title", term["source_id"]),
                "dimension": term.get("dimension", ""),
                "continuity": source.get("continuityUnit", "Source-native terminology record"),
                "work": term.get("original_language", ""),
                "characterIds": [],
                "characterExamples": [],
                "relatedConceptIds": [
                    str(archetype_id)
                    for archetype_id in term.get("archetype_ids", [])
                    if str(archetype_id) in valid_concept_ids
                ],
                "url": first_url(term.get("citations", [])),
                "searchFields": fields,
                "searchText": search_text(fields, aliases),
            }
        )

    for (dimension, folded_term, source_id), rows in sorted(dimension_rows_by_key.items()):
        first = rows[0]
        first_character = first["character"]
        source = sources.get(source_id, {})
        terms = [str(row["value"].get("term", "")).strip() for row in rows]
        display_term = terms[0]
        character_ids = [str(row["character"]["character_id"]) for row in rows]
        character_names = [str(row["character"]["canonical_name"]) for row in rows]
        related_ids = sorted(
            {
                str(archetype_id)
                for row in rows
                for archetype_id in row["value"].get("archetype_ids", [])
                if str(archetype_id) in valid_concept_ids
            }
        )
        fields = [
            field(DIMENSION_LABELS.get(dimension, dimension), display_term),
            *source_fields(source),
            *[field("character", name) for name in character_names],
            *[
                field("continuity", row["character"].get("continuity"))
                for row in rows
            ],
            *[
                field("work / witness", row["character"].get("work_or_witness"))
                for row in rows
            ],
        ]
        record_id = f"dimension:{dimension}:{folded_term}:{source_id}"
        records.append(
            {
                "id": record_id,
                "kind": "dimension-term",
                "kindLabel": DIMENSION_LABELS.get(dimension, dimension),
                "label": display_term,
                "aliases": unique(terms[1:]),
                "sourceId": source_id,
                "sourceTitle": first_character["source_title"],
                "dimension": dimension,
                "continuity": first_character["continuity"],
                "work": first_character["work_or_witness"],
                "characterIds": character_ids,
                "characterExamples": character_names[:6],
                "relatedConceptIds": related_ids,
                "url": first_url(first["character"].get("citations", [])),
                "searchFields": fields,
                "searchText": search_text(fields),
            }
        )
    records_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    source_concepts: dict[str, set[str]] = defaultdict(set)
    for record in records:
        source_id = str(record.get("sourceId", ""))
        if source_id:
            records_by_source[source_id].append(record)
            source_concepts[source_id].update(record.get("relatedConceptIds", []))

    for source_id, source in sources.items():
        supporting = records_by_source.get(source_id, [])
        character_ids = sorted({character_id for record in supporting for character_id in record.get("characterIds", [])})
        related_ids = sorted(source_concepts.get(source_id, set()))
        fields = source_fields(source) + [field("source id", source_id), field("first appearance", source.get("firstAppearance"))]
        records.append(
            {
                "id": f"source:{source_id}",
                "kind": "source",
                "kindLabel": "Source / series",
                "label": source["title"],
                "aliases": [],
                "sourceId": source_id,
                "sourceTitle": source["title"],
                "dimension": "source",
                "continuity": source.get("continuityUnit", ""),
                "work": "",
                "characterIds": character_ids,
                "characterExamples": [characters_by_id[character_id]["canonical_name"] for character_id in character_ids[:6]],
                "relatedConceptIds": related_ids,
                "url": source.get("referenceUrl", ""),
                "searchFields": fields,
                "searchText": search_text(fields),
            }
        )

    for node in concepts["nodes"]:
        family = next((candidate for candidate in concepts["nodes"] if candidate["id"] == node.get("familyId")), None)
        fields = [
            field("normalized concept", node.get("label")),
            field("definition", node.get("definition")),
            field("representative terms", node.get("representativeTerms")),
            field("domain", node.get("domainLabel")),
            field("family", family.get("label") if family else ""),
        ]
        records.append(
            {
                "id": f"concept:{node['id']}",
                "kind": "concept",
                "kindLabel": "Normalized graph concept",
                "label": node["label"],
                "aliases": [],
                "sourceId": "",
                "sourceTitle": "",
                "dimension": node.get("nodeKind", "concept"),
                "continuity": "Normalized framework",
                "work": "",
                "characterIds": [],
                "characterExamples": [],
                "relatedConceptIds": [node["id"]],
                "conceptId": node["id"],
                "url": "",
                "searchFields": fields,
                "searchText": search_text(fields),
            }
        )

    # Add explicit source connections only when the corpus links sources through
    # shared normalized concepts. Unmapped source-native terms stay unconnected.
    sources_by_concept: dict[str, set[str]] = defaultdict(set)
    for source_id, ids in source_concepts.items():
        for concept_id in ids:
            sources_by_concept[concept_id].add(source_id)
    connection_pairs: dict[str, Counter[str]] = defaultdict(Counter)
    shared_by_pair: dict[tuple[str, str], set[str]] = defaultdict(set)
    for concept_id, source_ids in sources_by_concept.items():
        for left in source_ids:
            for right in source_ids:
                if left < right:
                    connection_pairs[left][right] += 1
                    connection_pairs[right][left] += 1
                    shared_by_pair[(left, right)].add(concept_id)
                    shared_by_pair[(right, left)].add(concept_id)
    source_connections = {
        source_id: [
            {
                "sourceId": other_id,
                "title": sources[other_id]["title"],
                "sharedConceptIds": sorted(shared_by_pair[(source_id, other_id)]),
            }
            for other_id, _count in sorted(
                counts.items(),
                key=lambda item: (-item[1], sources[item[0]]["title"].casefold()),
            )[:16]
        ]
        for source_id, counts in connection_pairs.items()
    }

    coverage: dict[str, dict[str, Any]] = {}
    for dimension, label in DIMENSION_LABELS.items():
        # Every non-empty row is represented by a grouped dimension-term record;
        # no row is quarantined by this projection.
        missing: list[str] = []
        coverage[dimension] = {
            "label": label,
            "acceptedRows": dimension_row_counts[dimension],
            "discoverableRows": dimension_row_counts[dimension] - len(missing),
            "excludedRows": len(missing),
            "missingRows": missing,
            "exclusionRule": "No non-empty accepted dimension row is excluded; each row is grouped into a source-preserving evidence result.",
        }

    records.sort(key=lambda record: (record["kind"], fold(record["label"]), record["id"]))
    output = {
        "meta": {
            "title": "Fantasy Atlas Discovery Index",
            "version": "1.0-bounded-discovery",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "scope": {
                "kind": "bounded-accepted-research-corpus",
                "meaning": "Complete only for imported, non-quarantined research bundles accepted by validate_character_research.py.",
                "corpusSources": len(research["corpusSources"]),
                "quarantinedBundles": research["meta"].get("quarantinedBundles", []),
            },
            "counts": {
                "records": len(records),
                "concepts": sum(record["kind"] == "concept" for record in records),
                "characters": sum(record["kind"] == "character" for record in records),
                "dimensionTerms": sum(record["kind"] == "dimension-term" for record in records),
                "sourceTerms": sum(record["kind"] == "source-term" for record in records),
                "sources": sum(record["kind"] == "source" for record in records),
            },
            "coverage": coverage,
            "normalizationRules": VARIANT_RULES,
            "sourceConnections": source_connections,
        },
        "records": records,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUTPUT_PATH.relative_to(ROOT)}: {len(records)} records; "
        f"{sum(item['acceptedRows'] for item in coverage.values())} accepted dimension rows covered."
    )


if __name__ == "__main__":
    main()
