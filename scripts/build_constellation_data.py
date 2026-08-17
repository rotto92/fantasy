#!/usr/bin/env python3
"""Build the class/race/entity constellation projection.

Only normalized People & Beings and Roles & Vocations archetypes become graph
nodes. Validated characters and source terms remain cited evidence
attached to those nodes. Parent-child taxonomy links form the visible
constellations; cross-domain affinities are derived only from shared evidence.
"""

from __future__ import annotations

import itertools
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from reproducible import source_fingerprint


ROOT = Path(__file__).resolve().parents[1]
ATLAS_PATH = ROOT / "generated" / "atlas.json"
CHARACTER_PATH = ROOT / "public" / "data" / "characters.json"
OUTPUT_PATH = ROOT / "public" / "data" / "constellations.json"

INCLUDED_DOMAINS = {
    "People & Beings": {
        "id": "beings",
        "label": "Beings & Peoples",
        "shortLabel": "Race / entity",
        "color": "#70d6c8",
        "description": "Peoples, ancestries, spirits, monsters, divinities, undead, constructs, and other kinds of being.",
    },
    "Roles & Vocations": {
        "id": "classes",
        "label": "Classes & Vocations",
        "shortLabel": "Class / vocation",
        "color": "#efc87a",
        "description": "Martial, magical, religious, social, specialist, craft, and progression roles.",
    },
}


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def first_url(citations: list[dict[str, Any]]) -> str:
    return str(citations[0].get("url", "")) if citations else ""


