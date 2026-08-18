import * as d3 from "d3";
import "./style.css";

type ViewMode = "constellations" | "catalogue" | "relations" | "research";
type DomainId = "beings" | "classes";
type DetailLevel = "auto" | "families" | "all";
type EvidenceFilter = "" | "evidenced" | "framework";
type SelectionOrigin = "click" | "search" | null;
type DiscoveryKind = "concept" | "character" | "dimension-term" | "source-term" | "source";

interface ConstellationExample {
  id: string;
  kind: "character-example" | "source-term";
  label: string;
  sourceId: string;
  sourceTitle: string;
  continuity: string;
  summary: string;
  distinction: string;
  evidenceLevel: string;
  evidenceBasis?: string;
  url: string;
  work?: string;
  reviewStatus?: string;
  canonStatus?: string;
  caution?: string;
}

interface EvidenceMembership {
  id: string;
  kind: string;
  sourceId: string;
}

interface ConceptNode {
  id: string;
  label: string;
  nodeKind: "being" | "class";
  domainId: DomainId;
  domainLabel: string;
  tier: 2 | 3;
  parentId: string;
  familyId: string;
  definition: string;
  distinctions: string;
  functions: string;
  representativeTerms: string;
  caution: string;
  frameworkStatus: string;
  childIds: string[];
  descendantCount: number;
  evidenceCount: number;
  sourceCount: number;
  sourceIds: string[];
  directEvidenceMemberships: EvidenceMembership[];
  descendantEvidenceMemberships: EvidenceMembership[];
  evidenceMemberships: EvidenceMembership[];
  examples: ConstellationExample[];
}

interface ConceptEdge {
  id: string;
  source: string;
  target: string;
  kind: "taxonomy" | "affinity";
  label: string;
  weight: number;
  evidence?: EvidenceMembership[];
}

interface DomainRecord {
  id: DomainId;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
  rootArchetypeId: string;
  nodeCount: number;
  familyCount: number;
  evidencedNodeCount: number;
}

interface ConstellationPayload {
  meta: {
    title: string;
    version: string;
    sourceFingerprint: string;
    visualContract: string;
    counts: {
      nodes: number;
      families: number;
      specificArchetypes: number;
      taxonomyEdges: number;
      affinityEdges: number;
      sourceExamples: number;
      representativeExamples: number;
      corpusSources: number;
    };
  };
  domains: DomainRecord[];
  nodes: ConceptNode[];
  edges: ConceptEdge[];
}

interface Citation {
  url: string;
  locator: string;
  supports: string[];
}

interface CorpusSource {
  sourceId: string;
  title: string;
  creator: string;
  medium: string;
  region: string;
  firstAppearance: string;
  priorityTier: string;
  continuityUnit: string;
  referenceUrl: string;
}

interface SourceAudit {
  source_id: string;
  source_title: string;
  continuity_scope: string;
  work_or_witnesses?: Array<string | { work?: string; edition?: string }>;
  completion_status: string;
  completed_character_count: number;
  citations: Citation[];
  content_cautions?: string[];
  omissions?: string[];
  uncertainties?: string[];
  coverage_rule?: string;
  evidence_basis?: string;
  source_audit?: AuditLimits;
  audit?: AuditLimits;
  independent_review?: { review_types: string[]; unresolved_limits?: string[] };
  review_lanes: Record<"scoped" | "characterPass" | "terminologyPass" | "relationshipPass" | "secondReview" | "continuityReview", ReviewLane>;
}

interface ReviewLane {
  status: "pass-complete" | "reviewed" | "in-progress" | "not-started";
  label: string;
  detail: string;
}

interface AuditLimits {
  omissions?: string[];
  uncertainties?: string[];
  unresolved_limits?: string[];
  cultural_caution?: string;
  second_pass_needed?: string;
}

interface DimensionValue {
  term: string;
  archetype_ids: string[];
  confidence: string;
  note: string;
}

interface ResearchCharacter {
  character_id: string;
  canonical_name: string;
  aliases: string[];
  source_id: string;
  source_title: string;
  continuity: string;
  work_or_witness: string;
  description: string;
  dimensions: Record<string, DimensionValue[]>;
  evidence_level: string;
  canon_status: string;
  citations: Citation[];
  comparison_cautions: string[];
  review_status: string;
}

interface ResearchSourceTerm {
  term_id: string;
  source_id: string;
  work_or_witness: string;
  canonical_term: string;
  identity_forms?: string[];
  original_language: string;
  original_script: string;
  transliteration: string;
  literal_gloss: string;
  dimension: string;
  archetype_ids: string[];
  mapping_relation: string;
  definition: string;
  cultural_caution: string;
  citations: Citation[];
  review_status: string;
}

interface ResearchPayload {
  meta: {
    counts: Record<string, number>;
    qualityWarnings?: string[];
    quarantinedBundles?: string[];
    reviewCoverage?: {
      focusedReviewedSources: number;
      pendingFullSecondReviewSources: number;
    };
  };
  dimensionLabels: Record<string, string>;
  corpusSources: CorpusSource[];
  sources: SourceAudit[];
  characters: ResearchCharacter[];
  relationships: Array<{ relationship_id: string; source_id: string }>;
  sourceTerms: ResearchSourceTerm[];
  taxonomy: Record<string, { name: string; domain: string; parentId: string; tier: number | string }>;
}

type DiscoveryField = [label: string, foldedValue: string, foldedTokens: string[]];

interface DiscoveryLookup {
  termRecords: Map<string, number[]>;
  sortedTerms: string[];
}

interface DiscoveryRecord {
  id: string;
  kind: DiscoveryKind;
  kindLabel: string;
  label: string;
  foldedLabel: string;
  aliases: string[];
  aliasNote?: string;
  sourceId: string;
  sourceTitle: string;
  dimension: string;
  continuity: string;
  work: string;
  characterIds: string[];
  characterExamples: string[];
  relatedConceptIds: string[];
  normalizedConceptIds: string[];
  mappingQuarantined?: boolean;
  conceptId?: string;
  url: string;
  searchFields: DiscoveryField[];
}

interface DiscoveryCoverage {
  label: string;
  acceptedRows: number;
  discoverableRows: number;
  excludedRows: number;
  missingRows: string[];
  exclusionRule: string;
}

interface SourceConnection {
  sourceId: string;
  title: string;
  sharedConceptIds: string[];
}

interface DiscoveryPayload {
  meta: {
    scope: {
      kind: string;
      meaning: string;
      corpusSources: number;
      quarantinedBundles: string[];
    };
    counts: Record<string, number>;
    coverage: Record<string, DiscoveryCoverage>;
    dimensionLabels: Record<string, string>;
    foldingMap: Record<string, string>;
    sourceFingerprint: string;
    normalizationRules: Array<{ id: string; sourceIds: string[]; canonical: string; aliases: string[]; note: string }>;
    sourceConnections: Record<string, SourceConnection[]>;
  };
  records: DiscoveryRecord[];
}

interface PositionedNode {
  node: ConceptNode;
  x: number;
  y: number;
  r: number;
  clusterR: number;
}

interface PackDatum {
  id: string;
  value?: number;
  children?: PackDatum[];
}

interface LocalRelation {
  edge: ConceptEdge | null;
  node: ConceptNode;
  relation: "parent" | "child" | "sibling" | "affinity";
}

interface SelectionContext {
  familyId: string;
  familyMembers: Set<string>;
  affinityMembers: Set<string>;
  related: Set<string>;
}

interface SelectionState {
  nodeId: string | null;
  discoveryId: string | null;
  discoveryContextId: string | null;
  query: string | null;
  origin: SelectionOrigin;
}

const byId = <T extends Element>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing element #${id}`);
  return value as unknown as T;
};

const stage = byId<HTMLElement>("stage");
const svgElement = byId<SVGSVGElement>("atlas-svg");
const board = byId<HTMLDivElement>("coverage-board");
const focusBanner = byId<HTMLElement>("focus-banner");
const focusKicker = byId<HTMLSpanElement>("focus-kicker");
const focusTitle = byId<HTMLElement>("focus-title");
const focusContext = byId<HTMLElement>("focus-context");
const tooltip = byId<HTMLDivElement>("tooltip");
const loading = byId<HTMLDivElement>("loading");
const discoveryNotice = byId<HTMLElement>("discovery-notice");
const lensPanel = byId<HTMLElement>("lens-panel");
const mobileControlsToggle = byId<HTMLButtonElement>("mobile-controls-toggle");
const detailPanel = document.querySelector<HTMLElement>(".detail-panel");
const detailContent = byId<HTMLDivElement>("detail-content");
const searchInput = byId<HTMLInputElement>("search");
const searchResults = byId<HTMLDivElement>("search-results");
const domainFilter = byId<HTMLSelectElement>("domain-filter");
const detailLevelSelect = byId<HTMLSelectElement>("detail-level");
const lineModeSelect = byId<HTMLSelectElement>("line-mode");
const familyFilter = byId<HTMLSelectElement>("family-filter");
const sourceFilter = byId<HTMLSelectElement>("source-filter");
const evidenceFilter = byId<HTMLSelectElement>("evidence-filter");
const constellationControls = byId<HTMLElement>("constellation-controls");
const catalogueControls = byId<HTMLElement>("catalogue-controls");
const zoomControls = byId<HTMLElement>("zoom-controls");
const visibleCount = byId<HTMLSpanElement>("visible-count");
const scopeSummary = byId<HTMLDivElement>("scope-summary");
const legendTitle = byId<HTMLHeadingElement>("legend-title");
const colorLegend = byId<HTMLDivElement>("color-legend");
const legendNote = document.querySelector<HTMLParagraphElement>(".legend-note");
const viewKicker = byId<HTMLParagraphElement>("view-kicker");
const viewDescription = byId<HTMLParagraphElement>("view-description");
const statusSummary = byId<HTMLDivElement>("status-summary");

const familyPalette = [
  "#70d6c8",
  "#75bff3",
  "#a99af6",
  "#d990df",
  "#ef91ae",
  "#f3a670",
  "#efc87a",
  "#a8dc78",
  "#69c8a5",
  "#90a9ef",
  "#c2b4f2",
];
const touchTargetRadius = 22;
const searchResultPageSize = 12;

let dimensionLabels: Record<string, string> = {};

const viewCopy: Record<ViewMode, [string, string]> = {
  constellations: [
    "Concept constellations",
    "Large stars are families; smaller stars are specific race, being/entity, class, or vocation archetypes.",
  ],
  catalogue: [
    "Organized catalogue",
    "Browse the same concepts as readable family cards instead of spatial marks.",
  ],
  relations: [
    "Local concept relations",
    "Only the selected concept, its taxonomy neighbors, siblings, and evidence-backed affinities appear.",
  ],
  research: [
    "Research foundation",
    "The source corpus remains auditable without appearing as graph nodes.",
  ],
};

let concepts: ConstellationPayload;
let research: ResearchPayload;
let discovery: DiscoveryPayload | undefined;
let viewMode: ViewMode = "constellations";
let selection: SelectionState = {
  nodeId: null,
  discoveryId: null,
  discoveryContextId: null,
  query: null,
  origin: null,
};
let selectedDomain = "" as "" | DomainId;
let selectedFamily = "";
let selectedSource = "";
let selectedEvidence: EvidenceFilter = "";
let detailLevel: DetailLevel = "auto";
let researchQuery = "";
let lastSearchQuery = "";
let foldingMap: Record<string, string> = {};
let discoveryLookup: DiscoveryLookup = { termRecords: new Map(), sortedTerms: [] };
let currentZoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
let currentTransform = d3.zoomIdentity;
let resizeTimer = 0;
let rovingNodeId: string | null = null;

const nodeById = new Map<string, ConceptNode>();
let visibleNodes: ConceptNode[] = [];
const visibleNodeById = new Map<string, ConceptNode>();
const domainById = new Map<DomainId, DomainRecord>();
const auditBySource = new Map<string, SourceAudit>();
const corpusBySource = new Map<string, CorpusSource>();
const characterById = new Map<string, ResearchCharacter>();
const sourceTermById = new Map<string, ResearchSourceTerm>();
const positionById = new Map<string, PositionedNode>();
const familyColor = new Map<string, string>();
const taxonomyEdges: ConceptEdge[] = [];
const affinityEdges: ConceptEdge[] = [];
let visibleAffinityEdges: ConceptEdge[] = [];

function clearSelection(): void {
  selection = {
    nodeId: null,
    discoveryId: null,
    discoveryContextId: null,
    query: null,
    origin: null,
  };
}

function setNodeSelection(
  nodeId: string | null,
  origin: SelectionOrigin,
  discoveryContextId: string | null = null,
): void {
  if (!nodeId) {
    clearSelection();
    return;
  }
  selection = {
    nodeId,
    discoveryId: null,
    discoveryContextId,
    query: null,
    origin,
  };
}

function setDiscoverySelection(record: DiscoveryRecord, query: string): void {
  const nodeId = record.conceptId ?? record.relatedConceptIds[0] ?? null;
  selection = {
    nodeId,
    discoveryId: record.id,
    discoveryContextId: null,
    query,
    origin: nodeId ? "search" : null,
  };
}

function downgradeSelectionToConcept(): void {
  selection = {
    nodeId: selection.nodeId,
    discoveryId: null,
    discoveryContextId: null,
    query: null,
    origin: selection.nodeId ? "click" : null,
  };
}

function detachSelectionQuery(): void {
  selection = { ...selection, query: null };
}

function setConceptScopeFilter(domain: "" | DomainId = "", familyId = ""): void {
  const family = familyId ? nodeById.get(familyId) : undefined;
  selectedFamily = family?.tier === 2 ? family.id : "";
  selectedDomain = family?.tier === 2 ? family.domainId : domain;
  domainFilter.value = selectedDomain;
  familyFilter.value = selectedFamily;
}

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const value = document.createElement(tag);
  if (className) value.className = className;
  if (text !== undefined) value.textContent = text;
  return value;
};

