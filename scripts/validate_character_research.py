#!/usr/bin/env python3
"""Validate and compile citation-backed character research batches.

Researchers write isolated JSON bundles under ``research/batch_*/*``. This
script enforces the character-only graph contract and emits the browser payload
only when every structural and evidence gate passes.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from openpyxl import load_workbook

from reproducible import source_fingerprint


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_WORKBOOK = ROOT / "fantasy_high_fantasy_archetype_atlas_v3.xlsx"
DEFAULT_RESEARCH_ROOT = ROOT / "research"
DEFAULT_OUTPUT = ROOT / "public" / "data" / "characters.json"
DEFAULT_REPORT = ROOT / "research" / "validation_report.json"
REVIEW_INDEX = ROOT / "research" / "independent_reviews" / "index.json"
DIMENSION_SCHEMA_PATH = ROOT / "research" / "dimensions.json"

REQUIRED_FILES = ("sources.json", "characters.json", "relationships.json", "source_terms.json")
DIMENSION_LABELS = json.loads(DIMENSION_SCHEMA_PATH.read_text(encoding="utf-8"))
DIMENSIONS = tuple(DIMENSION_LABELS)
RELATIONSHIP_TYPES = {
    "kin",
    "ally",
    "opponent",
    "mentor",
    "student",
    "ruler",
    "subject",
    "creator",
    "created",
    "patron",
    "champion",
    "lover",
    "spouse",
    "companion",
    "member-of-party",
    "transformed-by",
    "other",
}
DISALLOWED_EVIDENCE_HOSTS = {
    "wikipedia.org",
    "fandom.com",
    "reddit.com",
}


def workbook_records(sheet: Any, header_row: int = 1) -> list[dict[str, Any]]:
    rows = sheet.iter_rows(min_row=header_row, values_only=True)
    headers = [str(value).strip() if value is not None else "" for value in next(rows)]
    output: list[dict[str, Any]] = []
    for row in rows:
        record = {
            header: value
            for header, value in zip(headers, row)
            if header and value not in (None, "")
        }
        if record:
            output.append(record)
    return output


def load_array(path: Path, errors: list[str]) -> list[dict[str, Any]]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"{path.relative_to(ROOT)}: cannot load JSON ({exc})")
        return []
    if not isinstance(value, list):
        errors.append(f"{path.relative_to(ROOT)}: root must be a JSON array")
        return []
    if not all(isinstance(item, dict) for item in value):
        errors.append(f"{path.relative_to(ROOT)}: every array item must be an object")
        return []
    return value


def require(record: dict[str, Any], keys: tuple[str, ...], context: str, errors: list[str]) -> None:
    for key in keys:
        # Presence and type are validated separately where an empty array or
        # intentionally blank caution/note is a meaningful, honest value.
        if key not in record or record[key] is None:
            errors.append(f"{context}: missing required field {key}")


def host_is_disallowed(url: str) -> bool:
    host = (urlparse(url).hostname or "").lower()
    return any(host == blocked or host.endswith(f".{blocked}") for blocked in DISALLOWED_EVIDENCE_HOSTS)


def validate_citations(
    citations: Any,
    context: str,
    errors: list[str],
    warnings: list[str],
) -> None:
    if not isinstance(citations, list) or not citations:
        errors.append(f"{context}: at least one claim-specific citation is required")
        return
    allowed_count = 0
    for index, citation in enumerate(citations, 1):
        item_context = f"{context} citation {index}"
        if not isinstance(citation, dict):
            errors.append(f"{item_context}: citation must be an object")
            continue
        url = str(citation.get("url", "")).strip()
        locator = str(citation.get("locator", "")).strip()
        supports = citation.get("supports")
        if not re.match(r"^https?://", url):
            errors.append(f"{item_context}: stable http(s) URL required")
        elif host_is_disallowed(url):
            warnings.append(f"{item_context}: orientation-only host cannot establish canonical evidence ({url})")
        else:
            allowed_count += 1
        if not locator:
            errors.append(f"{item_context}: work/chapter/page/section locator required")
        if not isinstance(supports, list) or not supports or not all(str(value).strip() for value in supports):
            errors.append(f"{item_context}: supports must be a non-empty list of claims")
    if allowed_count == 0:
        errors.append(f"{context}: no allowable canonical evidence source remains")


def source_sort_key(source_id: str) -> tuple[int, str]:
    match = re.search(r"(\d+)$", source_id)
    return (int(match.group(1)) if match else 999999, source_id)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--research-root", type=Path, default=DEFAULT_RESEARCH_ROOT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()

    workbook = load_workbook(args.workbook, read_only=True, data_only=True)
    source_rows = workbook_records(workbook["Source Corpus"])
    taxonomy_rows = workbook_records(workbook["Master Taxonomy"])
    sources_by_id = {str(row["Source_ID"]): row for row in source_rows}
    archetypes_by_id = {str(row["Archetype_ID"]): row for row in taxonomy_rows}

    discovered_bundle_dirs = sorted(
        path
        for path in args.research_root.glob("batch_*/*")
        if path.is_dir() and any((path / filename).exists() for filename in REQUIRED_FILES)
    )
    quarantined_bundle_dirs = [path for path in discovered_bundle_dirs if (path / "QUARANTINED.md").exists()]
    bundle_dirs = [path for path in discovered_bundle_dirs if path not in quarantined_bundle_dirs]
    errors: list[str] = []
    warnings: list[str] = []
    all_sources: list[dict[str, Any]] = []
    all_characters: list[dict[str, Any]] = []
    all_relationships: list[dict[str, Any]] = []
    all_terms: list[dict[str, Any]] = []

    if not bundle_dirs:
        errors.append("No research bundles found under research/batch_*/*")

    for bundle in bundle_dirs:
        missing = [filename for filename in REQUIRED_FILES if not (bundle / filename).exists()]
        if missing:
            errors.append(f"{bundle.relative_to(ROOT)}: missing {', '.join(missing)}")
            continue
        all_sources.extend(load_array(bundle / "sources.json", errors))
        all_characters.extend(load_array(bundle / "characters.json", errors))
        all_relationships.extend(load_array(bundle / "relationships.json", errors))
        all_terms.extend(load_array(bundle / "source_terms.json", errors))

    source_audit_ids: list[str] = []
    for record in all_sources:
        source_id = str(record.get("source_id", ""))
        context = f"source audit {source_id or '<unknown>'}"
        require(
            record,
            (
                "source_id",
                "source_title",
                "continuity_scope",
                "work_or_witnesses",
                "coverage_rule",
                "completion_status",
                "evidence_basis",
                "citations",
                "last_reviewed",
            ),
            context,
            errors,
        )
        if source_id not in sources_by_id:
            errors.append(f"{context}: unknown Source_ID")
        source_audit_ids.append(source_id)
        if not isinstance(record.get("work_or_witnesses"), list):
            errors.append(f"{context}: work_or_witnesses must be an array")
        for field in ("in_scope_character_count", "completed_character_count"):
            if not isinstance(record.get(field), int) or int(record.get(field, -1)) < 0:
                errors.append(f"{context}: {field} must be a non-negative integer")
        if record.get("completion_status") == "pass-complete" and record.get("in_scope_character_count") != record.get("completed_character_count"):
            errors.append(f"{context}: pass-complete count does not match declared in-scope count")
        for field in ("omissions", "uncertainties"):
            if not isinstance(record.get(field, []), list):
                errors.append(f"{context}: {field} must be an array")
        validate_citations(record.get("citations"), context, errors, warnings)

    duplicate_source_audits = [value for value, count in Counter(source_audit_ids).items() if value and count > 1]
    if duplicate_source_audits:
        errors.append(f"Duplicate source audits: {', '.join(sorted(duplicate_source_audits))}")
    missing_source_audits = sorted(set(sources_by_id) - set(source_audit_ids), key=source_sort_key)
    if missing_source_audits:
        errors.append(f"Missing source audits: {', '.join(missing_source_audits)}")
    for record in all_sources:
        status = str(record.get("completion_status", "")).strip().lower()
        if not status or "in-progress" in status:
            errors.append(
                f"source audit {record.get('source_id', '<unknown>')}: "
                "completion_status must be a terminal bounded-pass status"
            )

    character_ids: list[str] = []
    character_source_by_id: dict[str, str] = {}
    character_count_by_source: Counter[str] = Counter()
    evidence_urls_by_source: dict[str, set[str]] = defaultdict(set)
    evidence_locators_by_source: dict[str, set[str]] = defaultdict(set)
    for record in all_characters:
        character_id = str(record.get("character_id", ""))
        source_id = str(record.get("source_id", ""))
        context = f"character {character_id or '<unknown>'}"
        require(
            record,
            (
                "character_id",
                "canonical_name",
                "source_id",
                "source_title",
                "continuity",
                "work_or_witness",
                "character_kind",
                "description",
                "dimensions",
                "canon_status",
                "evidence_level",
                "citations",
                "comparison_cautions",
                "spoiler_level",
                "review_status",
            ),
            context,
            errors,
        )
        if not re.match(r"^CHR-SRC\d{3}-\d{3,}$", character_id):
            errors.append(f"{context}: ID must match CHR-SRC###-###")
        if source_id not in sources_by_id:
            errors.append(f"{context}: unknown Source_ID {source_id}")
        expected_prefix = f"CHR-{source_id.replace('SRC-', 'SRC')}-" if source_id else ""
        if expected_prefix and not character_id.startswith(expected_prefix):
            errors.append(f"{context}: ID prefix does not match source {source_id}")
        if record.get("character_kind") != "individual":
            errors.append(
                f"{context}: character_kind must be individual; "
                "collectives, manifestations, generic units, and other concepts belong in source_terms"
            )
        character_ids.append(character_id)
        character_source_by_id[character_id] = source_id
        character_count_by_source[source_id] += 1
        if not isinstance(record.get("aliases", []), list):
            errors.append(f"{context}: aliases must be an array")
        if not isinstance(record.get("comparison_cautions"), list):
            errors.append(f"{context}: comparison_cautions must be an array")
        dimensions = record.get("dimensions")
        if not isinstance(dimensions, dict):
            errors.append(f"{context}: dimensions must be an object")
        else:
            unknown_dimensions = sorted(set(dimensions) - set(DIMENSIONS))
            if unknown_dimensions:
                errors.append(f"{context}: unknown dimensions {', '.join(unknown_dimensions)}")
            for dimension in DIMENSIONS:
                values = dimensions.get(dimension, [])
                if not isinstance(values, list):
                    errors.append(f"{context}: dimension {dimension} must be an array")
                    continue
                for index, value in enumerate(values, 1):
                    value_context = f"{context} {dimension}[{index}]"
                    if not isinstance(value, dict):
                        errors.append(f"{value_context}: dimension value must be an object")
                        continue
                    require(value, ("term", "archetype_ids", "confidence", "note"), value_context, errors)
                    archetype_ids = value.get("archetype_ids", [])
                    if not isinstance(archetype_ids, list):
                        errors.append(f"{value_context}: archetype_ids must be an array")
                    else:
                        for archetype_id in archetype_ids:
                            if archetype_id not in archetypes_by_id:
                                errors.append(f"{value_context}: unknown archetype ID {archetype_id}")
        validate_citations(record.get("citations"), context, errors, warnings)
        for citation in record.get("citations", []):
            if isinstance(citation, dict):
                evidence_urls_by_source[source_id].add(str(citation.get("url", "")))
                evidence_locators_by_source[source_id].add(str(citation.get("locator", "")))

    duplicate_characters = [value for value, count in Counter(character_ids).items() if value and count > 1]
    if duplicate_characters:
        errors.append(f"Duplicate character IDs: {', '.join(sorted(duplicate_characters))}")
    character_id_set = set(character_ids)

    for source_id, count in character_count_by_source.items():
        unique_urls = len(evidence_urls_by_source[source_id])
        unique_locators = len(evidence_locators_by_source[source_id])
        if count >= 10 and unique_urls <= 1:
            warnings.append(
                f"{source_id}: {count} character records depend on one evidence URL; prioritize independent source-to-claim review"
            )
        if count >= 10 and unique_locators / count < 0.3:
            warnings.append(
                f"{source_id}: only {unique_locators} unique locators for {count} characters; check claim granularity"
            )

    relationship_ids: list[str] = []
    for record in all_relationships:
        relationship_id = str(record.get("relationship_id", ""))
        context = f"relationship {relationship_id or '<unknown>'}"
        require(
            record,
            (
                "relationship_id",
                "source_id",
                "source_character_id",
                "target_character_id",
                "relationship_type",
                "label",
                "direction",
                "continuity",
                "citations",
                "confidence",
                "note",
            ),
            context,
            errors,
        )
        relationship_ids.append(relationship_id)
        if not re.match(r"^REL-SRC\d{3}-\d{3,}$", relationship_id):
            errors.append(f"{context}: ID must match REL-SRC###-###")
        source_id = str(record.get("source_id", ""))
        expected_prefix = f"REL-{source_id.replace('SRC-', 'SRC')}-" if source_id else ""
        if expected_prefix and not relationship_id.startswith(expected_prefix):
            errors.append(f"{context}: ID prefix does not match source {source_id}")
        for endpoint in ("source_character_id", "target_character_id"):
            if record.get(endpoint) not in character_id_set:
                errors.append(f"{context}: {endpoint} is not an included character ({record.get(endpoint)})")
            elif character_source_by_id.get(str(record.get(endpoint))) != source_id:
                errors.append(f"{context}: {endpoint} belongs to a different source pass")
        if record.get("source_character_id") == record.get("target_character_id"):
            errors.append(f"{context}: self-loop relationships are not allowed")
        if record.get("relationship_type") not in RELATIONSHIP_TYPES:
            errors.append(f"{context}: invalid relationship_type {record.get('relationship_type')}")
        if record.get("direction") not in {"directed", "undirected"}:
            errors.append(f"{context}: direction must be directed or undirected")
        if record.get("source_id") not in sources_by_id:
            errors.append(f"{context}: unknown Source_ID {record.get('source_id')}")
        validate_citations(record.get("citations"), context, errors, warnings)

    duplicate_relationships = [value for value, count in Counter(relationship_ids).items() if value and count > 1]
    if duplicate_relationships:
        errors.append(f"Duplicate relationship IDs: {', '.join(sorted(duplicate_relationships))}")

    term_ids: list[str] = []
    term_count_by_source: Counter[str] = Counter()
    for record in all_terms:
        term_id = str(record.get("term_id", ""))
        context = f"source term {term_id or '<unknown>'}"
        require(
            record,
            (
                "term_id",
                "source_id",
                "canonical_term",
                "work_or_witness",
                "dimension",
                "archetype_ids",
                "mapping_relation",
                "definition",
                "cultural_caution",
                "citations",
                "review_status",
            ),
            context,
            errors,
        )
        term_ids.append(term_id)
        term_count_by_source[str(record.get("source_id", ""))] += 1
        if record.get("source_id") not in sources_by_id:
            errors.append(f"{context}: unknown Source_ID {record.get('source_id')}")
        work_or_witness = record.get("work_or_witness")
        if not isinstance(work_or_witness, str) or not work_or_witness.strip():
            errors.append(f"{context}: work_or_witness must be a non-empty string")
        elif not any(character.isalpha() for character in work_or_witness):
            errors.append(f"{context}: work_or_witness must identify the claim-specific work or witness")
        if record.get("dimension") not in DIMENSIONS:
            errors.append(f"{context}: invalid dimension {record.get('dimension')}")
        archetype_ids = record.get("archetype_ids")
        if not isinstance(archetype_ids, list):
            errors.append(f"{context}: archetype_ids must be an array")
        else:
            for archetype_id in archetype_ids:
                if archetype_id not in archetypes_by_id:
                    errors.append(f"{context}: unknown archetype ID {archetype_id}")
        validate_citations(record.get("citations"), context, errors, warnings)

    duplicate_terms = [value for value, count in Counter(term_ids).items() if value and count > 1]
    if duplicate_terms:
        errors.append(f"Duplicate source term IDs: {', '.join(sorted(duplicate_terms))}")

    audits_by_source = {str(record.get("source_id")): record for record in all_sources}
    for source_id, audit in audits_by_source.items():
        count = character_count_by_source[source_id]
        declared = audit.get("completed_character_count")
        if declared != count:
            errors.append(f"{source_id}: audit declares {declared} completed characters but bundle contains {count}")
        if count == 0 and term_count_by_source[source_id] == 0:
            errors.append(f"{source_id}: zero-character pass must retain at least one source term")

    dimension_term_counts: dict[str, int] = defaultdict(int)
    for record in all_characters:
        for dimension, values in record.get("dimensions", {}).items():
            dimension_term_counts[dimension] += len(values)

    review_index: dict[str, Any] = {}
    try:
        loaded_review_index = json.loads(REVIEW_INDEX.read_text(encoding="utf-8"))
        if not isinstance(loaded_review_index, dict):
            raise ValueError("root must be an object")
        review_index = loaded_review_index
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        errors.append(f"{REVIEW_INDEX.relative_to(ROOT)}: cannot load independent-review index ({exc})")

    review_status_map = review_index.get("source_review_status", {})
    if review_index and not isinstance(review_status_map, dict):
        errors.append("independent-review index: source_review_status must be an object")
        review_status_map = {}
    unknown_review_sources = sorted(set(review_status_map) - set(sources_by_id), key=source_sort_key)
    if unknown_review_sources:
        errors.append(f"independent-review index: unknown source IDs {', '.join(unknown_review_sources)}")
    reviewed_source_count = len(review_status_map)
    if review_index and review_index.get("reviewed_source_count") != reviewed_source_count:
        errors.append("independent-review index: reviewed_source_count does not match source_review_status")
    if review_index and review_index.get("pending_source_count") != len(sources_by_id) - reviewed_source_count:
        errors.append("independent-review index: pending_source_count does not match corpus coverage")
    warning_source_ids = sorted(
        {warning.split(":", 1)[0] for warning in warnings if re.match(r"^SRC-\d{3}:", warning)},
        key=source_sort_key,
    )
    indexed_warning_sources = sorted(review_index.get("retained_warning_source_ids", []), key=source_sort_key)
    if review_index and indexed_warning_sources != warning_source_ids:
        errors.append("independent-review index: retained warning source IDs do not match current validator warnings")

    input_paths = [
        args.workbook,
        DIMENSION_SCHEMA_PATH,
        REVIEW_INDEX,
        Path(__file__),
        *[
            bundle / filename
            for bundle in bundle_dirs
            for filename in REQUIRED_FILES
        ],
    ]
    fingerprint = source_fingerprint([path for path in input_paths if path.exists()])

    report = {
        "source_fingerprint": fingerprint,
        "status": "valid" if not errors else "invalid",
        "bundles": [str(path.relative_to(ROOT)) for path in bundle_dirs],
        "quarantinedBundles": [str(path.relative_to(ROOT)) for path in quarantined_bundle_dirs],
        "counts": {
            "source_audits": len(all_sources),
            "characters": len(all_characters),
            "relationships": len(all_relationships),
            "source_terms": len(all_terms),
            "errors": len(errors),
            "warnings": len(warnings),
        },
        "character_counts_by_source": dict(sorted(character_count_by_source.items(), key=lambda item: source_sort_key(item[0]))),
        "dimension_value_counts": dict(sorted(dimension_term_counts.items())),
        "evidence_concentration_by_source": {
            source_id: {
                "character_records": character_count_by_source[source_id],
                "unique_character_citation_urls": len(evidence_urls_by_source[source_id]),
                "unique_character_citation_locators": len(evidence_locators_by_source[source_id]),
            }
            for source_id in sorted(character_count_by_source, key=source_sort_key)
        },
        "independent_review": {
            "reviewed_sources": reviewed_source_count,
            "pending_sources": len(sources_by_id) - reviewed_source_count,
            "retained_warning_sources": len(warning_source_ids),
            "corpus_wide_reviews": len(review_index.get("corpus_wide_reviews", [])),
        },
        "errors": errors,
        "warnings": warnings,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if errors:
        print(f"Character research validation failed with {len(errors)} error(s); see {args.report}")
        raise SystemExit(1)

    compiled = {
        "meta": {
            "title": "Fantasy Character Atlas",
            "version": "4.0-research",
            "sourceFingerprint": fingerprint,
            "sourceWorkbook": args.workbook.name,
            "counts": report["counts"],
            "researchCoverage": {
                "corpusSources": len(source_rows),
                "characterResearchedSources": len(all_sources),
                "characterUnresearchedSources": len(source_rows) - len(all_sources),
            },
            "qualityWarnings": warnings,
            "reviewCoverage": {
                "focusedReviewedSources": reviewed_source_count,
                "pendingFullSecondReviewSources": len(sources_by_id) - reviewed_source_count,
                "retainedWarningSources": len(warning_source_ids),
                "retainedWarningFlags": len(warnings),
                "corpusWideContractReviews": len(review_index.get("corpus_wide_reviews", [])),
            },
            "quarantinedBundles": [str(path.relative_to(ROOT)) for path in quarantined_bundle_dirs],
            "visualContract": "Characters and source-native terms are searchable evidence; normalized beings and classes remain the graph nodes.",
        },
        "dimensions": list(DIMENSIONS),
        "dimensionLabels": DIMENSION_LABELS,
        "corpusSources": [
            {
                "sourceId": row.get("Source_ID", ""),
                "title": row.get("Title_or_Franchise", ""),
                "creator": row.get("Creator_Studio", ""),
                "medium": row.get("Medium", ""),
                "region": row.get("Region_Tradition", ""),
                "firstAppearance": row.get("First_Appearance", ""),
                "continuityUnit": row.get("Continuity_Unit", ""),
                "priorityTier": row.get("Priority_Tier", ""),
                "distinctiveContribution": row.get("Distinctive_Contribution", ""),
                "scopeNote": row.get("Scope_Note", ""),
                "referenceUrl": row.get("Reference_URL", ""),
                "status": row.get("Status", ""),
            }
            for row in sorted(source_rows, key=lambda row: source_sort_key(str(row.get("Source_ID", ""))))
        ],
        "sources": sorted(
            [
                {
                    **row,
                    "independent_review": review_status_map.get(
                        str(row.get("source_id", "")),
                        {
                            "review_types": [],
                            "ledgers": [],
                            "outcomes": [],
                            "unresolved_limits": ["Focused independent second review remains pending."],
                        },
                    ),
                }
                for row in all_sources
            ],
            key=lambda row: source_sort_key(str(row.get("source_id", ""))),
        ),
        "characters": sorted(all_characters, key=lambda row: (source_sort_key(str(row.get("source_id", ""))), str(row.get("canonical_name", "")))),
        "relationships": all_relationships,
        "sourceTerms": all_terms,
        "independentReviews": review_index,
        "taxonomy": {
            archetype_id: {
                "name": row.get("Preferred_Name", archetype_id),
                "domain": row.get("Domain", ""),
                "parentId": row.get("Parent_ID", ""),
                "tier": row.get("Tier", ""),
            }
            for archetype_id, row in archetypes_by_id.items()
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(compiled, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        "Validated "
        f"{len(all_characters)} characters, {len(all_relationships)} character relationships, "
        f"and {len(all_terms)} source terms across {len(all_sources)} source passes."
    )


if __name__ == "__main__":
    main()