def stratified_examples(values: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    kind_order = {"character-example": 0, "source-term": 1}
    remaining = sorted(
        values,
        key=lambda value: (
            kind_order.get(str(value.get("kind", "")), 99),
            str(value.get("sourceTitle", "")).casefold(),
            str(value.get("label", "")).casefold(),
            str(value.get("id", "")),
        ),
    )
    selected: list[dict[str, Any]] = []
    kind_counts: Counter[str] = Counter()
    source_counts: Counter[str] = Counter()
    while remaining and len(selected) < limit:
        best = min(
            remaining,
            key=lambda value: (
                kind_counts[str(value.get("kind", ""))],
                source_counts[str(value.get("sourceId", ""))],
                kind_order.get(str(value.get("kind", "")), 99),
                str(value.get("sourceTitle", "")).casefold(),
                str(value.get("label", "")).casefold(),
                str(value.get("id", "")),
            ),
        )
        remaining.remove(best)
        selected.append(best)
        kind_counts[str(best.get("kind", ""))] += 1
        source_counts[str(best.get("sourceId", ""))] += 1
    return selected


def main() -> None:
    atlas = load(ATLAS_PATH)
    research = load(CHARACTER_PATH)
    atlas_nodes = {node["id"]: node for node in atlas["nodes"]}
    audits = {str(audit["source_id"]): audit for audit in research["sources"]}

    selected = {
        node_id: node
        for node_id, node in atlas_nodes.items()
        if node.get("kind") == "archetype"
        and node.get("domain") in INCLUDED_DOMAINS
        and int(node.get("tier") or 0) >= 2
    }
    domain_roots = {
        node["id"]: node
        for node in atlas["nodes"]
        if node.get("kind") == "domain" and node.get("domain") in INCLUDED_DOMAINS
    }

    examples: dict[str, list[dict[str, Any]]] = defaultdict(list)
    evidence_groups: list[tuple[str, str, set[str]]] = []

    for character in research["characters"]:
        mapped_ids: set[str] = set()
        for dimension in ("being_types", "roles_and_vocations"):
            for value in character.get("dimensions", {}).get(dimension, []):
                mapped_ids.update(archetype_id for archetype_id in value.get("archetype_ids", []) if archetype_id in selected)
        if not mapped_ids:
            continue
        example = {
            "id": character["character_id"],
            "kind": "character-example",
            "label": character["canonical_name"],
            "sourceId": character["source_id"],
            "sourceTitle": character["source_title"],
            "continuity": character["continuity"],
            "summary": character["description"],
            "distinction": "Character evidence only; this character is not a graph node.",
            "evidenceLevel": character["evidence_level"],
            "url": first_url(character.get("citations", [])),
            "work": character["work_or_witness"],
            "reviewStatus": character["review_status"],
            "canonStatus": character["canon_status"],
            "caution": " ".join(character.get("comparison_cautions", [])),
        }
        for archetype_id in mapped_ids:
            examples[archetype_id].append(example)
        evidence_groups.append((character["character_id"], "character evidence", mapped_ids))

    for term in research["sourceTerms"]:
        mapped_ids = {archetype_id for archetype_id in term.get("archetype_ids", []) if archetype_id in selected}
        if not mapped_ids:
            continue
        source = next((item for item in research["corpusSources"] if item["sourceId"] == term["source_id"]), None)
        example = {
            "id": term["term_id"],
            "kind": "source-term",
            "label": term["canonical_term"],
            "sourceId": term["source_id"],
            "sourceTitle": source["title"] if source else term["source_id"],
            "continuity": source.get("continuityUnit", "Source-native terminology record") if source else "Source-native terminology record",
            "summary": term["definition"],
            "distinction": term["cultural_caution"],
            "evidenceLevel": term.get("evidence_level", ""),
            "evidenceBasis": audits.get(str(term["source_id"]), {}).get("evidence_basis", ""),
            "url": first_url(term.get("citations", [])),
            "work": term.get("work_or_witness", ""),
            "reviewStatus": term["review_status"],
            "caution": term["cultural_caution"],
        }
        for archetype_id in mapped_ids:
            examples[archetype_id].append(example)
        evidence_groups.append((term["term_id"], "source term", mapped_ids))

    children: dict[str, list[str]] = defaultdict(list)
    parent_by_id: dict[str, str] = {}
    taxonomy_edges: list[dict[str, Any]] = []
    for node_id, node in selected.items():
        parent_id = str(node.get("record", {}).get("Parent_ID", ""))
        parent_by_id[node_id] = parent_id
        if parent_id in selected:
            children[parent_id].append(node_id)
            taxonomy_edges.append(
                {
                    "id": f"taxonomy:{parent_id}:{node_id}",
                    "source": parent_id,
                    "target": node_id,
                    "kind": "taxonomy",
                    "label": "subtype of",
                    "weight": 1,
                }
            )

    affinity_counts: Counter[tuple[str, str]] = Counter()
    affinity_evidence: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for evidence_id, evidence_kind, mapped_ids in evidence_groups:
        people = sorted(archetype_id for archetype_id in mapped_ids if archetype_id.startswith("PPL-"))
        roles = sorted(archetype_id for archetype_id in mapped_ids if archetype_id.startswith("ROL-"))
        people_families = {
            archetype_id if int(selected[archetype_id].get("tier") or 0) == 2 else parent_by_id.get(archetype_id, "")
            for archetype_id in people
        }
        role_families = {
            archetype_id if int(selected[archetype_id].get("tier") or 0) == 2 else parent_by_id.get(archetype_id, "")
            for archetype_id in roles
        }
        pairs = {
            *itertools.product(people, roles),
            *itertools.product(sorted(people_families - {""}), sorted(role_families - {""})),
        }
        for pair in sorted(pairs):
            affinity_counts[pair] += 1
            if len(affinity_evidence[pair]) < 8:
                affinity_evidence[pair].append({"id": evidence_id, "kind": evidence_kind})
    affinity_edges = [
        {
            "id": f"affinity:{source}:{target}",
            "source": source,
            "target": target,
            "kind": "affinity",
            "label": "co-occurs in evidence",
            "weight": weight,
            "evidence": affinity_evidence[(source, target)],
        }
        for (source, target), weight in sorted(affinity_counts.items(), key=lambda item: (-item[1], item[0]))
    ]

    def descendants(node_id: str) -> int:
        return sum(1 + descendants(child_id) for child_id in children.get(node_id, []))

    rolled_examples: dict[str, list[dict[str, Any]]] = {}

    def examples_with_descendants(node_id: str) -> list[dict[str, Any]]:
        if node_id in rolled_examples:
            return rolled_examples[node_id]
        combined = [*examples.get(node_id, [])]
        for child_id in sorted(children.get(node_id, [])):
            combined.extend(examples_with_descendants(child_id))
        deduplicated: dict[tuple[str, str, str], dict[str, Any]] = {}
        for example in combined:
            key = (
                str(example.get("kind", "")),
                str(example.get("id", "")),
                str(example.get("sourceId", "")),
            )
            deduplicated.setdefault(key, example)
        rolled_examples[node_id] = list(deduplicated.values())
        return rolled_examples[node_id]

    output_nodes: list[dict[str, Any]] = []
    for node_id, node in selected.items():
        record = node.get("record", {})
        domain = INCLUDED_DOMAINS[node["domain"]]
        node_examples = examples_with_descendants(node_id)
        source_ids = sorted({str(example.get("sourceId", "")) for example in node_examples if example.get("sourceId")})
        parent_id = parent_by_id.get(node_id, "")
        family_id = node_id if int(node.get("tier") or 0) == 2 else parent_id
        output_nodes.append(
            {
                "id": node_id,
                "label": node["label"],
                "nodeKind": "being" if domain["id"] == "beings" else "class",
                "domainId": domain["id"],
                "domainLabel": domain["label"],
                "tier": int(node.get("tier") or 0),
                "parentId": parent_id if parent_id in selected else "",
                "familyId": family_id,
                "definition": record.get("Core_Definition", ""),
                "distinctions": record.get("Key_Distinctions", ""),
                "functions": record.get("Typical_Functions", ""),
                "representativeTerms": record.get("Representative_Terms", ""),
                "caution": record.get("Cross_Cultural_Caution", ""),
                "frameworkStatus": record.get("Framework_Status", ""),
                "childIds": sorted(children.get(node_id, [])),
                "descendantCount": descendants(node_id),
                "evidenceCount": len(node_examples),
                "sourceCount": len(source_ids),
                "sourceIds": source_ids,
                "examples": stratified_examples(node_examples, 48),
            }
        )

    domains = []
    for workbook_domain, domain in INCLUDED_DOMAINS.items():
        root = next((node for node in domain_roots.values() if node.get("domain") == workbook_domain), None)
        domain_nodes = [node for node in output_nodes if node["domainId"] == domain["id"]]
        domains.append(
            {
                **domain,
                "rootArchetypeId": root["id"] if root else "",
                "nodeCount": len(domain_nodes),
                "familyCount": sum(1 for node in domain_nodes if node["tier"] == 2),
                "evidencedNodeCount": sum(1 for node in domain_nodes if node["evidenceCount"] > 0),
            }
        )

    output = {
        "meta": {
            "title": "Fantasy Concept Constellations",
            "version": "5.0-concept-constellations",
            "sourceFingerprint": source_fingerprint([ATLAS_PATH, CHARACTER_PATH, Path(__file__)]),
            "visualContract": "Every graph node is a normalized being/race/entity or class/vocation archetype. Validated characters and source terms are evidence, never nodes.",
            "counts": {
                "nodes": len(output_nodes),
                "families": sum(1 for node in output_nodes if node["tier"] == 2),
                "specificArchetypes": sum(1 for node in output_nodes if node["tier"] == 3),
                "taxonomyEdges": len(taxonomy_edges),
                "affinityEdges": len(affinity_edges),
                "sourceExamples": sum(len(node["examples"]) for node in output_nodes),
                "corpusSources": len(research["corpusSources"]),
            },
        },
        "domains": domains,
        "nodes": sorted(output_nodes, key=lambda node: (node["domainId"], node["tier"], node["id"])),
        "edges": taxonomy_edges + affinity_edges,
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {OUTPUT_PATH.relative_to(ROOT)}: {len(output_nodes)} concept nodes, "
        f"{len(taxonomy_edges)} taxonomy edges, {len(affinity_edges)} evidence affinities."
    )


if __name__ == "__main__":
    main()