function titleCase(value: string): string {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactLabel(value: string, maximum = 34): string {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 1).trimEnd()}…`;
}

function foldSearchToken(value: string): string {
  const lowered = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return [...lowered]
    .map((character) => foldingMap[character] ?? character)
    .join("")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function foldSearchTokens(value: string): string[] {
  const normalized = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return normalized.split(/[^\p{Letter}\p{Number}]+/gu).map(foldSearchToken).filter(Boolean);
}

function foldSearch(value: string): string {
  return foldSearchToken(value);
}

function motionDuration(duration: number): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
}

function updateScreenSpaceHitAreas(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  transform: d3.ZoomTransform,
): void {
  svg.selectAll<SVGCircleElement, PositionedNode>(".star-hit-area").attr("r", touchTargetRadius / transform.k);
}

function closestRenderedNode(
  event: MouseEvent,
  layer: SVGGElement | null,
  marks: SVGGElement[],
): PositionedNode | undefined {
  const matrix = layer?.getScreenCTM();
  if (!matrix) return undefined;
  let closest: { positioned: PositionedNode; distance: number } | undefined;
  for (const mark of marks) {
    if (getComputedStyle(mark).display === "none") continue;
    const positioned = d3.select<SVGGElement, PositionedNode>(mark).datum();
    const center = new DOMPoint(positioned.x, positioned.y).matrixTransform(matrix);
    const distance = Math.hypot(event.clientX - center.x, event.clientY - center.y);
    if (distance <= touchTargetRadius && (!closest || distance < closest.distance)) closest = { positioned, distance };
  }
  return closest?.positioned;
}

function auditStatusPresentation(audit: SourceAudit | undefined): { label: string; className: string; caution: string } {
  if (!audit) return { label: "missing", className: "not-started", caution: "No source audit is recorded." };
  const label = audit.completion_status.trim() || "status-not-recorded";
  const normalized = label.toLowerCase();
  const limited = normalized.includes("insufficient") || normalized.includes("narrow");
  const className = limited ? "in-progress" : normalized.includes("complete") || normalized.includes("pass") ? "complete" : "not-started";
  const nestedLimits = [audit.source_audit, audit.audit].filter((value): value is AuditLimits => Boolean(value));
  const recordedLimits = [...new Set([
    ...(audit.content_cautions ?? []),
    ...(audit.omissions ?? []).map((value) => `Omission: ${value}`),
    ...(audit.uncertainties ?? []).map((value) => `Uncertainty: ${value}`),
    ...(audit.independent_review?.unresolved_limits ?? []).map((value) => `Review limit: ${value}`),
    ...(audit.coverage_rule ? [`Coverage rule: ${audit.coverage_rule}`] : []),
    ...nestedLimits.flatMap((details) => [
      ...(details.omissions ?? []).map((value) => `Omission: ${value}`),
      ...(details.uncertainties ?? []).map((value) => `Uncertainty: ${value}`),
      ...(details.unresolved_limits ?? []).map((value) => `Review limit: ${value}`),
      ...(details.cultural_caution ? [details.cultural_caution] : []),
      ...(details.second_pass_needed ? [`Review note: ${details.second_pass_needed}`] : []),
    ]),
  ].filter(Boolean))];
  const caution = recordedLimits.length
    ? `Recorded limits: ${recordedLimits.join(" ")}`
    : limited
      ? "This audit is intentionally limited and does not establish character-level completeness."
      : "No additional caution recorded beyond the bounded corpus scope.";
  return { label, className, caution };
}

function laneClassName(status: ReviewLane["status"]): string {
  if (status === "not-started") return "not-started";
  if (status === "in-progress") return "in-progress";
  return "complete";
}

function sourceScopeLabel(sourceId: string): string {
  return [...new Set((auditBySource.get(sourceId)?.work_or_witnesses ?? []).map((witness) =>
    typeof witness === "string"
      ? witness.trim()
      : [witness.work, witness.edition].filter(Boolean).join(" · ").trim(),
  ).filter(Boolean))].join("; ");
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

function discoveryRecordById(id: string | null): DiscoveryRecord | undefined {
  return id ? discovery?.records.find((record) => record.id === id) : undefined;
}

function normalizedFamilyLabel(conceptId: string): string {
  let currentId = conceptId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const taxonomy = research.taxonomy[currentId];
    if (!taxonomy) break;
    if (Number(taxonomy.tier) === 2) return `${taxonomy.name} (${currentId})`;
    currentId = taxonomy.parentId;
  }
  const node = nodeById.get(conceptId);
  const family = node ? nodeById.get(node.familyId) ?? node : undefined;
  return family ? `${family.label} (${family.id})` : "";
}

function buildDiscoveryLookup(records: DiscoveryRecord[]): DiscoveryLookup {
  const termRecords = new Map<string, number[]>();
  records.forEach((record, recordIndex) => {
    const terms = new Set<string>();
    for (const field of record.searchFields) {
      const foldedValue = field[1];
      const foldedTokens = field[2];
      if (foldedValue) terms.add(foldedValue);
      foldedTokens.forEach((token) => terms.add(token));
      for (let start = 0; start + 1 < foldedTokens.length; start += 1) {
        terms.add(foldedTokens.slice(start).join(""));
      }
    }
    for (const term of terms) {
      const indexes = termRecords.get(term);
      if (indexes) indexes.push(recordIndex);
      else termRecords.set(term, [recordIndex]);
    }
  });
  return { termRecords, sortedTerms: [...termRecords.keys()].sort() };
}

function lowerBound(values: string[], target: string): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (values[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function recordsForTermPrefix(prefix: string, indexes: Set<number>): void {
  if (!prefix) return;
  for (let position = lowerBound(discoveryLookup.sortedTerms, prefix); position < discoveryLookup.sortedTerms.length; position += 1) {
    const term = discoveryLookup.sortedTerms[position];
    if (!term.startsWith(prefix)) break;
    for (const index of discoveryLookup.termRecords.get(term) ?? []) indexes.add(index);
  }
}

function discoveryCandidates(query: string, foldedQuery: string): DiscoveryRecord[] {
  const payload = discovery;
  if (!payload) return [];
  const queryTokens = foldSearchTokens(query);
  const indexes = new Set<number>();
  recordsForTermPrefix(foldedQuery, indexes);
  if (queryTokens.length > 1) recordsForTermPrefix(queryTokens[0], indexes);
  return [...indexes].map((index) => payload.records[index]);
}

function hasFoldedTokenWindow(tokens: string[], foldedQuery: string): boolean {
  for (let start = 0; start < tokens.length; start += 1) {
    let joined = "";
    for (let end = start; end < tokens.length; end += 1) {
      joined += tokens[end];
      if (joined === foldedQuery || joined.startsWith(foldedQuery)) return true;
      if (!foldedQuery.startsWith(joined)) break;
    }
  }
  return false;
}

function matchedDiscoveryFields(record: DiscoveryRecord, foldedQuery: string): string[] {
  if (!foldedQuery) return [];
  return [...new Set(
    record.searchFields
      .filter(([, foldedValue, foldedTokens]) => foldedValue === foldedQuery
        || foldedValue.startsWith(foldedQuery)
        || foldedTokens.some((token) => token === foldedQuery || token.startsWith(foldedQuery))
        || hasFoldedTokenWindow(foldedTokens, foldedQuery))
      .map(([label]) => label),
  )];
}

function discoveryMatchScore(record: DiscoveryRecord, foldedQuery: string, fields: string[]): number {
  const label = record.foldedLabel;
  const alias = fields.includes("alias");
  const kindWeight: Record<DiscoveryKind, number> = {
    concept: 24,
    character: 19,
    "source-term": 18,
    "dimension-term": 14,
    source: 10,
  };
  return kindWeight[record.kind]
    + (label === foldedQuery ? 80 : label.startsWith(foldedQuery) ? 50 : label.includes(foldedQuery) ? 24 : 0)
    + (alias ? 62 : 0)
    + Math.max(0, 12 - fields.length);
}

function discoveryMatches(query: string): Array<{ record: DiscoveryRecord; fields: string[] }> {
  if (!discovery) return [];
  const foldedQuery = foldSearch(query);
  if (!foldedQuery) return [];
  return discoveryCandidates(query, foldedQuery)
    .map((record) => ({ record, fields: matchedDiscoveryFields(record, foldedQuery) }))
    .filter(({ fields }) => fields.length > 0)
    .sort((left, right) => {
      const leftScore = discoveryMatchScore(left.record, foldedQuery, left.fields);
      const rightScore = discoveryMatchScore(right.record, foldedQuery, right.fields);
      return d3.descending(leftScore, rightScore)
        || d3.ascending(left.record.label, right.record.label)
        || d3.ascending(left.record.id, right.record.id);
    });
}

function discoverySourceIds(query: string): Set<string> {
  const sourceIds = new Set<string>();
  for (const { record } of discoveryMatches(query)) {
    if (record.sourceId) sourceIds.add(record.sourceId);
    if (record.kind !== "concept") continue;
    for (const conceptId of [record.conceptId, ...record.relatedConceptIds]) {
      const node = conceptId ? nodeById.get(conceptId) : undefined;
      node?.sourceIds.forEach((sourceId) => sourceIds.add(sourceId));
    }
  }
  return sourceIds;
}

const chartFamilyLabels = new Map<string, string>([
  ["Mortal and Natural Peoples", "Mortal Peoples"],
  ["Shapeshifters, Hybrids, and Mutable Peoples", "Shapeshifters & Hybrids"],
  ["Cosmic, Aberrant, and Otherworldly Beings", "Cosmic & Otherworldly"],
  ["Fae, Nature, and Liminal Beings", "Fae & Liminal"],
  ["Spirits and Elementals", "Spirits & Elementals"],
  ["Divine and Celestial Beings", "Divine & Celestial"],
  ["Infernal and Corruptive Beings", "Infernal & Corruptive"],
  ["Undead Beings", "Undead"],
  ["Constructs and Artificial Life", "Constructs"],
  ["Dragons and Legendary Beasts", "Dragons & Great Beasts"],
  ["Plant, Fungal, Ooze, and Collective Life", "Plant, Ooze & Collective"],
  ["Martial Roles", "Martial"],
  ["Rogue and Underworld Roles", "Rogues & Underworld"],
  ["Arcane and Scholarly Magic Roles", "Arcane & Scholarly"],
  ["Divine and Religious Roles", "Divine & Religious"],
  ["Nature and Spirit Roles", "Nature & Spirit"],
  ["Healing, Craft, and Knowledge Roles", "Healing, Craft & Knowledge"],
  ["Leadership and Social Office Roles", "Leadership & Social"],
  ["Hybrid and Specialist Fantasy Roles", "Hybrid & Specialist"],
  ["Progression, Cultivation, and Adventure Roles", "Progression & Cultivation"],
]);

function chartLabel(node: ConceptNode): string {
  return node.tier === 2 ? chartFamilyLabels.get(node.label) ?? compactLabel(node.label, 24) : compactLabel(node.label, 24);
}

function colorFor(node: ConceptNode): string {
  return familyColor.get(node.familyId) ?? domainById.get(node.domainId)?.color ?? "#a7b5c9";
}

function passesLeafFilters(node: ConceptNode): boolean {
  if (node.tier !== 3) return false;
  if (selectedDomain && node.domainId !== selectedDomain) return false;
  if (selectedFamily && node.familyId !== selectedFamily) return false;
  if (selectedSource && !node.sourceIds.includes(selectedSource)) return false;
  if (selectedEvidence === "evidenced" && node.evidenceCount === 0) return false;
  if (selectedEvidence === "framework" && node.evidenceCount > 0) return false;
  return true;
}

function sourceScopedLeaf(node: ConceptNode): ConceptNode {
  if (!selectedSource) return node;
  const evidenceMemberships = node.evidenceMemberships.filter((membership) => membership.sourceId === selectedSource);
  const directEvidenceMemberships = node.directEvidenceMemberships.filter((membership) => membership.sourceId === selectedSource);
  const descendantEvidenceMemberships = node.descendantEvidenceMemberships.filter((membership) => membership.sourceId === selectedSource);
  const examples = node.examples.filter((example) => example.sourceId === selectedSource);
  const sourceIds = [...new Set(evidenceMemberships.map((membership) => membership.sourceId))];
  return {
    ...node,
    evidenceCount: evidenceMemberships.length,
    sourceCount: sourceIds.length,
    sourceIds,
    directEvidenceMemberships,
    descendantEvidenceMemberships,
    evidenceMemberships,
    examples,
  };
}

function evidenceMembershipKey(membership: EvidenceMembership | ConstellationExample): string {
  return `${membership.kind}:${membership.id}:${membership.sourceId}`;
}

function filteredDirectFamilyMemberships(family: ConceptNode): EvidenceMembership[] {
  if (selectedEvidence === "framework") return [];
  return family.directEvidenceMemberships.filter((membership) => !selectedSource || membership.sourceId === selectedSource);
}

function filteredFamily(family: ConceptNode, leaves: ConceptNode[]): ConceptNode {
  if (!selectedSource && !selectedEvidence) return family;
  const evidenceMemberships = new Map<string, EvidenceMembership>();
  const directEvidenceMemberships = filteredDirectFamilyMemberships(family);
  const descendantEvidenceMemberships = new Map<string, EvidenceMembership>();
  for (const membership of directEvidenceMemberships) {
    evidenceMemberships.set(evidenceMembershipKey(membership), membership);
  }
  for (const leaf of leaves) {
    for (const membership of leaf.evidenceMemberships) {
      const key = evidenceMembershipKey(membership);
      descendantEvidenceMemberships.set(key, membership);
      evidenceMemberships.set(key, membership);
    }
  }
  const examples: ConstellationExample[] = [];
  const includedExamples = new Set<string>();
  for (const example of [family.examples, ...leaves.map((leaf) => leaf.examples)].flat()) {
    const key = evidenceMembershipKey(example);
    if (!evidenceMemberships.has(key) || includedExamples.has(key)) continue;
    examples.push(example);
    includedExamples.add(key);
  }
  const memberships = [...evidenceMemberships.values()];
  const sourceIds = [...new Set(memberships.map((membership) => membership.sourceId))].sort();
  const childIds = leaves.map((node) => node.id);
  return {
    ...family,
    childIds,
    descendantCount: childIds.length,
    evidenceCount: memberships.length,
    sourceCount: sourceIds.length,
    sourceIds,
    directEvidenceMemberships,
    descendantEvidenceMemberships: [...descendantEvidenceMemberships.values()],
    evidenceMemberships: memberships,
    examples,
  };
}

function rebuildVisibleConcepts(): void {
  const leaves = concepts.nodes.filter(passesLeafFilters).map(sourceScopedLeaf);
  const leavesByFamily = new Map<string, ConceptNode[]>();
  for (const leaf of leaves) {
    const familyLeaves = leavesByFamily.get(leaf.familyId) ?? [];
    familyLeaves.push(leaf);
    leavesByFamily.set(leaf.familyId, familyLeaves);
  }
  const families = concepts.nodes
    .filter((node) => node.tier === 2)
    .filter((node) => !selectedDomain || node.domainId === selectedDomain)
    .filter((node) => !selectedFamily || node.id === selectedFamily)
    .filter((node) => leavesByFamily.has(node.id) || filteredDirectFamilyMemberships(node).length > 0)
    .map((family) => filteredFamily(family, leavesByFamily.get(family.id) ?? []));
  visibleNodes = [...families, ...leaves];
  visibleNodeById.clear();
  for (const node of visibleNodes) visibleNodeById.set(node.id, node);
}

function rebuildVisibleAffinities(): void {
  visibleAffinityEdges = affinityEdges.flatMap((edge) => {
    const source = visibleNodeById.get(edge.source);
    const target = visibleNodeById.get(edge.target);
    if (!source || !target || selectedEvidence === "framework") return [];
    const sourceMemberships = new Set(source.evidenceMemberships.map(evidenceMembershipKey));
    const targetMemberships = new Set(target.evidenceMemberships.map(evidenceMembershipKey));
    const evidence = (edge.evidence ?? []).filter((membership) => {
      const key = evidenceMembershipKey(membership);
      return sourceMemberships.has(key) && targetMemberships.has(key);
    });
    if (!evidence.length) return [];
    return [{ ...edge, weight: evidence.length, evidence }];
  });
}

function visibleConcepts(): ConceptNode[] {
  return visibleNodes;
}

function updateLegend(): void {
  legendTitle.textContent = viewMode === "relations" ? "Relationship grammar" : "How to read the sky";
  if (legendNote) {
    legendNote.textContent = viewMode === "relations"
      ? "This is a bounded neighborhood around one concept. Line styles encode relation type; unrelated stars stay outside the scene."
      : "Large named stars are families. Small stars are specific archetypes. Characters, sources, artifacts, and powers appear only as evidence in the detail panel.";
  }
  colorLegend.replaceChildren();
  const items: Array<[string, string, string]> = viewMode === "relations"
    ? [
        ["#efc87a", "Parent family", "solid gold"],
        ["#70d6c8", "Subtype", "solid teal"],
        ["#a99af6", "Shared source evidence", "violet dash"],
        ["#718097", "Sibling archetype", "faint dots"],
      ]
    : [
        ["#70d6c8", "Beings & Peoples", "teal field"],
        ["#efc87a", "Classes & Vocations", "gold field"],
        ["#edf3fb", "Color identifies family", "large star"],
        ["#a99af6", "Evidence affinity", "selection only"],
      ];
  for (const [color, label, note] of items) {
    const row = element("div", "legend-item");
    const swatch = element("span", "legend-swatch");
    swatch.style.background = color;
    swatch.style.color = color;
    row.append(swatch, element("span", "legend-value", label), element("strong", "", note));
    colorLegend.append(row);
  }
}

function updateScopeFacts(facts: Array<[number, string]>): void {
  scopeSummary.replaceChildren();
  for (const [count, label] of facts) {
    const fact = element("div", "scope-fact");
    fact.append(element("strong", "", count.toLocaleString()), element("span", "", label));
    scopeSummary.append(fact);
  }
}

function updateScope(nodes = visibleConcepts()): void {
  const leafCount = nodes.filter((node) => node.tier === 3).length;
  const familyCount = nodes.filter((node) => node.tier === 2).length;
  const evidencedCount = nodes.filter((node) => node.evidenceCount > 0).length;
  const sourceCount = new Set(nodes.flatMap((node) => node.sourceIds)).size;
  visibleCount.textContent = `${nodes.length.toLocaleString()} concept stars`;
  updateScopeFacts([
    [familyCount, "constellations"],
    [leafCount, "specific archetypes"],
    [evidencedCount, "evidenced stars"],
    [sourceCount, "mapped sources"],
  ]);
  statusSummary.textContent = `${concepts.meta.counts.nodes.toLocaleString()} class/race/entity stars · ${concepts.meta.counts.families} constellations · ${concepts.meta.counts.corpusSources} researched sources beneath the map`;
}

function stageSize(): [number, number] {
  return [Math.max(320, stage.clientWidth), Math.max(360, stage.clientHeight)];
}

function clearStage(): d3.Selection<SVGSVGElement, unknown, null, undefined> {
  board.hidden = true;
  svgElement.style.display = "";
  hideTooltip();
  const svg = d3.select(svgElement);
  svg.interrupt();
  svg.selectAll("*").remove();
  svg.on(".zoom", null);
  currentZoom = null;
  currentTransform = d3.zoomIdentity;
  positionById.clear();
  const [width, height] = stageSize();
  svg
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "group")
    .attr("aria-labelledby", "atlas-map-title");
  svg.append("title").attr("id", "atlas-map-title").text("Interactive class, race, and entity constellation map");
  return svg;
}

function installDefinitions(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>): void {
  const defs = svg.append("defs");
  const glow = defs.append("filter").attr("id", "star-glow").attr("x", "-200%").attr("y", "-200%").attr("width", "400%").attr("height", "400%");
  glow.append("feGaussianBlur").attr("stdDeviation", 3.2).attr("result", "blur");
  const merge = glow.append("feMerge");
  merge.append("feMergeNode").attr("in", "blur");
  merge.append("feMergeNode").attr("in", "SourceGraphic");
  for (const domain of concepts.domains) {
    const gradient = defs.append("radialGradient").attr("id", `sky-${domain.id}`);
    gradient.append("stop").attr("offset", "0%").attr("stop-color", domain.color).attr("stop-opacity", 0.09);
    gradient.append("stop").attr("offset", "74%").attr("stop-color", domain.color).attr("stop-opacity", 0.018);
    gradient.append("stop").attr("offset", "100%").attr("stop-color", domain.color).attr("stop-opacity", 0);
  }
}

function installZoom(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  layer: d3.Selection<SVGGElement, unknown, null, undefined>,
  onZoom: (transform: d3.ZoomTransform) => void,
): void {
  currentZoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.72, 16])
    .on("zoom", (event) => {
      currentTransform = event.transform;
      layer.attr("transform", event.transform.toString());
      onZoom(event.transform);
    });
  svg.call(currentZoom).on("dblclick.zoom", null);
}

function computeLayout(width: number, height: number, nodes: ConceptNode[]): Array<{ domain: DomainRecord; x: number; y: number; w: number; h: number; r: number }> {
  const domains = concepts.domains.filter((domain) => !selectedDomain || domain.id === selectedDomain);
  const domainFields: Array<{ domain: DomainRecord; x: number; y: number; w: number; h: number; r: number }> = [];
  const stackDomains = width < 720 && domains.length > 1;
  const zoneWidth = stackDomains ? width : width / Math.max(domains.length, 1);
  const zoneHeight = stackDomains ? height / domains.length : height;
  const familyNodes = nodes.filter((node) => node.tier === 2);
  const leafNodes = nodes.filter((node) => node.tier === 3);

  for (const [domainIndex, domain] of domains.entries()) {
    const x = stackDomains ? 18 : domainIndex * zoneWidth + 18;
    const y = stackDomains ? domainIndex * zoneHeight + 42 : 54;
    const w = zoneWidth - 36;
    const h = stackDomains ? zoneHeight - 58 : height - 88;
    const domainFamilies = familyNodes.filter((node) => node.domainId === domain.id);
    if (width < 720) {
      const columns = domainFamilies.length > 9 ? 4 : 3;
      const rows = Math.ceil(domainFamilies.length / columns);
      const cellWidth = w / columns;
      const cellHeight = h / rows;
      domainFields.push({ domain, x, y, w, h, r: Math.min(w, h) * 0.49 });
      domainFamilies.forEach((family, familyIndex) => {
        const column = familyIndex % columns;
        const row = Math.floor(familyIndex / columns);
        const familyX = x + (column + 0.5) * cellWidth;
        const familyY = y + (row + 0.43) * cellHeight;
        const clusterR = Math.max(19, Math.min(cellWidth, cellHeight) * 0.27);
        const familyR = Math.min(8, 5.2 + Math.sqrt(family.evidenceCount + family.childIds.length) * 0.22);
        positionById.set(family.id, { node: family, x: familyX, y: familyY, r: familyR, clusterR });
        const children = leafNodes
          .filter((node) => node.familyId === family.id)
          .sort((left, right) => d3.descending(left.evidenceCount, right.evidenceCount) || d3.ascending(left.label, right.label));
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const usableRadius = Math.max(10, clusterR - 8);
        children.forEach((child, index) => {
          const fraction = children.length <= 1 ? 0 : Math.sqrt((index + 0.5) / children.length);
          const angle = index * goldenAngle + (family.domainId === "classes" ? 0.6 : 0);
          const radial = usableRadius * fraction;
          const childR = 1.45 + Math.min(1.7, Math.sqrt(child.evidenceCount) * 0.22);
          positionById.set(child.id, {
            node: child,
            x: familyX + Math.cos(angle) * radial,
            y: familyY + Math.sin(angle) * radial,
            r: childR,
            clusterR: childR,
          });
        });
      });
      continue;
    }
    const tree: PackDatum = {
      id: domain.id,
      children: domainFamilies.map((family) => ({
        id: family.id,
        value: Math.max(10, leafNodes.filter((node) => node.familyId === family.id).length + 8),
      })),
    };
    const root = d3
      .pack<PackDatum>()
      .size([Math.max(120, w), Math.max(150, h)])
      .padding(15)(d3.hierarchy(tree).sum((datum) => datum.value ?? 0));
    const fieldR = Math.min(root.r, Math.min(w, h) * 0.49);
    domainFields.push({ domain, x, y, w, h, r: fieldR });

    for (const packedFamily of root.children ?? []) {
      const family = visibleNodeById.get(packedFamily.data.id);
      if (!family) continue;
      const familyX = x + packedFamily.x;
      const familyY = y + packedFamily.y;
      const clusterR = packedFamily.r;
      const familyR = Math.min(9, 5.5 + Math.sqrt(family.evidenceCount + family.childIds.length) * 0.28);
      positionById.set(family.id, { node: family, x: familyX, y: familyY, r: familyR, clusterR });
      const children = leafNodes
        .filter((node) => node.familyId === family.id)
        .sort((left, right) => d3.descending(left.evidenceCount, right.evidenceCount) || d3.ascending(left.label, right.label));
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const usableRadius = Math.max(12, clusterR - 13);
      children.forEach((child, index) => {
        const fraction = children.length <= 1 ? 0 : Math.sqrt((index + 0.6) / children.length);
        const angle = index * goldenAngle + (family.domainId === "classes" ? 0.6 : 0);
        const radial = usableRadius * fraction;
        const childR = 1.75 + Math.min(2.1, Math.sqrt(child.evidenceCount) * 0.27);
        positionById.set(child.id, {
          node: child,
          x: familyX + Math.cos(angle) * radial,
          y: familyY + Math.sin(angle) * radial,
          r: childR,
          clusterR: childR,
        });
      });
    }
  }
  return domainFields;
}

function starPath(outer: number, inner: number, points = 5): string {
  const commands: string[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / points;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    commands.push(`${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return `${commands.join(" ")} Z`;
}

