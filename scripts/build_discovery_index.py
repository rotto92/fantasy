#!/usr/bin/env python3
"""Compile the bounded research corpus into a searchable discovery projection.

The constellation graph intentionally contains only normalized being/entity and
class/vocation archetypes. This projection keeps every accepted research
dimension searchable alongside those graph concepts without promoting source-
native evidence to normalized graph nodes.
"""

from __future__ import annotations

import json
import sys
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from reproducible import source_fingerprint


ROOT = Path(__file__).resolve().parents[1]
RESEARCH_PATH = ROOT / "public" / "data" / "characters.json"
CONCEPTS_PATH = ROOT / "public" / "data" / "constellations.json"
OUTPUT_PATH = ROOT / "public" / "data" / "discovery.json"
DIMENSION_SCHEMA_PATH = ROOT / "research" / "dimensions.json"

DIMENSION_LABELS = json.loads(DIMENSION_SCHEMA_PATH.read_text(encoding="utf-8"))

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


def build_search_fold_contract() -> dict[str, Any]:
    normalization_map: dict[str, str] = {}
    casefold_map: dict[str, str] = {}
    discard_code_points: list[int] = []
    alphanumeric_ranges: list[list[int]] = []
    range_start: int | None = None
    for codepoint in range(sys.maxunicode + 1):
        character = chr(codepoint)
        normalized = unicodedata.normalize("NFKD", character)
        if normalized != character:
            normalization_map[character] = normalized
        folded = character.casefold()
        if folded != character:
            casefold_map[character] = folded
        if unicodedata.combining(character):
            discard_code_points.append(codepoint)
        if character.isalnum():
            if range_start is None:
                range_start = codepoint
        elif range_start is not None:
            alphanumeric_ranges.append([range_start, codepoint - 1])
            range_start = None
    if range_start is not None:
        alphanumeric_ranges.append([range_start, sys.maxunicode])
    return {
        "unicodeVersion": unicodedata.unidata_version,
        "normalizationMap": normalization_map,
        "casefoldMap": casefold_map,
        "discardCodePoints": discard_code_points,
        "alphanumericRanges": alphanumeric_ranges,
    }


SEARCH_FOLD_CONTRACT = build_search_fold_contract()
NORMALIZATION_MAP: dict[str, str] = SEARCH_FOLD_CONTRACT["normalizationMap"]
CASEFOLD_MAP: dict[str, str] = SEARCH_FOLD_CONTRACT["casefoldMap"]
DISCARD_CODE_POINTS: set[int] = set(SEARCH_FOLD_CONTRACT["discardCodePoints"])


def fold(value: Any) -> str:
    normalized = "".join(NORMALIZATION_MAP.get(character, character) for character in str(value or ""))
    folded = "".join(
        CASEFOLD_MAP.get(character, character)
        for character in normalized
        if ord(character) not in DISCARD_CODE_POINTS
    )
    return "".join(character for character in folded if character.isalnum())


def fold_tokens(value: Any) -> list[str]:
    tokens: list[str] = []
    token: list[str] = []
    for character in str(value or ""):
        if character.isalnum():
            token.append(character)
        elif token:
            tokens.append("".join(token))
            token = []
    if token:
        tokens.append("".join(token))
    folded_tokens = [fold(value) for value in tokens]
    return [value for value in folded_tokens if value]


def first_url(citations: list[dict[str, Any]]) -> str:
    return str(citations[0].get("url", "")) if citations else ""


