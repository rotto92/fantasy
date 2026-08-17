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
import sys
import unicodedata
from collections import Counter, defaultdict
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


def casefold_replacements() -> dict[str, str]:
    replacements: dict[str, str] = {}
    for codepoint in range(sys.maxunicode + 1):
        character = chr(codepoint)
        normalized = "".join(
            value for value in unicodedata.normalize("NFKD", character) if not unicodedata.combining(value)
        )
        lowered = normalized.lower()
        folded = normalized.casefold()
        if len(lowered) == 1 and lowered != folded:
            replacements[lowered] = folded
    return dict(sorted(replacements.items()))


FOLDING_REPLACEMENTS = casefold_replacements()


def fold(value: Any) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    without_marks = "".join(character for character in normalized if not unicodedata.combining(character))
    return "".join(character for character in without_marks.casefold() if character.isalnum())


def fold_tokens(value: Any) -> list[str]:
    return unique([fold(token) for token in re.findall(r"[\w]+", str(value or ""), flags=re.UNICODE)])


def first_url(citations: list[dict[str, Any]]) -> str:
    return str(citations[0].get("url", "")) if citations else ""


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def field(label: str, value: Any) -> dict[str, Any]:
    text = str(value or "")
    return {"label": label, "value": text, "foldedValue": fold(text), "foldedTokens": fold_tokens(text)}


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
    dimension_rows_by_key: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    dimension_row_keys: dict[str, set[str]] = defaultdict(set)

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

        for row_index, row in enumerate(dimension_values):
            dimension = str(row["dimension"])
            term = str(row["term"])
            coverage_key = f"character:{character['character_id']}:{dimension}:{row_index}"
            dimension_row_keys[dimension].add(coverage_key)
            key = (dimension, fold(term), str(character["source_id"]))
            dimension_rows_by_key[key].append({"character": character, "value": row, "coverageKey": coverage_key})

    for term in research["sourceTerms"]:
        canonical = str(term.get("canonical_term", "")).strip()
        if not canonical:
            continue
        term_dimension = str(term.get("dimension", ""))
        if term_dimension in DIMENSION_LABELS:
            dimension_row_keys[term_dimension].add(f"source-term:{term['term_id']}")
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
            *[field("alias", alias) for alias in aliases],
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
                "work": "",
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
                "coverageKeys": [f"source-term:{term['term_id']}"] if term_dimension in DIMENSION_LABELS else [],
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
        work_values = unique([str(row["character"].get("work_or_witness", "")) for row in rows])
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
                "work": work_values[0] if len(work_values) == 1 else "",
                "characterIds": character_ids,
                "characterExamples": character_names[:6],
                "relatedConceptIds": related_ids,
                "url": first_url(first["character"].get("citations", [])),
                "searchFields": fields,
                "searchText": search_text(fields),
                "coverageKeys": [row["coverageKey"] for row in rows],
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
                key=lambda item: (-item[1], sources[item[0]]["title"].casefold(), item[0]),
            )[:16]
        ]
        for source_id, counts in sorted(connection_pairs.items())
    }

    coverage: dict[str, dict[str, Any]] = {}
    for dimension, label in DIMENSION_LABELS.items():
        expected = dimension_row_keys[dimension]
        projected = [
            coverage_key
            for record in records
            if record.get("dimension") == dimension
            for coverage_key in record.get("coverageKeys", [])
        ]
        projected_set = set(projected)
        if len(projected) != len(projected_set):
            raise ValueError(f"Discovery projection duplicated {dimension} coverage keys")
        unexpected = sorted(projected_set - expected)
        if unexpected:
            raise ValueError(f"Discovery projection emitted unknown {dimension} coverage keys: {unexpected[:3]}")
        missing = sorted(expected - projected_set)
        if missing:
            raise ValueError(f"Discovery projection omitted {dimension} coverage keys: {missing[:3]}")
        coverage[dimension] = {
            "label": label,
            "acceptedRows": len(expected),
            "discoverableRows": len(expected & projected_set),
            "excludedRows": len(missing),
            "missingRows": missing,
            "exclusionRule": "An accepted non-empty row is discoverable only when its compiler provenance key is emitted by a source-preserving evidence result.",
        }

    for record in records:
        record["foldedLabel"] = fold(record["label"])
    records.sort(key=lambda record: (record["kind"], record["foldedLabel"], record["id"]))
    output = {
        "meta": {
            "title": "Fantasy Atlas Discovery Index",
            "version": "1.0-bounded-discovery",
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
            "foldingMap": FOLDING_REPLACEMENTS,
            "normalizationRules": VARIANT_RULES,
            "sourceConnections": source_connections,
        },
        "records": records,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUTPUT_PATH.relative_to(ROOT)}: {len(records)} records; "
        f"{sum(item['discoverableRows'] for item in coverage.values())} accepted dimension rows covered."
    )


if __name__ == "__main__":
    main()