function showTooltip(event: MouseEvent, node: ConceptNode): void {
  tooltip.replaceChildren();
  tooltip.append(element("strong", "", node.label));
  tooltip.append(element("span", "", node.tier === 2 ? "Constellation family" : node.domainLabel));
  tooltip.append(element("small", "", `${node.sourceCount} mapped sources · ${node.evidenceCount} examples`));
  const bounds = stage.getBoundingClientRect();
  tooltip.style.left = `${Math.min(bounds.width - 270, Math.max(12, event.clientX - bounds.left + 14))}px`;
  tooltip.style.top = `${Math.min(bounds.height - 115, Math.max(12, event.clientY - bounds.top + 14))}px`;
  tooltip.hidden = false;
}

function accessibleNodeLabel(node: ConceptNode): string {
  return `${node.label}, ${node.tier === 2 ? "constellation family" : node.domainLabel}, ${node.evidenceCount} evidence examples`;
}

function activateNode(positioned: PositionedNode, refreshRelationView = true): void {
  const focusAfterActivation = document.activeElement === document.querySelector(`[data-node-id="${positioned.node.id}"]`)
    || document.activeElement?.classList.contains("concept-star") === true;
  const relationFocusAfterActivation = focusAfterActivation && viewMode === "relations";
  selectNode(positioned.node.id, false, "click", null, refreshRelationView);
  if (focusAfterActivation && viewMode === "constellations") focusDetailHeading();
  if (relationFocusAfterActivation) {
    requestAnimationFrame(() => {
      const nextMark = [...document.querySelectorAll<SVGGElement>("#atlas-svg .relation-star")]
        .find((mark) => mark.dataset.nodeId === positioned.node.id && mark.isConnected);
      nextMark?.focus();
    });
  }
  if (positioned.node.tier === 2 && viewMode === "constellations") zoomToNode(positioned.node.id);
}

function renderedNodeMarks(): SVGGElement[] {
  return [...svgElement.querySelectorAll<SVGGElement>(".concept-star")]
    .filter((mark) => mark.isConnected && getComputedStyle(mark).display !== "none");
}

function setRovingNode(nodeId: string, focus = false): void {
  svgElement.querySelectorAll<SVGGElement>(".concept-star")
    .forEach((mark) => mark.setAttribute("tabindex", "-1"));
  const marks = renderedNodeMarks();
  const target = marks.find((mark) => mark.dataset.nodeId === nodeId);
  if (!target) return;
  rovingNodeId = nodeId;
  target.setAttribute("tabindex", "0");
  if (focus) target.focus();
}

function directionalNode(positioned: PositionedNode, key: string): PositionedNode | undefined {
  const candidates = renderedNodeMarks()
    .map((mark) => d3.select<SVGGElement, PositionedNode>(mark).datum())
    .filter((candidate) => candidate.node.id !== positioned.node.id)
    .map((candidate) => {
      const dx = candidate.x - positioned.x;
      const dy = candidate.y - positioned.y;
      const primary = key === "ArrowLeft" ? -dx : key === "ArrowRight" ? dx : key === "ArrowUp" ? -dy : dy;
      const secondary = key === "ArrowLeft" || key === "ArrowRight" ? Math.abs(dy) : Math.abs(dx);
      return { candidate, primary, secondary };
    })
    .filter(({ primary }) => primary > 0)
    .sort((left, right) => (left.primary + left.secondary * 1.8) - (right.primary + right.secondary * 1.8));
  return candidates[0]?.candidate;
}