def unique(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def field(label: str, value: Any) -> list[Any]:
    text = str(value or "")
    return [label, fold(text), fold_tokens(text)]


def source_lookup(research: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(source["sourceId"]): source for source in research["corpusSources"]}


def audit_lookup(research: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {str(audit["source_id"]): audit for audit in research["sources"]}


def source_work_labels(audit: dict[str, Any]) -> list[str]:
    labels: list[str] = []
    for witness in audit.get("work_or_witnesses", []):
        if isinstance(witness, str):
            label = witness.strip()
        elif isinstance(witness, dict):
            label = " · ".join(
                str(witness.get(key, "")).strip()
                for key in ("work", "edition")
                if str(witness.get(key, "")).strip()
            )
        else:
            label = ""
        if label:
            labels.append(label)
    return unique(labels)


def source_work_label(audit: dict[str, Any]) -> str:
    return "; ".join(source_work_labels(audit))


def source_identity_titles(source: dict[str, Any], audit: dict[str, Any]) -> list[str]:
    return unique(
        [
            str(source.get("title", "")).strip(),
            str(audit.get("source_title", "")).strip(),
        ]
    )


def source_fields(source: dict[str, Any], audit: dict[str, Any]) -> list[list[Any]]:
    return [
        *[field("source / series", title) for title in source_identity_titles(source, audit)],
        field("continuity", source.get("continuityUnit")),
        field("medium", source.get("medium")),
        field("region / tradition", source.get("region")),
        field("creator / studio", source.get("creator")),
    ]


def concept_ids(values: list[dict[str, Any]], valid_ids: set[str]) -> list[str]:
    return sorted(
        {
            str(archetype_id)
            for value in values
            for archetype_id in value.get("archetype_ids", [])
            if str(archetype_id) in valid_ids
        }
    )


def normalized_ids(values: list[dict[str, Any]]) -> list[str]:
    return sorted(
        {
            str(archetype_id)
            for value in values
            for archetype_id in value.get("archetype_ids", [])
            if str(archetype_id)
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
    audits = audit_lookup(research)
    valid_concept_ids = {str(node["id"]) for node in concepts["nodes"]}
    mapping_quarantine_claim_ids = set(
        research.get("meta", {}).get("reviewCoverage", {}).get("quarantinedMappingClaimIds", [])
    )
    characters_by_id = {str(character["character_id"]): character for character in research["characters"]}

    records: list[dict[str, Any]] = []
    dimension_rows_by_key: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    dimension_row_keys: dict[str, set[str]] = defaultdict(set)

    for character in research["characters"]:
        source = sources.get(str(character["source_id"]), {})
        audit = audits.get(str(character["source_id"]), {})
        related_ids = concept_ids(
            [value for value in character.get("dimensions", {}).values() for value in value],
            valid_concept_ids,
        )
        dimension_values = character_dimensions(character)
        mapping_ids = normalized_ids(dimension_values)
        fields = [
            field("character", character.get("canonical_name")),
            *[field("alias", alias) for alias in character.get("aliases", [])],
            *source_fields(source, audit),
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
                "normalizedConceptIds": mapping_ids,
                "mappingQuarantined": any(
                    f"dimension:{character['character_id']}:{dimension}" in mapping_quarantine_claim_ids
                    for dimension in character.get("dimensions", {})
                ),
                "url": first_url(character.get("citations", [])),
                "searchFields": fields,
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
        audit = audits.get(str(term["source_id"]), {})
        term_work = str(term.get("work_or_witness", "")).strip()
        source_scope = source_work_label(audit)
        identity_forms = unique(
            [
                canonical,
                str(term.get("transliteration", "")).strip(),
                str(term.get("original_script", "")).strip(),
                *[
                    str(value).strip()
                    for value in term.get("identity_forms", [])
                    if str(value).strip()
                ],
            ]
        )
        matching_rows_by_key: dict[str, dict[str, Any]] = {}
        for identity in identity_forms:
            for row in dimension_rows_by_key.get(
                (term_dimension, fold(identity), str(term["source_id"])),
                [],
            ):
                matching_rows_by_key.setdefault(str(row["coverageKey"]), row)
        matching_rows = list(matching_rows_by_key.values())
        matching_character_ids = unique(
            [str(row["character"]["character_id"]) for row in matching_rows]
        )
        matching_character_names = unique(
            [str(row["character"]["canonical_name"]) for row in matching_rows]
        )
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
            *[field("identity form", identity) for identity in term.get("identity_forms", [])],
            field("transliteration", term.get("transliteration")),
            field("literal gloss", term.get("literal_gloss")),
            field(DIMENSION_LABELS.get(term.get("dimension", ""), term.get("dimension", "")), canonical),
            *source_fields(source, audit),
            field("work / witness", term_work),
            field("source-wide scope", source_scope),
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
                "work": term_work,
                "characterIds": matching_character_ids,
                "characterExamples": matching_character_names[:6],
                "relatedConceptIds": [
                    str(archetype_id)
                    for archetype_id in term.get("archetype_ids", [])
                    if str(archetype_id) in valid_concept_ids
                ],
                "normalizedConceptIds": sorted(
                    {str(archetype_id) for archetype_id in term.get("archetype_ids", []) if str(archetype_id)}
                ),
                "mappingQuarantined": f"source-term:{term['term_id']}" in mapping_quarantine_claim_ids,
                "url": first_url(term.get("citations", [])),
                "searchFields": fields,
                "coverageKeys": [f"source-term:{term['term_id']}"] if term_dimension in DIMENSION_LABELS else [],
            }
        )

    for (dimension, folded_term, source_id), rows in sorted(dimension_rows_by_key.items()):
        first = rows[0]
        first_character = first["character"]
        source = sources.get(source_id, {})
        audit = audits.get(source_id, {})
        terms = [str(row["value"].get("term", "")).strip() for row in rows]
        display_term = terms[0]
        character_ids = unique([str(row["character"]["character_id"]) for row in rows])
        character_names = unique([str(row["character"]["canonical_name"]) for row in rows])
        related_ids = sorted(
            {
                str(archetype_id)
                for row in rows
                for archetype_id in row["value"].get("archetype_ids", [])
                if str(archetype_id) in valid_concept_ids
            }
        )
        mapping_ids = sorted(
            {
                str(archetype_id)
                for row in rows
                for archetype_id in row["value"].get("archetype_ids", [])
                if str(archetype_id)
            }
        )
        fields = [
            field(DIMENSION_LABELS.get(dimension, dimension), display_term),
            *source_fields(source, audit),
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
        continuity_values = unique([str(row["character"].get("continuity", "")) for row in rows])
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
                "continuity": "; ".join(continuity_values),
                "work": "; ".join(work_values),
                "characterIds": character_ids,
                "characterExamples": character_names[:6],
                "relatedConceptIds": related_ids,
                "normalizedConceptIds": mapping_ids,
                "mappingQuarantined": any(
                    f"dimension:{row['character']['character_id']}:{dimension}" in mapping_quarantine_claim_ids
                    for row in rows
                ),
                "url": first_url(first["character"].get("citations", [])),
                "searchFields": fields,
                "coverageKeys": [row["coverageKey"] for row in rows],
            }
        )
    records_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    source_concepts: dict[str, set[str]] = defaultdict(set)
    source_mappings: dict[str, set[str]] = defaultdict(set)
    for record in records:
        source_id = str(record.get("sourceId", ""))
        if source_id:
            records_by_source[source_id].append(record)
            source_concepts[source_id].update(record.get("relatedConceptIds", []))
            source_mappings[source_id].update(record.get("normalizedConceptIds", []))

    for source_id, source in sources.items():
        supporting = records_by_source.get(source_id, [])
        character_ids = sorted({character_id for record in supporting for character_id in record.get("characterIds", [])})
        related_ids = sorted(source_concepts.get(source_id, set()))
        audit = audits.get(source_id, {})
        identity_titles = source_identity_titles(source, audit)
        source_work = source_work_label(audit)
        fields = source_fields(source, audit) + [
            *[field("alias", title) for title in identity_titles[1:]],
            field("work / witness", source_work),
            field("source id", source_id),
            field("first appearance", source.get("firstAppearance")),
        ]
        records.append(
            {
                "id": f"source:{source_id}",
                "kind": "source",
                "kindLabel": "Source / series",
                "label": source["title"],
                "aliases": identity_titles[1:],
                "sourceId": source_id,
                "sourceTitle": source["title"],
                "dimension": "source",
                "continuity": source.get("continuityUnit", ""),
                "work": source_work,
                "characterIds": character_ids,
                "characterExamples": [characters_by_id[character_id]["canonical_name"] for character_id in character_ids[:6]],
                "relatedConceptIds": related_ids,
                "normalizedConceptIds": sorted(source_mappings.get(source_id, set())),
                "url": source.get("referenceUrl", ""),
                "searchFields": fields,
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
                "normalizedConceptIds": [node["id"]],
                "conceptId": node["id"],
                "url": "",
                "searchFields": fields,
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
        record["characterCount"] = len(record["characterIds"])
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
            "dimensionLabels": DIMENSION_LABELS,
            "searchFold": SEARCH_FOLD_CONTRACT,
            "normalizationRules": VARIANT_RULES,
            "sourceConnections": source_connections,
        },
        "records": records,
    }
    output["meta"]["sourceFingerprint"] = source_fingerprint(
        [RESEARCH_PATH, CONCEPTS_PATH, DIMENSION_SCHEMA_PATH, Path(__file__)]
    )
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(
        f"Wrote {OUTPUT_PATH.relative_to(ROOT)}: {len(records)} records; "
        f"{sum(item['discoverableRows'] for item in coverage.values())} accepted dimension rows covered."
    )


if __name__ == "__main__":
    main()