function handleNodeKeydown(event: KeyboardEvent, positioned: PositionedNode): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    activateNode(positioned);
    return;
  }
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  const marks = renderedNodeMarks();
  const ordered = marks
    .map((mark) => d3.select<SVGGElement, PositionedNode>(mark).datum())
    .sort((left, right) => left.y - right.y || left.x - right.x || d3.ascending(left.node.id, right.node.id));
  const next = event.key === "Home"
    ? ordered[0]
    : event.key === "End"
      ? ordered.at(-1)
      : directionalNode(positioned, event.key);
  if (next) setRovingNode(next.node.id, true);
}

function hideTooltip(): void {
  tooltip.hidden = true;
}

function selectionContext(node: ConceptNode): SelectionContext {
  const familyId = node.tier === 2 ? node.id : node.familyId;
  const familyMembers = new Set(
    visibleNodes
      .filter((candidate) => candidate.id === familyId || candidate.familyId === familyId)
      .map((candidate) => candidate.id),
  );
  const affinityMembers = new Set<string>();
  for (const edge of visibleAffinityEdges) {
    if (edge.source === node.id && visibleNodeById.has(edge.target)) affinityMembers.add(edge.target);
    if (edge.target === node.id && visibleNodeById.has(edge.source)) affinityMembers.add(edge.source);
  }
  const related = new Set<string>([node.id, ...familyMembers, ...affinityMembers]);
  return { familyId, familyMembers, affinityMembers, related };
}

function focusLabelIds(node: ConceptNode, context: SelectionContext, includePeers: boolean): Set<string> {
  const labels = new Set<string>([node.id, ...context.affinityMembers]);
  if (!includePeers) return labels;
  const closestPeers = visibleNodes
    .filter((candidate) => candidate.tier === 3 && candidate.familyId === context.familyId && candidate.id !== node.id)
    .sort((left, right) => d3.descending(left.evidenceCount, right.evidenceCount) || d3.ascending(left.label, right.label))
    .slice(0, 6);
  for (const peer of closestPeers) labels.add(peer.id);
  return labels;
}

function updateConstellationSelection(): void {
  const selected = selection.nodeId ? visibleNodeById.get(selection.nodeId) : undefined;
  const context = selected ? selectionContext(selected) : undefined;
  const svg = d3.select(svgElement);
  svg
    .selectAll<SVGGElement, PositionedNode>(".concept-star")
    .classed("is-selected", (positioned) => positioned.node.id === selection.nodeId)
    .classed("is-family-member", (positioned) => Boolean(context?.familyMembers.has(positioned.node.id)))
    .classed("is-affinity-related", (positioned) => Boolean(context?.affinityMembers.has(positioned.node.id)))
    .classed("is-related", (positioned) => Boolean(context?.related.has(positioned.node.id)))
    .classed("is-dimmed", (positioned) => Boolean(context && !context.related.has(positioned.node.id)));
}

function updateSemanticZoom(transform: d3.ZoomTransform): void {
  const svg = d3.select(svgElement);
  const filtersActive = Boolean(selectedSource || selectedEvidence || selectedFamily);
  const compactViewport = stage.clientWidth < 620;
  const selected = selection.nodeId ? visibleNodeById.get(selection.nodeId) : undefined;
  const context = selected ? selectionContext(selected) : undefined;
  const focusedLabels = selected && context ? focusLabelIds(selected, context, transform.k >= 2.8) : new Set<string>();
  const familyPosition = context ? positionById.get(context.familyId) : undefined;
  const showSpecific = Boolean(selected) || detailLevel === "all" || (detailLevel === "auto" && (!compactViewport || transform.k >= 1.3));
  const showSpecificLabels =
    detailLevel === "all" ? transform.k >= 1.5 : transform.k >= (filtersActive ? 2.25 : 3.35);
  const compactFamilyLabels = new Set<string>();
  if (compactViewport) {
    for (const domain of concepts.domains) {
      [...positionById.values()]
        .filter((positioned) => positioned.node.tier === 2 && positioned.node.domainId === domain.id)
        .sort((left, right) => d3.descending(left.node.evidenceCount, right.node.evidenceCount) || d3.ascending(left.node.label, right.node.label))
        .slice(0, 4)
        .forEach((positioned) => compactFamilyLabels.add(positioned.node.id));
    }
  }
  const labelBudget = compactViewport ? 8 : stage.clientWidth < 1100 ? 16 : 24;
  const familyLabelBudget = compactViewport ? 8 : 12;
  const familyLabelCandidates = [...positionById.values()]
    .filter((positioned) => positioned.node.tier === 2)
    .filter((positioned) => selected
      ? positioned.node.id === context?.familyId
      : !compactViewport || compactFamilyLabels.has(positioned.node.id))
    .sort((left, right) =>
      Number(right.node.id === context?.familyId) - Number(left.node.id === context?.familyId)
      || d3.descending(left.node.evidenceCount, right.node.evidenceCount)
      || d3.ascending(left.node.label, right.node.label)
      || d3.ascending(left.node.id, right.node.id));
  const visibleFamilyLabels = new Set(
    familyLabelCandidates.slice(0, familyLabelBudget).map((positioned) => positioned.node.id),
  );
  const specificLabelCandidates = [...positionById.values()]
    .filter((positioned) => positioned.node.tier === 3)
    .filter((positioned) => selected
      ? focusedLabels.has(positioned.node.id) || (transform.k >= 6 && context?.familyMembers.has(positioned.node.id))
      : showSpecific && showSpecificLabels)
    .sort((left, right) =>
      Number(right.node.id === selected?.id) - Number(left.node.id === selected?.id)
      || Number(focusedLabels.has(right.node.id)) - Number(focusedLabels.has(left.node.id))
      || d3.descending(left.node.evidenceCount, right.node.evidenceCount)
      || d3.ascending(left.node.label, right.node.label)
      || d3.ascending(left.node.id, right.node.id));
  const visibleSpecificLabels = new Set(
    specificLabelCandidates
      .slice(0, Math.max(0, labelBudget - visibleFamilyLabels.size))
      .map((positioned) => positioned.node.id),
  );
  const glyphScale = 1 / Math.pow(transform.k, 0.58);
  updateScreenSpaceHitAreas(svg, transform);
  svg.selectAll<SVGGElement, PositionedNode>(".star-glyph").attr("transform", `scale(${glyphScale})`);
  svg
    .selectAll<SVGGElement, PositionedNode>(".specific-star")
    .style("display", showSpecific ? "" : "none")
    .style("opacity", showSpecific ? (transform.k > 1.25 ? 0.96 : 0.62) : 0);
  svg
    .selectAll<SVGTextElement, PositionedNode>(".specific-label")
    .style("display", (positioned) => visibleSpecificLabels.has(positioned.node.id) ? "" : "none")
    .attr("text-anchor", (positioned) => {
      if (!selected || !context?.familyMembers.has(positioned.node.id) || positioned.node.id === selected.id || !familyPosition) return "middle";
      const dx = positioned.x - familyPosition.x;
      return Math.abs(dx) < 5 ? "middle" : dx > 0 ? "start" : "end";
    })
    .attr("x", (positioned) => {
      if (!selected || !context?.familyMembers.has(positioned.node.id) || positioned.node.id === selected.id || !familyPosition) return 0;
      const dx = positioned.x - familyPosition.x;
      return Math.abs(dx) < 5 ? 0 : (dx > 0 ? positioned.r + 6 : -positioned.r - 6) / transform.k;
    })
    .attr("y", (positioned) => {
      if (!selected || !context?.familyMembers.has(positioned.node.id) || positioned.node.id === selected.id || !familyPosition) return -(positioned.r + 7) / transform.k;
      const dx = positioned.x - familyPosition.x;
      const dy = positioned.y - familyPosition.y;
      return Math.abs(dx) < 5 ? (dy > 0 ? positioned.r + 9 : -positioned.r - 7) / transform.k : 3 / transform.k;
    })
    .style("font-size", `${11 / transform.k}px`)
    .style("stroke-width", `${3.2 / transform.k}px`);
  svg
    .selectAll<SVGTextElement, PositionedNode>(".family-label")
    .style("display", (positioned) => visibleFamilyLabels.has(positioned.node.id) ? "" : "none")
    .attr("y", (positioned) => {
      const offset = compactViewport ? positioned.clusterR + 11 : -positioned.clusterR - 5;
      return offset / transform.k;
    })
    .style("font-size", `${(compactViewport ? 12 : 11) / transform.k}px`)
    .style("stroke-width", `${3.2 / transform.k}px`);
  svg.selectAll<SVGTextElement, unknown>(".sky-title").style("display", transform.k > 1.55 ? "none" : "");
  svg
    .selectAll<SVGCircleElement, PositionedNode>(".constellation-boundary")
    .style("stroke-opacity", (positioned) => context
      ? (positioned.node.id === context.familyId ? 0.52 : 0.035)
      : (transform.k > 1.5 ? 0.25 : 0.14));
  const visibleMarks = renderedNodeMarks();
  if (!visibleMarks.some((mark) => mark.getAttribute("tabindex") === "0")) {
    const fallback = visibleMarks.find((mark) => mark.dataset.nodeId === selection.nodeId) ?? visibleMarks[0];
    if (fallback?.dataset.nodeId) setRovingNode(fallback.dataset.nodeId);
  }
}

function renderConstellations(): void {
  const nodes = visibleConcepts();
  updateScope(nodes);
  const svg = clearStage();
  installDefinitions(svg);
  const [width, height] = stageSize();
  const layer = svg.append("g").attr("class", "constellation-map");
  const fields = computeLayout(width, height, nodes);

  const fieldLayer = layer.append("g").attr("class", "sky-fields");
  for (const field of fields) {
    fieldLayer
      .append("ellipse")
      .attr("class", `sky-field ${field.domain.id}`)
      .attr("cx", field.x + field.w / 2)
      .attr("cy", field.y + field.h / 2)
      .attr("rx", Math.max(100, field.w / 2 - 8))
      .attr("ry", Math.max(150, field.h / 2 - 6))
      .attr("fill", `url(#sky-${field.domain.id})`)
      .attr("stroke", field.domain.color);
    const title = fieldLayer
      .append("text")
      .attr("class", `sky-title ${field.domain.id}`)
      .attr("x", field.x + field.w / 2)
      .attr("y", Math.max(27, field.y - 14))
      .attr("text-anchor", "middle");
    title.append("tspan").text(field.domain.label);
    title.append("tspan").attr("class", "sky-count").text(` · ${nodes.filter((node) => node.domainId === field.domain.id).length}`);
  }

  const positions = [...positionById.values()];
  const initialRoving = positions.find((positioned) => positioned.node.id === selection.nodeId)
    ?? positions.find((positioned) => positioned.node.id === rovingNodeId && positioned.node.tier === 2)
    ?? positions.find((positioned) => positioned.node.tier === 2)
    ?? positions[0];
  rovingNodeId = initialRoving?.node.id ?? null;

  layer
    .append("g")
    .attr("class", "constellation-boundaries")
    .selectAll("circle")
    .data(positions.filter((positioned) => positioned.node.tier === 2))
    .join("circle")
    .attr("class", "constellation-boundary")
    .attr("cx", (positioned) => positioned.x)
    .attr("cy", (positioned) => positioned.y)
    .attr("r", (positioned) => positioned.clusterR)
    .attr("stroke", (positioned) => colorFor(positioned.node));

  const marks = layer
    .append("g")
    .attr("class", "concept-stars")
    .selectAll<SVGGElement, PositionedNode>("g")
    .data(positions, (positioned) => positioned.node.id)
    .join("g")
    .attr("class", (positioned) =>
      `concept-star ${positioned.node.tier === 2 ? "family-star" : "specific-star"} ${positioned.node.nodeKind}`,
    )
    .attr("data-node-id", (positioned) => positioned.node.id)
    .attr("transform", (positioned) => `translate(${positioned.x},${positioned.y})`);
  marks
    .append("circle")
    .attr("class", "star-hit-area")
    .attr("r", touchTargetRadius)
    .attr("fill", "#fff")
    .attr("fill-opacity", 0)
    .attr("pointer-events", "all");
  const glyphs = marks.append("g").attr("class", "star-glyph");
  glyphs
    .append("circle")
    .attr("class", "star-corona")
    .attr("r", (positioned) => positioned.r * (positioned.node.tier === 2 ? 3.5 : 2.7))
    .attr("fill", (positioned) => colorFor(positioned.node));
  glyphs
    .filter((positioned) => positioned.node.tier === 2)
    .append("path")
    .attr("class", "family-core")
    .attr("d", (positioned) => starPath(positioned.r, positioned.r * 0.42, 5))
    .attr("fill", (positioned) => colorFor(positioned.node));
  glyphs
    .filter((positioned) => positioned.node.tier === 3)
    .append("circle")
    .attr("class", "specific-core")
    .attr("r", (positioned) => positioned.r)
    .attr("fill", (positioned) => colorFor(positioned.node));
  glyphs
    .filter((positioned) => positioned.node.evidenceCount > 0)
    .append("circle")
    .attr("class", "evidence-ring")
    .attr("r", (positioned) => positioned.r + 1.8);

  marks
    .append("text")
    .attr("class", (positioned) => `concept-label ${positioned.node.tier === 2 ? "family-label" : "specific-label"}`)
    .attr("text-anchor", "middle")
    .attr("y", (positioned) => positioned.node.tier === 2
      ? (stage.clientWidth < 620 ? positioned.clusterR + 11 : -positioned.clusterR - 5)
      : -positioned.r - 5)
    .text((positioned) => chartLabel(positioned.node));
  marks
    .attr("role", "button")
    .attr("tabindex", (positioned) => positioned.node.id === rovingNodeId ? 0 : -1)
    .attr("focusable", "true")
    .attr("aria-label", (positioned) => accessibleNodeLabel(positioned.node))
    .on("mouseenter", (event, positioned) => showTooltip(event as MouseEvent, positioned.node))
    .on("mousemove", (event, positioned) => showTooltip(event as MouseEvent, positioned.node))
    .on("mouseleave", hideTooltip)
    .on("focus", (_event, positioned) => setRovingNode(positioned.node.id))
    .on("keydown", handleNodeKeydown)
    .on("click", (event, positioned) => {
      event.stopPropagation();
      activateNode(closestRenderedNode(event as MouseEvent, layer.node(), marks.nodes()) ?? positioned);
    });

  svg.on("click", () => selectNode(null, false));
  installZoom(svg, layer, updateSemanticZoom);
  updateSemanticZoom(d3.zoomIdentity);
  updateConstellationSelection();
}

function zoomToNode(nodeId: string): void {
  if (!currentZoom || viewMode !== "constellations") return;
  const positioned = positionById.get(nodeId);
  if (!positioned) return;
  const [width, height] = stageSize();
  const familyPosition = positioned.node.tier === 2 ? positioned : positionById.get(positioned.node.familyId) ?? positioned;
  const targetRadius = Math.max(30, familyPosition.clusterR);
  const fitScale = Math.min((width * 0.52) / (targetRadius * 2), (height * 0.58) / (targetRadius * 2));
  const maximum = positioned.node.tier === 2 ? 3.4 : 4.25;
  const scale = Math.min(maximum, Math.max(1.65, fitScale));
  const transform = d3.zoomIdentity
    .translate(width / 2, height / 2 + (stage.clientWidth < 620 ? 12 : 24))
    .scale(scale)
    .translate(-familyPosition.x, -familyPosition.y);
  d3
    .select(svgElement)
    .transition()
    .duration(motionDuration(720))
    .ease(d3.easeCubicInOut)
    .call(currentZoom.transform, transform);
}

function zoomToSelection(nodeId: string): void {
  if (!currentZoom || viewMode !== "constellations") return;
  const node = nodeById.get(nodeId);
  if (!node) return;
  const context = selectionContext(node);
  const positions = [...context.familyMembers, ...context.affinityMembers]
    .map((id) => positionById.get(id))
    .filter((positioned): positioned is PositionedNode => Boolean(positioned));
  if (!positions.length || !context.affinityMembers.size) {
    zoomToNode(nodeId);
    return;
  }
  const [width, height] = stageSize();
  const x0 = d3.min(positions, (positioned) => positioned.x - Math.max(8, positioned.clusterR)) ?? 0;
  const x1 = d3.max(positions, (positioned) => positioned.x + Math.max(8, positioned.clusterR)) ?? width;
  const y0 = d3.min(positions, (positioned) => positioned.y - Math.max(8, positioned.clusterR)) ?? 0;
  const y1 = d3.max(positions, (positioned) => positioned.y + Math.max(8, positioned.clusterR)) ?? height;
  const spanX = Math.max(80, x1 - x0);
  const spanY = Math.max(80, y1 - y0);
  const scale = Math.min(2.6, Math.max(0.78, Math.min((width * 0.78) / spanX, (height * 0.7) / spanY)));
  const transform = d3.zoomIdentity
    .translate(width / 2, height / 2 + 24)
    .scale(scale)
    .translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
  d3
    .select(svgElement)
    .transition()
    .duration(motionDuration(720))
    .ease(d3.easeCubicInOut)
    .call(currentZoom.transform, transform);
}

function relationNeighbors(node: ConceptNode): LocalRelation[] {
  const result = new Map<string, LocalRelation>();
  const add = (neighbor: ConceptNode | undefined, relation: LocalRelation["relation"], edge: ConceptEdge | null): void => {
    if (!neighbor || neighbor.id === node.id || result.has(neighbor.id)) return;
    result.set(neighbor.id, { edge, node: neighbor, relation });
  };
  for (const edge of taxonomyEdges) {
    if (edge.target === node.id) add(visibleNodeById.get(edge.source), "parent", edge);
    if (edge.source === node.id) add(visibleNodeById.get(edge.target), "child", edge);
  }
  if (node.tier === 3) {
    const siblings = visibleNodes
      .filter((candidate) => candidate.parentId === node.parentId && candidate.id !== node.id)
      .sort((left, right) => d3.descending(left.evidenceCount, right.evidenceCount) || d3.ascending(left.label, right.label))
      .slice(0, 8);
    for (const sibling of siblings) add(sibling, "sibling", null);
  }
  const affinities = visibleAffinityEdges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .sort((left, right) => d3.descending(left.weight, right.weight))
    .slice(0, 10);
  for (const edge of affinities) add(visibleNodeById.get(edge.source === node.id ? edge.target : edge.source), "affinity", edge);
  const order: Record<LocalRelation["relation"], number> = { parent: 0, child: 1, affinity: 2, sibling: 3 };
  return [...result.values()]
    .sort((left, right) => order[left.relation] - order[right.relation] || d3.descending(left.node.evidenceCount, right.node.evidenceCount))
    .slice(0, 24);
}

function renderRelations(): void {
  const svg = clearStage();
  installDefinitions(svg);
  const [width, height] = stageSize();
  const layer = svg.append("g").attr("class", "relation-map");
  const selected = selection.nodeId ? visibleNodeById.get(selection.nodeId) : undefined;
  if (!selected) {
    const prompt = layer.append("g").attr("class", "relation-prompt").attr("transform", `translate(${width / 2},${height / 2})`);
    prompt.append("text").attr("class", "prompt-star").attr("text-anchor", "middle").attr("y", -30).text("✦");
    prompt.append("text").attr("class", "prompt-title").attr("text-anchor", "middle").text("Select a class, race, or being");
    prompt.append("text").attr("class", "prompt-copy").attr("text-anchor", "middle").attr("y", 28).text("Search above or choose a star in Constellations.");
    updateScope([]);
    return;
  }
  const neighbors = relationNeighbors(selected);
  const center: PositionedNode = { node: selected, x: width / 2, y: height / 2, r: 9, clusterR: 9 };
  const positioned: PositionedNode[] = [center];
  const radius = Math.min(width, height) * 0.34;
  neighbors.forEach((neighbor, index) => {
    const ring = index < 14 ? 1 : 0.66;
    const ringIndex = index < 14 ? index : index - 14;
    const ringCount = index < 14 ? Math.min(14, neighbors.length) : neighbors.length - 14;
    const angle = -Math.PI / 2 + (ringIndex * Math.PI * 2) / Math.max(1, ringCount);
    positioned.push({
      node: neighbor.node,
      x: width / 2 + Math.cos(angle) * radius * ring,
      y: height / 2 + Math.sin(angle) * radius * ring,
      r: neighbor.relation === "parent" ? 7 : 4.2 + Math.min(2, Math.sqrt(neighbor.node.evidenceCount) * 0.25),
      clusterR: 0,
    });
  });
  const positionMap = new Map(positioned.map((item) => [item.node.id, item]));
  const initialRoving = positioned.find((item) => item.node.id === selected.id)
    ?? positioned.find((item) => item.node.id === rovingNodeId)
    ?? positioned[0];
  rovingNodeId = initialRoving?.node.id ?? null;
  layer
    .append("g")
    .selectAll("line")
    .data(neighbors)
    .join("line")
    .attr("class", (neighbor) => `local-relation-line ${neighbor.relation}`)
    .attr("x1", center.x)
    .attr("y1", center.y)
    .attr("x2", (neighbor) => positionMap.get(neighbor.node.id)?.x ?? center.x)
    .attr("y2", (neighbor) => positionMap.get(neighbor.node.id)?.y ?? center.y)
    .attr("role", "img")
    .attr("aria-label", (neighbor) => `${selected.label} to ${neighbor.node.label}: ${relationLabel(selected, neighbor.node)}`)
    .attr("stroke-width", (neighbor) => (neighbor.relation === "affinity" ? 1 + Math.min(4, Math.log2((neighbor.edge?.weight ?? 1) + 1)) : 1.2));
  const marks = layer
    .append("g")
    .selectAll<SVGGElement, PositionedNode>("g")
    .data(positioned)
    .join("g")
    .attr("class", (item) => `concept-star relation-star ${item.node.id === selected.id ? "is-selected" : ""}`)
    .attr("data-node-id", (item) => item.node.id)
    .attr("transform", (item) => `translate(${item.x},${item.y})`);
  marks
    .append("circle")
    .attr("class", "star-hit-area")
    .attr("r", touchTargetRadius)
    .attr("fill", "#fff")
    .attr("fill-opacity", 0)
    .attr("pointer-events", "all");
  marks.append("circle").attr("class", "star-corona").attr("r", (item) => item.r * 3).attr("fill", (item) => colorFor(item.node));
  marks.append("path").attr("class", "family-core").attr("d", (item) => starPath(item.r, item.r * 0.42, 5)).attr("fill", (item) => colorFor(item.node));
  marks
    .append("text")
    .attr("class", "relation-label")
    .attr("text-anchor", "middle")
    .attr("y", (item) => item.r + 18)
    .text((item) => compactLabel(chartLabel(item.node), stage.clientWidth < 620 ? 18 : 24));
  marks
    .attr("role", "button")
    .attr("tabindex", (item) => item.node.id === rovingNodeId ? 0 : -1)
    .attr("focusable", "true")
    .attr("aria-label", (item) => accessibleNodeLabel(item.node))
    .on("mouseenter", (event, item) => showTooltip(event as MouseEvent, item.node))
    .on("mousemove", (event, item) => showTooltip(event as MouseEvent, item.node))
    .on("mouseleave", hideTooltip)
    .on("focus", (_event, item) => setRovingNode(item.node.id))
    .on("keydown", handleNodeKeydown)
    .on("click", (event, item) => {
      event.stopPropagation();
      selectNode((closestRenderedNode(event as MouseEvent, layer.node(), marks.nodes()) ?? item).node.id, false);
    });
  const updateRelationZoom = (transform: d3.ZoomTransform): void => {
    const compactViewport = stage.clientWidth < 620;
    updateScreenSpaceHitAreas(svg, transform);
    svg
      .selectAll<SVGTextElement, PositionedNode>(".relation-label")
      .style("display", (item, index) => !compactViewport || item.node.id === selected.id || index < 7 ? "" : "none")
      .attr("y", (item) => item.r + 18 / transform.k)
      .style("font-size", `${12 / transform.k}px`)
      .style("stroke-width", `${3.2 / transform.k}px`);
  };
  installZoom(svg, layer, updateRelationZoom);
  updateRelationZoom(d3.zoomIdentity);
  updateScope(positioned.map((item) => item.node));
}

function updateRelationSelection(): void {
  document.querySelectorAll<SVGGElement>("#atlas-svg .relation-star").forEach((mark) => {
    mark.classList.toggle("is-selected", mark.dataset.nodeId === selection.nodeId);
  });
}

function renderCatalogue(): void {
  svgElement.style.display = "none";
  board.hidden = false;
  board.replaceChildren();
  hideTooltip();
  const nodes = visibleConcepts();
  updateScope(nodes);
  const summary = element("div", "catalogue-intro");
  summary.append(element("p", "eyebrow", "Organized by lineage"), element("h2", "", "Classes, races, and entities without the graph"));
  summary.append(element("p", "", "Each family is a constellation in the map. Select any card to inspect definitions, cautions, source examples, and relationships."));
  board.append(summary);
  const families = nodes.filter((node) => node.tier === 2);
  for (const family of families) {
    const children = nodes.filter((node) => node.tier === 3 && node.familyId === family.id);
    const section = element("section", "catalogue-family");
    const heading = element("button", "catalogue-family-heading") as HTMLButtonElement;
    heading.type = "button";
    heading.dataset.nodeId = family.id;
    heading.style.setProperty("--family-color", colorFor(family));
    heading.append(element("span", "catalogue-star", "✦"));
    const headingCopy = element("span");
    headingCopy.append(element("strong", "", family.label), element("small", "", `${children.length} specific archetypes · ${family.sourceCount} mapped sources`));
    heading.append(headingCopy);
    heading.addEventListener("click", () => {
      selectNode(family.id, false);
      focusDetailHeading();
    });
    section.append(heading);
    const grid = element("div", "concept-card-grid");
    for (const node of children) {
      const card = element("button", "concept-card") as HTMLButtonElement;
      card.type = "button";
      card.dataset.nodeId = node.id;
      card.style.setProperty("--family-color", colorFor(node));
      card.append(element("strong", "", node.label));
      card.append(element("span", "", compactLabel(node.definition || "Framework archetype", 145)));
      card.append(element("small", "", node.evidenceCount ? `${node.sourceCount} sources · ${node.evidenceCount} examples` : "Framework only · evidence mapping pending"));
      card.addEventListener("click", () => {
        selectNode(node.id, false);
        focusDetailHeading();
      });
      grid.append(card);
    }
    section.append(grid);
    board.append(section);
  }
}

function renderResearch(): void {
  svgElement.style.display = "none";
  board.hidden = false;
  board.replaceChildren();
  hideTooltip();
  const reviewed = research.meta.reviewCoverage?.focusedReviewedSources ?? 0;
  const summary = element("div", "research-summary");
  const facts: Array<[number, string, string]> = [
    [research.sources.length, "bounded source passes", "100% of corpus"],
    [research.characters.length, "character evidence records", "examples, never concept nodes"],
    [research.sourceTerms.length, "source-native terms", "dimensions, never graph nodes"],
    [reviewed, "focused independent reviews", `${research.meta.reviewCoverage?.pendingFullSecondReviewSources ?? 0} pending`],
  ];
  for (const [value, label, note] of facts) {
    const card = element("article", "research-card");
    card.append(element("strong", "", value.toLocaleString()), element("span", "", label), element("small", "", note));
    summary.append(card);
  }
  board.append(summary);
  const quality = element("div", "quality-notice");
  const warningCount = research.meta.qualityWarnings?.length ?? 0;
  const quarantineCount = research.meta.quarantinedBundles?.length ?? 0;
  quality.append(element("strong", "", "Research remains visible beneath the sky"));
  quality.append(element("span", "", `${warningCount} reviewed evidence-concentration flags remain explicit; ${quarantineCount} historical draft is quarantined and excluded. Source and character records support the concepts but never become stars.`));
  board.append(quality);
  board.append(element("p", "table-swipe-hint", "Swipe horizontally to inspect scope, pass status, and independent review →"));
  const tableWrap = element("div", "research-table-wrap");
  const table = element("table", "research-table");
  const header = element("thead");
  const headerRow = element("tr");
  for (const label of ["Source / continuity", "Scoped", "Character pass", "Terminology pass", "Relationship pass", "Second review", "Continuity review"]) {
    headerRow.append(element("th", "", label));
  }
  header.append(headerRow);
  table.append(header);
  const body = element("tbody");
  const selectedRecord = selection.query === researchQuery
    ? discoveryRecordById(selection.discoveryId)
    : undefined;
  const matchedSourceIds = selectedRecord?.sourceId
    ? new Set([selectedRecord.sourceId])
    : researchQuery ? discoverySourceIds(researchQuery) : null;
  const sources = research.corpusSources
    .filter((source) => !selectedSource || source.sourceId === selectedSource)
    .filter((source) => !matchedSourceIds || matchedSourceIds.has(source.sourceId))
    .sort((left, right) => d3.ascending(left.title, right.title));
  const sourceIds = new Set(sources.map((source) => source.sourceId));
  updateScopeFacts([
    [sources.length, "source passes"],
    [research.characters.filter((character) => sourceIds.has(character.source_id)).length, "character records"],
    [research.sourceTerms.filter((term) => sourceIds.has(term.source_id)).length, "source terms"],
    [sources.filter((source) => {
      const status = auditBySource.get(source.sourceId)?.review_lanes?.secondReview?.status;
      return Boolean(status && status !== "not-started");
    }).length, "focused reviews"],
  ]);
  for (const source of sources) {
    const audit = auditBySource.get(source.sourceId);
    const row = element("tr", "is-researched");
    const sourceCell = element("td", "source-cell");
    sourceCell.append(
      element("strong", "", source.title),
      element("span", "", `${source.medium} · ${source.region} · ${source.priorityTier}`),
      element("small", "dimension-note", audit?.continuity_scope ?? source.continuityUnit),
      element("small", "dimension-note", `Caution: ${auditStatusPresentation(audit).caution}`),
    );
    row.append(sourceCell);
    for (const laneName of ["scoped", "characterPass", "terminologyPass", "relationshipPass", "secondReview", "continuityReview"] as const) {
      const lane = audit?.review_lanes?.[laneName];
      const cell = element("td", "review-lane");
      cell.append(
        element("span", `status-pill ${lane ? laneClassName(lane.status) : "not-started"}`, lane?.label ?? "Not started"),
        element("small", "dimension-note", lane?.detail ?? "No validated lane status is recorded"),
      );
      row.append(cell);
    }
    body.append(row);
  }
  table.append(body);
  if (researchQuery && !sources.length) {
    const empty = element("div", "search-empty research-empty");
    empty.append(
      element("strong", "", `No research source is connected to “${researchQuery}”.`),
      element("span", "", "The corpus search above may still show a concept result; try a source, character, work, continuity, or source-native term."),
    );
    board.append(empty);
  } else {
    tableWrap.append(table);
    board.append(tableWrap);
  }
  visibleCount.textContent = `${sources.length} source passes`;
}

function detailSection(title: string): HTMLElement {
  const section = element("section", "detail-section");
  section.append(element("h3", "", title));
  return section;
}

function appendCitationLinks(container: HTMLElement, citations: Citation[], label = "Open supporting citation"): void {
  for (const citation of citations) {
    const link = element("a", "citation-card evidence-citation") as HTMLAnchorElement;
    link.href = citation.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.append(element("strong", "", citation.locator || label));
    link.append(element("span", "", `${label} ↗`));
    for (const support of citation.supports) link.append(element("small", "", support));
    container.append(link);
  }
}

function closeDetail(): void {
  const focusBelongsToDetail = detailPanel?.contains(document.activeElement) ?? false;
  const focusBelongsToRelationMap = viewMode === "relations" && svgElement.contains(document.activeElement);
  clearSelection();
  detailPanel?.classList.remove("is-open");
  renderDetail();
  renderFocusBanner();
  if (viewMode === "constellations") {
    updateConstellationSelection();
    updateSemanticZoom(currentTransform);
  } else if (viewMode === "relations") {
    renderRelations();
  }
  if (focusBelongsToDetail || focusBelongsToRelationMap) requestAnimationFrame(() => searchInput.focus());
}

function focusDetailHeading(): void {
  requestAnimationFrame(() => detailContent.querySelector<HTMLElement>("h2")?.focus());
}

function hideDetail(): void {
  const focusBelongsToDetail = detailPanel?.contains(document.activeElement) ?? false;
  detailPanel?.classList.remove("is-open");
  if (focusBelongsToDetail) {
    const candidates = viewMode === "catalogue" && !board.hidden
      ? [...board.querySelectorAll<HTMLElement>("[data-node-id]")]
      : viewMode === "constellations" || viewMode === "relations"
        ? [...svgElement.querySelectorAll<SVGElement>(".is-selected")]
        : [];
    const returnTarget = candidates.find((candidate) =>
      candidate.dataset.nodeId === selection.nodeId
      && candidate.isConnected
      && candidate.getClientRects().length > 0
      && getComputedStyle(candidate).visibility !== "hidden"
      && getComputedStyle(candidate).display !== "none",
    );
    (returnTarget ?? searchInput).focus();
  }
}

function renderDiscoveryDetail(record: DiscoveryRecord): void {
  detailContent.replaceChildren();
  detailPanel?.classList.add("is-open");
  const close = element("button", "mobile-detail-close", "×") as HTMLButtonElement;
  close.type = "button";
  close.setAttribute("aria-label", "Close discovery detail");
  close.addEventListener("click", hideDetail);
  detailContent.append(close);

  const header = element("header", "character-header discovery-detail-header");
  header.append(element("p", "eyebrow", record.kindLabel));
  const title = element("h2", "", record.label);
  title.setAttribute("tabindex", "-1");
  header.append(title);
  header.append(element("p", "character-subtitle", [record.sourceTitle, record.continuity].filter(Boolean).join(" · ") || "Accepted corpus record"));
  const evidence = element("div", "evidence-row");
  evidence.append(element("span", "evidence-badge researched", "Indexed evidence"));
  evidence.append(element("span", "", `${record.characterIds.length || record.characterExamples.length} character examples · ${record.normalizedConceptIds.length} accepted normalized mappings${record.mappingQuarantined ? " · mapping withheld pending second review" : ""}`));
  header.append(evidence);
  detailContent.append(header);

  const actions = element("div", "detail-actions");
  const selectedConcept = selection.nodeId ? visibleNodeById.get(selection.nodeId) : undefined;
  if (selectedConcept) {
    const nodeId = selectedConcept.id;
    const discoveryId = selection.discoveryId;
    const concept = element("button", "primary-button", "Open related concept") as HTMLButtonElement;
    concept.type = "button";
    concept.addEventListener("click", () => {
      if (!visibleNodeById.has(nodeId)) return;
      selectNode(nodeId, true, "search", discoveryId);
    });
    actions.append(concept);
    const relations = element("button", "secondary-button", "Show relations") as HTMLButtonElement;
    relations.type = "button";
    relations.addEventListener("click", () => {
      if (!visibleNodeById.has(nodeId)) return;
      viewMode = "relations";
      render();
    });
    actions.append(relations);
  }
  if (actions.childElementCount) detailContent.append(actions);

  const why = detailSection("Why this matched");
    const matched = matchedDiscoveryFields(record, foldSearch(lastSearchQuery));
  why.append(element("p", "detail-copy", matched.length
    ? `“${lastSearchQuery}” matched ${matched.join(", ")}. The result is an evidence record, not a claim that similarly spelled traditions are identical.`
    : "This result is part of the deterministic discovery projection for the accepted corpus."));
  if (record.aliasNote) why.append(element("p", "dimension-note", record.aliasNote));
  detailContent.append(why);

  const context = detailSection("Source and continuity");
  const contextGrid = element("div", "attribute-grid");
  const sourceAudit = record.sourceId ? auditStatusPresentation(auditBySource.get(record.sourceId)) : undefined;
  const normalizedFamilies = [...new Set(record.normalizedConceptIds.map(normalizedFamilyLabel).filter(Boolean))].join(", ");
  const normalizedMappings = record.normalizedConceptIds
    .map((id) => `${research.taxonomy[id]?.name ?? id} (${id})`)
    .join(", ");
  const contextValues: Array<[string, string]> = [
    ["Source / series", record.sourceTitle],
    ["Continuity", record.continuity],
    ["Work / witness", record.work],
    ["Source-wide scope", record.kind === "source-term" ? sourceScopeLabel(record.sourceId) : ""],
    ["Source audit status", sourceAudit?.label ?? ""],
    ["Source audit caution", sourceAudit?.caution ?? ""],
    ["Evidence dimension", dimensionLabels[record.dimension] ?? record.dimension],
    ["Normalized family", normalizedFamilies],
    ["Normalized mapping", normalizedMappings],
  ];
  for (const [label, value] of contextValues) {
    if (!value) continue;
    const item = element("div", "attribute-item");
    item.append(element("small", "", label), element("span", "", value));
    contextGrid.append(item);
  }
  context.append(contextGrid);
  detailContent.append(context);

  const relatedConcepts = detailSection("Related normalized concepts");
  const relatedList = element("div", "relation-list");
  const graphConceptIds = record.relatedConceptIds.filter((id) => nodeById.has(id));
  const conceptNodes = record.relatedConceptIds.map((id) => visibleNodeById.get(id)).filter((node): node is ConceptNode => Boolean(node));
  for (const node of conceptNodes.slice(0, 12)) {
    const button = element("button", "relation-button") as HTMLButtonElement;
    button.type = "button";
    button.dataset.nodeId = node.id;
    button.append(element("span", "relation-star", "✦"), element("strong", "", node.label), element("small", "", `${node.domainLabel} · ${node.sourceCount} sources`));
    button.addEventListener("click", () => {
      if (!visibleNodeById.has(node.id)) return;
      selectNode(node.id, true, "search", selection.discoveryId);
    });
    relatedList.append(button);
  }
  if (!conceptNodes.length) {
    const message = graphConceptIds.length
      ? "No related graph concept matches the active sky, source, and evidence filters."
      : record.normalizedConceptIds.length
      ? "The recorded normalized mappings are outside the being/class graph, so this evidence remains source-native and no graph star is created."
      : record.mappingQuarantined
        ? "A normalized mapping is quarantined pending claim-level second review. It remains only in the retained research bundle and cannot create public graph links, affinities, or stars."
        : "No normalized archetype ID is recorded for this evidence. It stays source-native and is not promoted to a graph node.";
    relatedList.append(element("p", "detail-copy", message));
  }
  relatedConcepts.append(relatedList);
  detailContent.append(relatedConcepts);

  if (record.sourceId) {
    const connections = detailSection("Series connections");
    const sourceConnections = discovery?.meta.sourceConnections[record.sourceId] ?? [];
    if (!sourceConnections.length) {
      connections.append(element("p", "detail-copy", "No cross-series connection is claimed here: this record has no shared normalized concept with another accepted source."));
    } else {
      for (const connection of sourceConnections.slice(0, 6)) {
        const shared = connection.sharedConceptIds.map((id) => nodeById.get(id)?.label).filter(Boolean).slice(0, 3).join(", ");
        const card = element("div", "citation-card");
        card.append(element("strong", "", connection.title), element("span", "", `Shared normalized evidence: ${shared || "recorded concept"}`));
        connections.append(card);
      }
    }
    detailContent.append(connections);
  }

  const characterSection = detailSection("Representative characters");
  const characters = record.characterIds.map((id) => characterById.get(id)).filter((character): character is ResearchCharacter => Boolean(character));
  for (const character of characters.slice(0, 8)) {
    const card = element("article", "citation-card");
    card.append(element("strong", "", character.canonical_name));
    card.append(element("span", "", `${character.source_title} · ${character.continuity}`));
    if (character.work_or_witness) card.append(element("small", "", `Work / witness: ${character.work_or_witness}`));
    const dimensionTerms = Object.entries(character.dimensions)
      .flatMap(([dimension, values]) => values.map((value) => `${dimensionLabels[dimension] ?? titleCase(dimension)}: ${value.term}`))
      .filter(Boolean);
    if (dimensionTerms.length) card.append(element("small", "", `Dimensions: ${dimensionTerms.join(" · ")}`));
    if (character.evidence_level) card.append(element("small", "", `Evidence: ${character.evidence_level}`));
    if (character.review_status) card.append(element("small", "", `Review status: ${character.review_status}`));
    if (character.canon_status) card.append(element("small", "", `Canon status: ${character.canon_status}`));
    card.append(element("small", "", `Caution: ${character.comparison_cautions.join(" ") || "No additional comparison caution recorded."}`));
    card.append(element("small", "", character.description));
    appendCitationLinks(card, character.citations);
    characterSection.append(card);
  }
  if (!characters.length && record.kind !== "source") characterSection.append(element("p", "detail-copy", "This source-native record has no character example in its witness; its citation remains the evidence anchor."));
  if (record.kind === "source") {
    characterSection.append(element("p", "detail-copy", `${record.characterExamples.length} representative character records are indexed for this source. Search a name to inspect its bounded evidence.`));
    const audit = auditBySource.get(record.sourceId);
    const corpusSource = corpusBySource.get(record.sourceId);
    const evidenceSection = detailSection("Source evidence and status");
    const statusPresentation = auditStatusPresentation(audit);
    evidenceSection.append(element("p", "dimension-note", `Status: ${statusPresentation.label}`));
    evidenceSection.append(element("p", "dimension-note", `Caution: ${statusPresentation.caution}`));
    if (audit?.evidence_basis) evidenceSection.append(element("p", "detail-copy", `Evidence basis: ${audit.evidence_basis}`));
    if (audit?.citations.length) {
      appendCitationLinks(evidenceSection, audit.citations, "Open supporting source evidence");
    } else {
      const evidenceUrl = corpusSource?.referenceUrl ?? record.url;
      if (evidenceUrl) {
        const link = element("a", "evidence-link", "Open supporting source evidence ↗") as HTMLAnchorElement;
        link.href = evidenceUrl;
        link.target = "_blank";
        link.rel = "noreferrer";
        evidenceSection.append(link);
      }
    }
    detailContent.append(evidenceSection);
  }
  detailContent.append(characterSection);

  if (record.kind === "source-term") {
    const term = sourceTermById.get(record.id.replace("source-term:", ""));
    if (term) {
      const evidenceSection = detailSection("Term evidence and caution");
      evidenceSection.append(element("p", "detail-copy", term.definition || "A source-native terminology record."));
      if (term.original_language) evidenceSection.append(element("p", "dimension-note", `Source language: ${term.original_language}`));
      if (term.original_script || term.transliteration) evidenceSection.append(element("p", "dimension-note", [term.original_script, term.transliteration].filter(Boolean).join(" · ")));
      if (term.mapping_relation) evidenceSection.append(element("p", "dimension-note", `Mapping relation: ${term.mapping_relation}`));
      if (term.review_status) evidenceSection.append(element("p", "dimension-note", `Review status: ${term.review_status}`));
      if (term.cultural_caution) evidenceSection.append(element("p", "dimension-note", term.cultural_caution));
      appendCitationLinks(evidenceSection, term.citations);
      detailContent.append(evidenceSection);
    }
  }
  if (record.kind === "character") {
    const character = characterById.get(record.characterIds[0]);
    if (character?.comparison_cautions.length) {
      const caution = detailSection("Interpretive caution");
      caution.append(element("ul", "caution-list", ""));
      const list = caution.querySelector("ul");
      character.comparison_cautions.forEach((note) => list?.append(element("li", "", note)));
      detailContent.append(caution);
    }
  }
}

function renderOverviewDetail(): void {
  detailContent.replaceChildren();
  detailPanel?.classList.remove("is-open");
  const header = element("header", "overview-header");
  header.append(element("p", "eyebrow", "A legible ontology"), element("h2", "", "Two skies, twenty constellations"));
  header.append(element("p", "detail-copy lead", "The map contains only reusable fantasy beings/races/entities and classes/vocations. Everything else is evidence or context."));
  detailContent.append(header);
  const ring = element("div", "overview-ring");
  ring.append(element("strong", "", String(concepts.meta.counts.nodes)), element("span", "", "concept stars"));
  detailContent.append(ring);
  const how = detailSection("How to explore");
  const list = element("ol", "reading-list");
  for (const text of [
    "Choose one sky or keep both visible.",
    "Select a large family star to zoom into its archetypes.",
    "Select a small star for definitions, source examples, and local relations.",
    "Use Relations to see only meaningful neighbors—never a global hairball.",
  ]) list.append(element("li", "", text));
  how.append(list);
  detailContent.append(how);
  const contract = detailSection("What is not a node");
  contract.append(element("p", "detail-copy", "Characters, franchises, artifacts, powers, cosmologies, institutions, and research records appear in details and filters. They do not compete with classes and beings in the graph."));
  detailContent.append(contract);
}

function relationLabel(selected: ConceptNode, other: ConceptNode): string {
  const taxonomy = taxonomyEdges.find(
    (edge) => (edge.source === selected.id && edge.target === other.id) || (edge.target === selected.id && edge.source === other.id),
  );
  if (taxonomy) return taxonomy.source === selected.id ? "Subtype" : "Parent family";
  const affinity = visibleAffinityEdges.find(
    (edge) => (edge.source === selected.id && edge.target === other.id) || (edge.target === selected.id && edge.source === other.id),
  );
  if (affinity) return `${affinity.weight} shared evidence record${affinity.weight === 1 ? "" : "s"}`;
  return selected.parentId && selected.parentId === other.parentId ? "Sibling archetype" : "Related concept";
}

function renderConceptDetail(node: ConceptNode, discoveryContext?: DiscoveryRecord): void {
  detailContent.replaceChildren();
  detailPanel?.classList.add("is-open");
  const close = element("button", "mobile-detail-close", "×") as HTMLButtonElement;
  close.type = "button";
  close.setAttribute("aria-label", "Close concept detail");
  close.addEventListener("click", hideDetail);
  detailContent.append(close);
  const header = element("header", "character-header concept-detail-header");
  header.append(element("p", "eyebrow", node.tier === 2 ? `${node.domainLabel} family` : node.domainLabel));
  const title = element("h2", "", node.label);
  title.setAttribute("tabindex", "-1");
  header.append(title);
  const parent = node.parentId ? visibleNodeById.get(node.parentId) : undefined;
  header.append(element("p", "character-subtitle", parent ? `${node.domainLabel} › ${parent.label}` : node.domainLabel));
  const evidence = element("div", "evidence-row");
  evidence.append(element("span", `evidence-badge ${node.evidenceCount ? "researched" : "needs-review"}`, node.evidenceCount ? "Mapped evidence" : "Framework only"));
  evidence.append(element("span", "", `${node.sourceCount} sources · ${node.evidenceCount} examples`));
  header.append(evidence);
  detailContent.append(header);

  const actions = element("div", "detail-actions");
  const center = element("button", "primary-button", node.tier === 2 ? "Open constellation" : "Center star") as HTMLButtonElement;
  center.type = "button";
  center.addEventListener("click", () => {
    viewMode = "constellations";
    render();
    requestAnimationFrame(() => zoomToNode(node.id));
  });
  const relations = element("button", "secondary-button", "Show relations") as HTMLButtonElement;
  relations.type = "button";
  relations.addEventListener("click", () => {
    viewMode = "relations";
    render();
  });
  actions.append(center, relations);
  detailContent.append(actions);

  if (discoveryContext) {
    const match = detailSection("Why this matched");
    const matched = matchedDiscoveryFields(discoveryContext, foldSearch(lastSearchQuery));
    match.append(element("p", "detail-copy", matched.length
      ? `“${lastSearchQuery}” matched ${matched.join(", ")} in the normalized concept index. The source evidence below remains attached to this concept without merging traditions.`
      : "This normalized concept was selected from the deterministic discovery projection."));
    const contextGrid = element("div", "attribute-grid");
    for (const [label, value] of [
      ["Source / series", discoveryContext.sourceTitle],
      ["Continuity", discoveryContext.continuity],
      ["Work / witness", discoveryContext.work],
      ["Source-wide scope", discoveryContext.kind === "source-term" ? sourceScopeLabel(discoveryContext.sourceId) : ""],
      ["Evidence dimension", dimensionLabels[discoveryContext.dimension] ?? discoveryContext.dimension],
    ]) {
      if (!value) continue;
      const item = element("div", "attribute-item");
      item.append(element("small", "", label), element("span", "", value));
      contextGrid.append(item);
    }
    match.append(contextGrid);
    if (discoveryContext.url) {
      const citation = element("a", "evidence-link", "Open discovery citation ↗") as HTMLAnchorElement;
      citation.href = discoveryContext.url;
      citation.target = "_blank";
      citation.rel = "noreferrer";
      match.append(citation);
    }
    detailContent.append(match);
  }

  const stats = element("div", "concept-stat-grid");
  for (const [value, label] of [
    [node.tier === 2 ? node.childIds.length : node.evidenceCount, node.tier === 2 ? "subtypes" : "examples"],
    [node.sourceCount, "sources"],
    [node.nodeKind === "being" ? "Being" : "Class", "concept type"],
  ] as Array<[number | string, string]>) {
    const stat = element("div");
    stat.append(element("strong", "", typeof value === "number" ? value.toLocaleString() : value), element("span", "", label));
    stats.append(stat);
  }
  detailContent.append(stats);

  const dimensions = detailSection("Attributes, not nodes");
  const dimensionGrid = element("div", "attribute-grid");
  const attributes: Array<[string, string]> = [
    ["Family", parent?.label ?? node.label],
    ["Domain", node.nodeKind === "being" ? "Race / being / entity" : "Class / vocation"],
    ["Narrative function", node.functions || "Not yet specified"],
    ["Framework status", node.frameworkStatus || "Normalized archetype"],
  ];
  for (const [label, value] of attributes) {
    const item = element("div", "attribute-item");
    item.append(element("small", "", label), element("span", "", value));
    dimensionGrid.append(item);
  }
  dimensions.append(dimensionGrid);
  detailContent.append(dimensions);

  const definition = detailSection("Definition");
  definition.append(element("p", "detail-copy", node.definition || "A normalized framework concept awaiting a fuller definition."));
  if (node.distinctions) definition.append(element("p", "dimension-note", node.distinctions));
  detailContent.append(definition);

  const neighbors = relationNeighbors(node).slice(0, 12);
  const related = detailSection("Nearby stars");
  const relationList = element("div", "relation-list");
  for (const neighbor of neighbors) {
    const button = element("button", "relation-button") as HTMLButtonElement;
    button.type = "button";
    button.append(element("span", "relation-star", "✦"), element("strong", "", neighbor.node.label), element("small", "", relationLabel(node, neighbor.node)));
    button.addEventListener("click", () => selectNode(neighbor.node.id, false));
    relationList.append(button);
  }
  if (!neighbors.length) relationList.append(element("p", "detail-copy", "No local taxonomy or evidence affinity is recorded."));
  related.append(relationList);
  detailContent.append(related);

  const examples = detailSection("Source evidence and examples");
  if (!node.examples.length) {
    examples.append(element("p", "detail-copy", "This star is structurally useful in the framework, but no source-specific entry, mapped character example, or source term currently points to it. It remains visible as framework—not as a canonical claim about any source."));
  } else {
    for (const example of node.examples.slice(0, 10)) {
      const card = element("article", "citation-card");
      card.append(element("strong", "", example.label));
      const character = characterById.get(example.id);
      const term = sourceTermById.get(example.id);
      const citations = character?.citations ?? term?.citations ?? [];
      const work = example.work || character?.work_or_witness || (term ? discoveryRecordById(`source-term:${term.term_id}`)?.work : "") || discoveryRecordById(`source:${example.sourceId}`)?.work;
      const reviewStatus = example.reviewStatus || character?.review_status || term?.review_status;
      const canonStatus = example.canonStatus || character?.canon_status;
      const caution = example.caution || term?.cultural_caution || character?.comparison_cautions.join(" ");
      card.append(element("span", "", [example.sourceTitle, example.continuity, work, titleCase(example.kind)].filter(Boolean).join(" · ")));
      const sourceScope = term ? sourceScopeLabel(example.sourceId) : "";
      if (sourceScope) card.append(element("small", "", `Source-wide scope: ${sourceScope}`));
      if (example.evidenceLevel || example.evidenceBasis) {
        card.append(element("small", "", [example.evidenceLevel, example.evidenceBasis && `Evidence basis: ${example.evidenceBasis}`].filter(Boolean).join(" · ")));
      }
      if (reviewStatus) card.append(element("small", "", `Review status: ${reviewStatus}`));
      if (canonStatus) card.append(element("small", "", `Canon status: ${canonStatus}`));
      if (caution) card.append(element("small", "", `Caution: ${caution}`));
      if (example.summary) card.append(element("small", "", compactLabel(example.summary, 240)));
      if (citations.length) appendCitationLinks(card, citations);
      else if (example.url) {
        const link = element("a", "evidence-link", "Open supporting citation ↗") as HTMLAnchorElement;
        link.href = example.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        card.append(link);
      }
      examples.append(card);
    }
  }
  detailContent.append(examples);

  if (node.caution || node.representativeTerms) {
    const caution = detailSection("Comparison caution");
    if (node.caution) caution.append(element("p", "detail-copy", node.caution));
    if (node.representativeTerms) caution.append(element("p", "dimension-note", `Representative terms: ${node.representativeTerms}`));
    detailContent.append(caution);
  }
}

function renderDetail(): void {
  const discoveryRecord = discoveryRecordById(selection.discoveryId);
  const discoveryContext = discoveryRecordById(selection.discoveryContextId)
    ?? (discoveryRecord?.kind === "concept" ? discoveryRecord : undefined);
  const node = selection.nodeId ? visibleNodeById.get(selection.nodeId) : undefined;
  if (discoveryRecord?.kind !== "concept" && discoveryRecord) renderDiscoveryDetail(discoveryRecord);
  else if (node) renderConceptDetail(node, discoveryContext);
  else renderOverviewDetail();
}

function renderFocusBanner(): void {
  const node = selection.nodeId ? visibleNodeById.get(selection.nodeId) : undefined;
  if (!node || viewMode !== "constellations") {
    focusBanner.hidden = true;
    return;
  }
  const context = selectionContext(node);
  const family = visibleNodeById.get(context.familyId);
  const peerCount = Math.max(0, context.familyMembers.size - (node.tier === 2 ? 1 : 2));
  focusKicker.textContent = selection.origin === "search" ? "Search focus" : node.tier === 2 ? "Constellation family" : "Focused concept";
  focusTitle.textContent = node.label;
  focusContext.textContent = node.tier === 2
    ? `${node.childIds.length} subtypes · ${context.affinityMembers.size} cross-family affinities`
    : `${family?.label ?? node.domainLabel} · ${peerCount} sibling archetypes · ${context.affinityMembers.size} cross-family affinities`;
  focusBanner.style.setProperty("--focus-color", colorFor(node));
  focusBanner.hidden = false;
}

function selectNode(
  nodeId: string | null,
  zoom: boolean,
  origin: SelectionOrigin = "click",
  discoveryContextId: string | null = null,
  refreshRelationView = true,
): void {
  const focusBelongsToDetail = detailPanel?.contains(document.activeElement) ?? false;
  setNodeSelection(nodeId, origin, discoveryContextId);
  renderDetail();
  renderFocusBanner();
  if (viewMode === "constellations") {
    updateConstellationSelection();
    updateSemanticZoom(currentTransform);
    if (zoom && nodeId) zoomToNode(nodeId);
  } else if (viewMode === "relations") {
    if (refreshRelationView) renderRelations();
    else updateRelationSelection();
  }
  if (focusBelongsToDetail) focusDetailHeading();
}

function selectionProvenanceInScope(): boolean {
  const record = discoveryRecordById(selection.discoveryContextId) ?? discoveryRecordById(selection.discoveryId);
  if (!record) return true;
  if (selectedEvidence === "framework" && record.kind !== "concept") return false;
  return !selectedSource || !record.sourceId || record.sourceId === selectedSource;
}

function reconcileFilteredSelection(): void {
  if (selection.nodeId && !visibleNodeById.has(selection.nodeId)) {
    clearSelection();
    detailPanel?.classList.remove("is-open");
  } else if (!selectionProvenanceInScope()) {
    if (selection.nodeId) downgradeSelectionToConcept();
    else clearSelection();
  }
  if (rovingNodeId && !visibleNodeById.has(rovingNodeId)) rovingNodeId = null;
}

function render(): void {
  const focusBelongsToDetail = detailPanel?.contains(document.activeElement) ?? false;
  rebuildVisibleConcepts();
  rebuildVisibleAffinities();
  reconcileFilteredSelection();
  const [kicker, description] = viewCopy[viewMode];
  viewKicker.textContent = kicker;
  viewDescription.textContent = description;
  constellationControls.hidden = viewMode !== "constellations";
  catalogueControls.hidden = viewMode !== "catalogue";
  zoomControls.hidden = viewMode !== "constellations" && viewMode !== "relations";
  document.querySelectorAll<HTMLButtonElement>(".view-button").forEach((button) => {
    const active = button.dataset.view === viewMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  searchInput.placeholder = viewMode === "research" ? "Find a source, work, or tradition…" : "Search the bounded corpus…";
  if (viewMode === "constellations") renderConstellations();
  else if (viewMode === "catalogue") renderCatalogue();
  else if (viewMode === "relations") renderRelations();
  else renderResearch();
  updateLegend();
  renderDetail();
  renderFocusBanner();
  if (focusBelongsToDetail) focusDetailHeading();
}

function populateFilters(): void {
  familyFilter.replaceChildren();
  const allFamilies = element("option") as HTMLOptionElement;
  allFamilies.value = "";
  allFamilies.textContent = "All families";
  familyFilter.append(allFamilies);
  for (const family of concepts.nodes.filter((node) => node.tier === 2).sort((left, right) => d3.ascending(left.label, right.label))) {
    const option = element("option") as HTMLOptionElement;
    option.value = family.id;
    option.textContent = `${family.domainId === "beings" ? "Being" : "Class"} · ${family.label}`;
    familyFilter.append(option);
    familyColor.set(family.id, familyPalette[familyColor.size % familyPalette.length]);
  }
  sourceFilter.replaceChildren();
  const allSources = element("option") as HTMLOptionElement;
  allSources.value = "";
  allSources.textContent = "All sources";
  sourceFilter.append(allSources);
  const mappedSources = new Set(concepts.nodes.flatMap((node) => node.sourceIds));
  for (const source of research.corpusSources.filter((item) => mappedSources.has(item.sourceId)).sort((left, right) => d3.ascending(left.title, right.title))) {
    const option = element("option") as HTMLOptionElement;
    option.value = source.sourceId;
    option.textContent = source.title;
    sourceFilter.append(option);
  }
}

function showSearchResults(query: string, limit = searchResultPageSize): void {
  searchResults.replaceChildren();
  lastSearchQuery = query;
  if (!query) {
    searchResults.hidden = true;
    return;
  }
  const allMatches = discoveryMatches(query);
  const matches = allMatches.slice(0, limit);
  if (!matches.length) {
    const empty = element("div", "search-empty");
    empty.append(
      element("strong", "", `Nothing in the accepted corpus matches “${query}”.`),
      element("span", "", "Try a character, source title, continuity, work, or source-native term. Search ignores case, accents, spaces, and punctuation."),
    );
    searchResults.append(empty);
  }
  for (const { record, fields } of matches) {
    const button = element("button", "search-result") as HTMLButtonElement;
    button.type = "button";
    button.dataset.discoveryId = record.id;
    const matchReason = fields.length
      ? `Matched ${fields.slice(0, 3).join(" · ")}`
      : "Matched indexed corpus evidence";
    const context = record.sourceTitle
      ? `${record.kindLabel} · ${record.sourceTitle}`
      : record.kindLabel;
    button.append(
      element("strong", "", record.label),
      element("span", "", context),
      element("small", "", matchReason),
    );
    if (record.characterExamples.length) {
      button.append(element("small", "result-examples", `Characters: ${record.characterExamples.slice(0, 3).join(", ")}`));
    }
    if (record.aliasNote && foldSearch(query) !== record.foldedLabel) {
      button.append(element("small", "result-caution", "Alias is scoped to this source witness; traditions are not merged."));
    }
    button.addEventListener("click", () => {
      searchInput.value = query;
      searchResults.hidden = true;
      setDiscoverySelection(record, query);
      viewMode = record.kind === "source" && !selection.nodeId ? "research" : "constellations";
      researchQuery = viewMode === "research" ? query : "";
      setConceptScopeFilter();
      selectedSource = "";
      selectedEvidence = "";
      sourceFilter.value = "";
      evidenceFilter.value = "";
      lineModeSelect.value = "none";
      render();
      requestAnimationFrame(() => {
        detailContent.querySelector<HTMLElement>("h2")?.focus();
        if (selection.nodeId && viewMode === "constellations") zoomToSelection(selection.nodeId);
      });
    });
    searchResults.append(button);
  }
  if (matches.length < allMatches.length) {
    const remaining = allMatches.length - matches.length;
    const additional = Math.min(searchResultPageSize, remaining);
    const more = element("button", "search-more", `Show ${additional} more · ${remaining} remaining`) as HTMLButtonElement;
    more.type = "button";
    more.addEventListener("click", () => {
      showSearchResults(query, matches.length + searchResultPageSize);
      requestAnimationFrame(() => {
        const resultButtons = searchResults.querySelectorAll<HTMLButtonElement>(".search-result");
        resultButtons[matches.length]?.focus();
      });
    });
    searchResults.append(more);
  }
  searchResults.hidden = false;
}

function fitView(): void {
  if (!currentZoom) return;
  d3.select(svgElement).transition().duration(motionDuration(450)).call(currentZoom.transform, d3.zoomIdentity);
}

function setMobileControlsOpen(open: boolean): void {
  lensPanel.classList.toggle("is-open", open);
  mobileControlsToggle.setAttribute("aria-expanded", String(open));
}

function bindEvents(): void {
  mobileControlsToggle.addEventListener("click", () => {
    const open = mobileControlsToggle.getAttribute("aria-expanded") !== "true";
    if (open) detailPanel?.classList.remove("is-open");
    setMobileControlsOpen(open);
  });
  document.querySelectorAll<HTMLButtonElement>(".view-button").forEach((button) => {
    button.addEventListener("click", () => {
      const query = selection.query ?? searchInput.value.trim();
      searchInput.value = query;
      viewMode = button.dataset.view as ViewMode;
      researchQuery = viewMode === "research" ? query : "";
      setMobileControlsOpen(false);
      render();
      showSearchResults(query);
    });
  });
  domainFilter.addEventListener("change", () => {
    setConceptScopeFilter(domainFilter.value as "" | DomainId);
    render();
  });
  detailLevelSelect.addEventListener("change", () => {
    detailLevel = detailLevelSelect.value as DetailLevel;
    if (viewMode === "constellations") updateSemanticZoom(currentTransform);
  });
  lineModeSelect.addEventListener("change", () => {
    if (viewMode === "constellations") {
      updateSemanticZoom(currentTransform);
      updateConstellationSelection();
    }
  });
  familyFilter.addEventListener("change", () => {
    setConceptScopeFilter("", familyFilter.value);
    render();
  });
  sourceFilter.addEventListener("change", () => {
    selectedSource = sourceFilter.value;
    render();
  });
  evidenceFilter.addEventListener("change", () => {
    selectedEvidence = evidenceFilter.value as EvidenceFilter;
    render();
  });
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    detachSelectionQuery();
    if (viewMode === "research") {
      researchQuery = query;
      renderResearch();
    }
    showSearchResults(query);
  });
  searchInput.addEventListener("focus", () => {
    if (window.matchMedia("(max-width: 1040px)").matches) {
      setMobileControlsOpen(false);
      detailPanel?.classList.remove("is-open");
    }
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchInput.value = "";
      detachSelectionQuery();
      researchQuery = "";
      if (viewMode === "research") renderResearch();
      showSearchResults("");
    }
    if (event.key === "Enter") {
      const first = searchResults.querySelector<HTMLButtonElement>(".search-result");
      first?.click();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== searchInput) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === "Escape" && document.activeElement !== searchInput) {
      if (lensPanel.classList.contains("is-open")) {
        setMobileControlsOpen(false);
        mobileControlsToggle.focus();
      } else {
        closeDetail();
      }
    }
  });
  byId<HTMLButtonElement>("reset-view").addEventListener("click", () => {
    clearSelection();
    setConceptScopeFilter();
    selectedSource = "";
    selectedEvidence = "";
    detailLevel = "auto";
    sourceFilter.value = "";
    evidenceFilter.value = "";
    detailLevelSelect.value = "auto";
    lineModeSelect.value = "none";
    searchInput.value = "";
    researchQuery = "";
    setMobileControlsOpen(false);
    render();
    showSearchResults("");
  });
  byId<HTMLButtonElement>("zoom-in").addEventListener("click", () => {
    if (currentZoom) d3.select(svgElement).transition().duration(motionDuration(250)).call(currentZoom.scaleBy, 1.5);
  });
  byId<HTMLButtonElement>("zoom-out").addEventListener("click", () => {
    if (currentZoom) d3.select(svgElement).transition().duration(motionDuration(250)).call(currentZoom.scaleBy, 1 / 1.5);
  });
  byId<HTMLButtonElement>("fit-view").addEventListener("click", fitView);
  byId<HTMLButtonElement>("focus-relations").addEventListener("click", () => {
    if (!selection.nodeId) return;
    const nodeId = selection.nodeId;
    viewMode = "relations";
    render();
    requestAnimationFrame(() => {
      const mark = [...document.querySelectorAll<SVGGElement>("#atlas-svg .relation-star")]
        .find((candidate) => candidate.dataset.nodeId === nodeId && candidate.isConnected);
      (mark ?? detailContent.querySelector<HTMLElement>("h2") ?? searchInput).focus();
    });
  });
  byId<HTMLButtonElement>("focus-clear").addEventListener("click", () => {
    selectNode(null, false);
    fitView();
    searchInput.focus();
  });
  document.querySelector<HTMLAnchorElement>(".brand")?.addEventListener("click", (event) => {
    event.preventDefault();
    viewMode = "constellations";
    clearSelection();
    setMobileControlsOpen(false);
    render();
  });
  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 1040px)").matches) setMobileControlsOpen(false);
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (viewMode === "constellations" || viewMode === "relations") render();
    }, 150);
  });
}

function showLoadingState(message: string): void {
  const star = element("span", "loader-star", "✦");
  star.setAttribute("aria-hidden", "true");
  loading.removeAttribute("role");
  loading.setAttribute("aria-live", "polite");
  loading.replaceChildren(star, element("p", "", message));
  if (!loading.isConnected) stage.append(loading);
}

function showLoadError(message: string, retryLabel: string, retry: () => Promise<void>): void {
  searchInput.disabled = true;
  searchInput.removeAttribute("aria-busy");
  const retryButton = element("button", "primary-button", retryLabel);
  retryButton.type = "button";
  retryButton.addEventListener("click", () => void retry());
  loading.setAttribute("role", "alert");
  loading.setAttribute("aria-live", "assertive");
  loading.replaceChildren(element("p", "", message), retryButton);
  if (!loading.isConnected) stage.append(loading);
  requestAnimationFrame(() => retryButton.focus());
}

function showDiscoveryProgress(): void {
  discoveryNotice.setAttribute("role", "status");
  discoveryNotice.setAttribute("aria-live", "polite");
  discoveryNotice.replaceChildren(element("p", "", "Retrying corpus discovery…"));
  discoveryNotice.hidden = false;
}

function showDiscoveryError(message: string): void {
  searchInput.disabled = true;
  searchInput.removeAttribute("aria-busy");
  const retryButton = element("button", "primary-button", "Retry discovery");
  retryButton.type = "button";
  retryButton.addEventListener("click", () => void loadDiscoveryData(true));
  discoveryNotice.setAttribute("role", "alert");
  discoveryNotice.setAttribute("aria-live", "assertive");
  discoveryNotice.replaceChildren(
    element("p", "", `${message}. Search is unavailable; the loaded atlas views remain available.`),
    retryButton,
  );
  discoveryNotice.hidden = false;
  requestAnimationFrame(() => retryButton.focus());
}

async function loadDiscoveryData(showProgress = false): Promise<void> {
  searchInput.disabled = true;
  searchInput.setAttribute("aria-busy", "true");
  searchInput.placeholder = "Loading corpus discovery…";
  if (showProgress) showDiscoveryProgress();
  try {
    const discoveryResponse = await fetch(assetUrl("data/discovery.json"));
    if (!discoveryResponse.ok) throw new Error("Unable to load corpus discovery data");
    const loadedDiscovery = (await discoveryResponse.json()) as DiscoveryPayload;
    for (const [dimension, label] of Object.entries(research.dimensionLabels)) {
      if (loadedDiscovery.meta.dimensionLabels[dimension] !== label) {
        throw new Error(`Discovery dimension schema is out of sync for ${dimension}`);
      }
    }
    discovery = loadedDiscovery;
    foldingMap = discovery.meta.foldingMap ?? {};
    discoveryLookup = buildDiscoveryLookup(discovery.records);
    dimensionLabels = discovery.meta.dimensionLabels;
    searchInput.disabled = false;
    searchInput.removeAttribute("aria-busy");
    searchInput.placeholder = viewMode === "research" ? "Find a source, work, or tradition…" : "Search the bounded corpus…";
    discoveryNotice.hidden = true;
    discoveryNotice.replaceChildren();
    if (showProgress) searchInput.focus();
  } catch (error) {
    searchInput.placeholder = "Corpus discovery unavailable";
    const message = error instanceof Error ? error.message : "Unable to load corpus discovery data";
    showDiscoveryError(message);
  }
}

async function loadData(): Promise<void> {
  searchInput.disabled = true;
  searchInput.setAttribute("aria-busy", "true");
  showLoadingState("Charting constellations…");
  let loadedConcepts: ConstellationPayload;
  let loadedResearch: ResearchPayload;
  try {
    const [conceptResponse, researchResponse] = await Promise.all([
      fetch(assetUrl("data/constellations.json")),
      fetch(assetUrl("data/characters.json")),
    ]);
    if (!conceptResponse.ok || !researchResponse.ok) throw new Error("Unable to load compiled atlas data");
    loadedConcepts = (await conceptResponse.json()) as ConstellationPayload;
    loadedResearch = (await researchResponse.json()) as ResearchPayload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the atlas.";
    showLoadError(message, "Retry atlas data", loadData);
    return;
  }

  concepts = loadedConcepts;
  research = loadedResearch;
  dimensionLabels = research.dimensionLabels;
  for (const domain of concepts.domains) domainById.set(domain.id, domain);
  for (const node of concepts.nodes) nodeById.set(node.id, node);
  taxonomyEdges.push(...concepts.edges.filter((edge) => edge.kind === "taxonomy"));
  affinityEdges.push(...concepts.edges.filter((edge) => edge.kind === "affinity"));
  for (const audit of research.sources) auditBySource.set(audit.source_id, audit);
  for (const source of research.corpusSources) corpusBySource.set(source.sourceId, source);
  for (const character of research.characters) characterById.set(character.character_id, character);
  for (const term of research.sourceTerms) sourceTermById.set(term.term_id, term);
  populateFilters();
  bindEvents();
  updateLegend();
  render();
  loading.remove();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await loadDiscoveryData();
}

void loadData();
