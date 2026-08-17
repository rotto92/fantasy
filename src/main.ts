import * as d3 from "d3";
import "./style.css";

type ViewMode = "constellations" | "catalogue" | "relations" | "research";
type DomainId = "beings" | "classes";
type DetailLevel = "auto" | "families" | "all";
type LineMode = "taxonomy" | "all" | "none";
type EvidenceFilter = "" | "evidenced" | "framework";
type SelectionOrigin = "click" | "search" | null;
type DiscoveryKind = "concept" | "character" | "dimension-term" | "source-term" | "source";

interface ConstellationExample {
  id: string;
  kind: "source-entry" | "character-example" | "source-term";
  label: string;
  sourceId: string;
  sourceTitle: string;
  continuity: string;
  summary: string;
  distinction: string;
  evidenceLevel: string;
  url: string;
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
  examples: ConstellationExample[];
}

interface ConceptEdge {
  id: string;
  source: string;
  target: string;
  kind: "taxonomy" | "affinity";
  label: string;
  weight: number;
  evidence?: Array<{ id: string; kind: string }>;
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
    generatedAt: string;
    visualContract: string;
    counts: {
      nodes: number;
      families: number;
      specificArchetypes: number;
      taxonomyEdges: number;
      affinityEdges: number;
      sourceExamples: number;
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
  completion_status: string;
  completed_character_count: number;
  citations: Citation[];
  independent_review?: { review_types: string[] };
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
  canonical_term: string;
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
  corpusSources: CorpusSource[];
  sources: SourceAudit[];
  characters: ResearchCharacter[];
  relationships: Array<{ relationship_id: string; source_id: string }>;
  sourceTerms: ResearchSourceTerm[];
}

interface DiscoveryField {
  label: string;
  value: string;
  foldedValue: string;
  foldedTokens: string[];
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
  conceptId?: string;
  url: string;
  searchFields: DiscoveryField[];
  searchText: string;
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

const dimensionLabels: Record<string, string> = {
  being_types: "Being / species / entity",
  cultures: "Culture / people",
  roles_and_vocations: "Role / class / vocation",
  power_traditions: "Power / tradition",
  affiliations: "Affiliation / institution",
  states_and_transformations: "State / transformation",
  artifacts_and_vehicles: "Artifact / vehicle",
  cosmologies_and_realms: "Cosmology / realm",
  metaphysical_laws_and_rituals: "Law / ritual",
  narrative_archetypes: "Narrative archetype",
  game_mechanics: "Game mechanic",
};

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
let discovery: DiscoveryPayload;
let viewMode: ViewMode = "constellations";
let selectedNodeId: string | null = null;
let selectedDiscoveryId: string | null = null;
let selectionOrigin: SelectionOrigin = null;
let selectedDomain = "" as "" | DomainId;
let selectedFamily = "";
let selectedSource = "";
let selectedEvidence: EvidenceFilter = "";
let detailLevel: DetailLevel = "auto";
let lineMode: LineMode = "taxonomy";
let researchQuery = "";
let lastSearchQuery = "";
let currentZoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
let currentTransform = d3.zoomIdentity;
let resizeTimer = 0;

const nodeById = new Map<string, ConceptNode>();
const domainById = new Map<DomainId, DomainRecord>();
const auditBySource = new Map<string, SourceAudit>();
const corpusBySource = new Map<string, CorpusSource>();
const characterById = new Map<string, ResearchCharacter>();
const sourceTermById = new Map<string, ResearchSourceTerm>();
const positionById = new Map<string, PositionedNode>();
const familyColor = new Map<string, string>();
const taxonomyEdges: ConceptEdge[] = [];
const affinityEdges: ConceptEdge[] = [];

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

function foldSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function motionDuration(duration: number): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : duration;
}

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
}

function discoveryRecordById(id: string | null): DiscoveryRecord | undefined {
  return id ? discovery.records.find((record) => record.id === id) : undefined;
}

function matchedDiscoveryFields(record: DiscoveryRecord, foldedQuery: string): string[] {
  if (!foldedQuery) return [];
  return [...new Set(
    record.searchFields
      .filter((field) => field.foldedValue === foldedQuery || field.foldedTokens.some((token) => token === foldedQuery || token.startsWith(foldedQuery)))
      .map((field) => field.label),
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
  const foldedQuery = foldSearch(query);
  if (!foldedQuery) return [];
  return discovery.records
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

function visibleConcepts(): ConceptNode[] {
  const leaves = concepts.nodes.filter(passesLeafFilters);
  const leafFamilies = new Set(leaves.map((node) => node.familyId));
  const families = concepts.nodes.filter((node) => {
    if (node.tier !== 2) return false;
    if (selectedDomain && node.domainId !== selectedDomain) return false;
    if (selectedFamily && node.id !== selectedFamily) return false;
    if (!selectedSource && !selectedEvidence) return true;
    return leafFamilies.has(node.id) || (selectedSource ? node.sourceIds.includes(selectedSource) : node.evidenceCount > 0);
  });
  return [...families, ...leaves];
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

function updateScope(nodes = visibleConcepts()): void {
  const leafCount = nodes.filter((node) => node.tier === 3).length;
  const familyCount = nodes.filter((node) => node.tier === 2).length;
  const evidencedCount = nodes.filter((node) => node.evidenceCount > 0).length;
  const sourceCount = new Set(nodes.flatMap((node) => node.sourceIds)).size;
  visibleCount.textContent = `${nodes.length.toLocaleString()} concept stars`;
  scopeSummary.replaceChildren();
  const facts: Array<[number, string]> = [
    [familyCount, "constellations"],
    [leafCount, "specific archetypes"],
    [evidencedCount, "evidenced stars"],
    [sourceCount, "mapped sources"],
  ];
  for (const [count, label] of facts) {
    const fact = element("div", "scope-fact");
    fact.append(element("strong", "", count.toLocaleString()), element("span", "", label));
    scopeSummary.append(fact);
  }
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
      const family = nodeById.get(packedFamily.data.id);
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

function activateNode(positioned: PositionedNode): void {
  selectNode(positioned.node.id, false);
  if (positioned.node.tier === 2) zoomToNode(positioned.node.id);
}

function handleNodeKeydown(event: KeyboardEvent, positioned: PositionedNode): void {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  activateNode(positioned);
}

function hideTooltip(): void {
  tooltip.hidden = true;
}

function selectionContext(node: ConceptNode): SelectionContext {
  const familyId = node.tier === 2 ? node.id : node.familyId;
  const familyMembers = new Set(
    concepts.nodes
      .filter((candidate) => candidate.id === familyId || candidate.familyId === familyId)
      .map((candidate) => candidate.id),
  );
  const affinityMembers = new Set<string>();
  for (const edge of affinityEdges) {
    if (edge.source === node.id) affinityMembers.add(edge.target);
    if (edge.target === node.id) affinityMembers.add(edge.source);
  }
  const related = new Set<string>([node.id, ...familyMembers, ...affinityMembers]);
  return { familyId, familyMembers, affinityMembers, related };
}

function focusLabelIds(node: ConceptNode, context: SelectionContext, includePeers: boolean): Set<string> {
  const labels = new Set<string>([node.id, ...context.affinityMembers]);
  if (!includePeers) return labels;
  const closestPeers = concepts.nodes
    .filter((candidate) => candidate.tier === 3 && candidate.familyId === context.familyId && candidate.id !== node.id)
    .sort((left, right) => d3.descending(left.evidenceCount, right.evidenceCount) || d3.ascending(left.label, right.label))
    .slice(0, 6);
  for (const peer of closestPeers) labels.add(peer.id);
  return labels;
}

function updateConstellationSelection(): void {
  const selected = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
  const context = selected ? selectionContext(selected) : undefined;
  const svg = d3.select(svgElement);
  svg
    .selectAll<SVGGElement, PositionedNode>(".concept-star")
    .classed("is-selected", (positioned) => positioned.node.id === selectedNodeId)
    .classed("is-family-member", (positioned) => Boolean(context?.familyMembers.has(positioned.node.id)))
    .classed("is-affinity-related", (positioned) => Boolean(context?.affinityMembers.has(positioned.node.id)))
    .classed("is-related", (positioned) => Boolean(context?.related.has(positioned.node.id)))
    .classed("is-dimmed", (positioned) => Boolean(context && !context.related.has(positioned.node.id)));
  svg
    .selectAll<SVGLineElement, ConceptEdge>(".affinity-line")
    .style("display", (edge) =>
      lineMode === "all" && selected && (edge.source === selected.id || edge.target === selected.id) ? "" : "none",
    )
    .classed("is-active-relation", (edge) => Boolean(selected && (edge.source === selected.id || edge.target === selected.id)));
  svg
    .selectAll<SVGLineElement, ConceptEdge>(".taxonomy-line")
    .classed("is-active-relation", (edge) => Boolean(context && edge.source === context.familyId));
}

function updateSemanticZoom(transform: d3.ZoomTransform): void {
  const svg = d3.select(svgElement);
  const filtersActive = Boolean(selectedSource || selectedEvidence || selectedFamily);
  const compactViewport = stage.clientWidth < 620;
  const selected = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
  const context = selected ? selectionContext(selected) : undefined;
  const focusedLabels = selected && context ? focusLabelIds(selected, context, transform.k >= 2.8) : new Set<string>();
  const familyPosition = context ? positionById.get(context.familyId) : undefined;
  const showSpecific = Boolean(selected) || detailLevel === "all" || (detailLevel === "auto" && (!compactViewport || transform.k >= 1.3));
  const showSpecificLabels =
    detailLevel === "all" ? transform.k >= 1.5 : transform.k >= (filtersActive ? 2.25 : 3.35);
  const glyphScale = 1 / Math.pow(transform.k, 0.58);
  svg.selectAll<SVGGElement, PositionedNode>(".star-glyph").attr("transform", `scale(${glyphScale})`);
  svg
    .selectAll<SVGGElement, PositionedNode>(".specific-star")
    .style("display", showSpecific ? "" : "none")
    .style("opacity", showSpecific ? (transform.k > 1.25 ? 0.96 : 0.62) : 0);
  svg
    .selectAll<SVGTextElement, PositionedNode>(".specific-label")
    .style("display", (positioned) =>
      selected
        ? (focusedLabels.has(positioned.node.id) || (transform.k >= 6 && context?.familyMembers.has(positioned.node.id)) ? "" : "none")
        : (showSpecific && showSpecificLabels ? "" : "none"),
    )
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
    .style("font-size", `${Math.max(10, 9) / transform.k}px`)
    .style("stroke-width", `${3.2 / transform.k}px`);
  svg
    .selectAll<SVGTextElement, PositionedNode>(".family-label")
    .attr("y", (positioned) => {
      const offset = compactViewport ? positioned.clusterR + 11 : -positioned.clusterR - 5;
      return offset / transform.k;
    })
    .style("font-size", `${Math.max(compactViewport ? 9 : 10.5, compactViewport ? 8.4 : 10.5) / transform.k}px`)
    .style("stroke-width", `${3.2 / transform.k}px`);
  svg.selectAll<SVGTextElement, unknown>(".sky-title").style("display", transform.k > 1.55 ? "none" : "");
  svg
    .selectAll<SVGLineElement, ConceptEdge>(".taxonomy-line")
    .style("display", lineMode === "none" || !showSpecific ? "none" : "")
    .style("stroke-opacity", (edge) => context
      ? (edge.source === context.familyId ? 0.5 : 0.025)
      : (transform.k > 1.3 ? 0.27 : 0.13));
  svg
    .selectAll<SVGCircleElement, PositionedNode>(".constellation-boundary")
    .style("stroke-opacity", (positioned) => context
      ? (positioned.node.id === context.familyId ? 0.52 : 0.035)
      : (transform.k > 1.5 ? 0.25 : 0.14));
  const affinityOpacity = Math.max(0, Math.min(1, (3.4 - transform.k) / 0.75));
  svg.selectAll<SVGLineElement, ConceptEdge>(".affinity-line").style("stroke-opacity", affinityOpacity);
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
  const visibleIds = new Set(positions.map((positioned) => positioned.node.id));
  const visibleTaxonomy = taxonomyEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));
  const visibleAffinity = affinityEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target));

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

  layer
    .append("g")
    .attr("class", "taxonomy-lines")
    .selectAll("line")
    .data(visibleTaxonomy)
    .join("line")
    .attr("class", "constellation-line taxonomy-line")
    .attr("x1", (edge) => positionById.get(edge.source)?.x ?? 0)
    .attr("y1", (edge) => positionById.get(edge.source)?.y ?? 0)
    .attr("x2", (edge) => positionById.get(edge.target)?.x ?? 0)
    .attr("y2", (edge) => positionById.get(edge.target)?.y ?? 0)
    .attr("stroke", (edge) => colorFor(nodeById.get(edge.target)!));

  layer
    .append("g")
    .attr("class", "affinity-lines")
    .selectAll("line")
    .data(visibleAffinity)
    .join("line")
    .attr("class", "constellation-line affinity-line")
    .attr("x1", (edge) => positionById.get(edge.source)?.x ?? 0)
    .attr("y1", (edge) => positionById.get(edge.source)?.y ?? 0)
    .attr("x2", (edge) => positionById.get(edge.target)?.x ?? 0)
    .attr("y2", (edge) => positionById.get(edge.target)?.y ?? 0)
    .attr("stroke-width", (edge) => 0.7 + Math.min(3, Math.log2(edge.weight + 1)))
    .style("display", "none");

  const marks = layer
    .append("g")
    .attr("class", "concept-stars")
    .selectAll<SVGGElement, PositionedNode>("g")
    .data(positions, (positioned) => positioned.node.id)
    .join("g")
    .attr("class", (positioned) =>
      `concept-star ${positioned.node.tier === 2 ? "family-star" : "specific-star"} ${positioned.node.nodeKind}`,
    )
    .attr("transform", (positioned) => `translate(${positioned.x},${positioned.y})`);
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
    .attr("tabindex", 0)
    .attr("focusable", "true")
    .attr("aria-label", (positioned) => accessibleNodeLabel(positioned.node))
    .on("mouseenter", (event, positioned) => showTooltip(event as MouseEvent, positioned.node))
    .on("mousemove", (event, positioned) => showTooltip(event as MouseEvent, positioned.node))
    .on("mouseleave", hideTooltip)
    .on("focus", (_event, positioned) => selectNode(positioned.node.id, false))
    .on("keydown", handleNodeKeydown)
    .on("click", (event, positioned) => {
      event.stopPropagation();
      activateNode(positioned);
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
    if (edge.target === node.id) add(nodeById.get(edge.source), "parent", edge);
    if (edge.source === node.id) add(nodeById.get(edge.target), "child", edge);
  }
  if (node.tier === 3) {
    const siblings = concepts.nodes
      .filter((candidate) => candidate.parentId === node.parentId && candidate.id !== node.id)
      .sort((left, right) => d3.descending(left.evidenceCount, right.evidenceCount) || d3.ascending(left.label, right.label))
      .slice(0, 8);
    for (const sibling of siblings) add(sibling, "sibling", null);
  }
  const affinities = affinityEdges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .sort((left, right) => d3.descending(left.weight, right.weight))
    .slice(0, 10);
  for (const edge of affinities) add(nodeById.get(edge.source === node.id ? edge.target : edge.source), "affinity", edge);
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
  const selected = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
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
    .attr("stroke-width", (neighbor) => (neighbor.relation === "affinity" ? 1 + Math.min(4, Math.log2((neighbor.edge?.weight ?? 1) + 1)) : 1.2));
  const marks = layer
    .append("g")
    .selectAll<SVGGElement, PositionedNode>("g")
    .data(positioned)
    .join("g")
    .attr("class", (item) => `concept-star relation-star ${item.node.id === selected.id ? "is-selected" : ""}`)
    .attr("transform", (item) => `translate(${item.x},${item.y})`);
  marks.append("circle").attr("class", "star-corona").attr("r", (item) => item.r * 3).attr("fill", (item) => colorFor(item.node));
  marks.append("path").attr("class", "family-core").attr("d", (item) => starPath(item.r, item.r * 0.42, 5)).attr("fill", (item) => colorFor(item.node));
  marks
    .append("text")
    .attr("class", "relation-label")
    .attr("text-anchor", "middle")
    .attr("y", (item) => item.r + 18)
    .text((item) => compactLabel(chartLabel(item.node), 24));
  marks
    .attr("role", "button")
    .attr("tabindex", 0)
    .attr("focusable", "true")
    .attr("aria-label", (item) => accessibleNodeLabel(item.node))
    .on("mouseenter", (event, item) => showTooltip(event as MouseEvent, item.node))
    .on("mousemove", (event, item) => showTooltip(event as MouseEvent, item.node))
    .on("mouseleave", hideTooltip)
    .on("focus", (_event, item) => selectNode(item.node.id, false))
    .on("keydown", handleNodeKeydown)
    .on("click", (_event, item) => selectNode(item.node.id, false));
  installZoom(svg, layer, () => undefined);
  updateScope(positioned.map((item) => item.node));
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
    heading.style.setProperty("--family-color", colorFor(family));
    heading.append(element("span", "catalogue-star", "✦"));
    const headingCopy = element("span");
    headingCopy.append(element("strong", "", family.label), element("small", "", `${children.length} specific archetypes · ${family.sourceCount} mapped sources`));
    heading.append(headingCopy);
    heading.addEventListener("click", () => selectNode(family.id, false));
    section.append(heading);
    const grid = element("div", "concept-card-grid");
    for (const node of children) {
      const card = element("button", "concept-card") as HTMLButtonElement;
      card.type = "button";
      card.style.setProperty("--family-color", colorFor(node));
      card.append(element("strong", "", node.label));
      card.append(element("span", "", compactLabel(node.definition || "Framework archetype", 145)));
      card.append(element("small", "", node.evidenceCount ? `${node.sourceCount} sources · ${node.evidenceCount} examples` : "Framework only · evidence mapping pending"));
      card.addEventListener("click", () => selectNode(node.id, false));
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
  const characterCounts = d3.rollup(research.characters, (values) => values.length, (record) => record.source_id);
  const relationCounts = d3.rollup(research.relationships, (values) => values.length, (record) => record.source_id);
  const termCounts = d3.rollup(research.sourceTerms, (values) => values.length, (record) => record.source_id);
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
  for (const label of ["Source / continuity", "Priority", "Scope", "Characters", "Relations", "Terms", "Pass status", "Independent review"]) {
    headerRow.append(element("th", "", label));
  }
  header.append(headerRow);
  table.append(header);
  const body = element("tbody");
  const sources = research.corpusSources
    .filter((source) => !selectedSource || source.sourceId === selectedSource)
    .filter((source) => {
      if (!researchQuery) return true;
      return [source.title, source.medium, source.region, source.priorityTier].join(" ").toLocaleLowerCase().includes(researchQuery);
    })
    .sort((left, right) => d3.ascending(left.title, right.title));
  for (const source of sources) {
    const audit = auditBySource.get(source.sourceId);
    const row = element("tr", "is-researched");
    const sourceCell = element("td", "source-cell");
    sourceCell.append(element("strong", "", source.title), element("span", "", `${source.medium} · ${source.region}`));
    row.append(sourceCell, element("td", "", source.priorityTier), element("td", "scope-cell", audit?.continuity_scope ?? source.continuityUnit));
    row.append(element("td", "number-cell", String(characterCounts.get(source.sourceId) ?? 0)));
    row.append(element("td", "number-cell", String(relationCounts.get(source.sourceId) ?? 0)));
    row.append(element("td", "number-cell", String(termCounts.get(source.sourceId) ?? 0)));
    const status = element("td");
    status.append(element("span", "status-pill complete", audit ? "Complete for scope" : "Missing"));
    row.append(status);
    const review = element("td");
    const hasReview = Boolean(audit?.independent_review?.review_types?.length);
    review.append(element("span", `status-pill ${hasReview ? "complete" : "not-started"}`, hasReview ? "Focused review" : "Second review pending"));
    row.append(review);
    body.append(row);
  }
  table.append(body);
  tableWrap.append(table);
  board.append(tableWrap);
  visibleCount.textContent = `${sources.length} source passes`;
}

function detailSection(title: string): HTMLElement {
  const section = element("section", "detail-section");
  section.append(element("h3", "", title));
  return section;
}

function closeDetail(): void {
  selectedNodeId = null;
  selectedDiscoveryId = null;
  selectionOrigin = null;
  detailPanel?.classList.remove("is-open");
  renderDetail();
  renderFocusBanner();
  if (viewMode === "constellations") {
    updateConstellationSelection();
    updateSemanticZoom(currentTransform);
  }
}

function renderDiscoveryDetail(record: DiscoveryRecord): void {
  detailContent.replaceChildren();
  detailPanel?.classList.add("is-open");
  const close = element("button", "mobile-detail-close", "×") as HTMLButtonElement;
  close.type = "button";
  close.setAttribute("aria-label", "Close discovery detail");
  close.addEventListener("click", closeDetail);
  detailContent.append(close);

  const header = element("header", "character-header discovery-detail-header");
  header.append(element("p", "eyebrow", record.kindLabel));
  header.append(element("h2", "", record.label));
  header.append(element("p", "character-subtitle", [record.sourceTitle, record.continuity].filter(Boolean).join(" · ") || "Accepted corpus record"));
  const evidence = element("div", "evidence-row");
  evidence.append(element("span", "evidence-badge researched", "Indexed evidence"));
  evidence.append(element("span", "", `${record.characterIds.length || record.characterExamples.length} character examples · ${record.relatedConceptIds.length} normalized links`));
  header.append(evidence);
  detailContent.append(header);

  const actions = element("div", "detail-actions");
  if (selectedNodeId && nodeById.has(selectedNodeId)) {
    const concept = element("button", "primary-button", "Open related concept") as HTMLButtonElement;
    concept.type = "button";
    concept.addEventListener("click", () => {
      selectedDiscoveryId = null;
      selectNode(selectedNodeId, true, "search");
    });
    actions.append(concept);
    const relations = element("button", "secondary-button", "Show relations") as HTMLButtonElement;
    relations.type = "button";
    relations.addEventListener("click", () => {
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
  for (const [label, value] of [
    ["Source / series", record.sourceTitle],
    ["Continuity", record.continuity],
    ["Work / witness", record.work],
    ["Evidence dimension", dimensionLabels[record.dimension] ?? record.dimension],
  ]) {
    if (!value) continue;
    const item = element("div", "attribute-item");
    item.append(element("small", "", label), element("span", "", value));
    contextGrid.append(item);
  }
  context.append(contextGrid);
  detailContent.append(context);

  const relatedConcepts = detailSection("Related normalized concepts");
  const relatedList = element("div", "relation-list");
  const conceptNodes = record.relatedConceptIds.map((id) => nodeById.get(id)).filter((node): node is ConceptNode => Boolean(node));
  for (const node of conceptNodes.slice(0, 12)) {
    const button = element("button", "relation-button") as HTMLButtonElement;
    button.type = "button";
    button.append(element("span", "relation-star", "✦"), element("strong", "", node.label), element("small", "", `${node.domainLabel} · ${node.sourceCount} sources`));
    button.addEventListener("click", () => {
      selectedDiscoveryId = null;
      selectNode(node.id, true, "search");
    });
    relatedList.append(button);
  }
  if (!conceptNodes.length) relatedList.append(element("p", "detail-copy", "No normalized archetype ID is recorded for this evidence. It stays source-native and is not promoted to a graph node."));
  relatedConcepts.append(relatedList);
  detailContent.append(relatedConcepts);

  if (record.sourceId) {
    const connections = detailSection("Series connections");
    const sourceConnections = discovery.meta.sourceConnections[record.sourceId] ?? [];
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
    card.append(element("small", "", character.description));
    if (character.citations[0]?.url) {
      const link = element("a", "evidence-link", "Open supporting citation") as HTMLAnchorElement;
      link.href = character.citations[0].url;
      link.target = "_blank";
      link.rel = "noreferrer";
      card.append(link);
    }
    characterSection.append(card);
  }
  if (!characters.length && record.kind !== "source") characterSection.append(element("p", "detail-copy", "This source-native record has no character example in its witness; its citation remains the evidence anchor."));
  if (record.kind === "source") {
    characterSection.append(element("p", "detail-copy", `${record.characterExamples.length} representative character records are indexed for this source. Search a name to inspect its bounded evidence.`));
  }
  detailContent.append(characterSection);

  if (record.kind === "source-term") {
    const term = sourceTermById.get(record.id.replace("source-term:", ""));
    if (term) {
      const evidenceSection = detailSection("Term evidence and caution");
      evidenceSection.append(element("p", "detail-copy", term.definition || "A source-native terminology record."));
      if (term.original_language) evidenceSection.append(element("p", "dimension-note", `Source language: ${term.original_language}`));
      if (term.original_script || term.transliteration) evidenceSection.append(element("p", "dimension-note", [term.original_script, term.transliteration].filter(Boolean).join(" · ")));
      if (term.cultural_caution) evidenceSection.append(element("p", "dimension-note", term.cultural_caution));
      const citation = term.citations[0];
      if (citation?.url) {
        const link = element("a", "citation-card", `${citation.locator} ↗`) as HTMLAnchorElement;
        link.href = citation.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        evidenceSection.append(link);
      }
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
  const affinity = affinityEdges.find(
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
  close.addEventListener("click", () => detailPanel?.classList.remove("is-open"));
  detailContent.append(close);
  const header = element("header", "character-header concept-detail-header");
  header.append(element("p", "eyebrow", node.tier === 2 ? `${node.domainLabel} family` : node.domainLabel));
  header.append(element("h2", "", node.label));
  const parent = node.parentId ? nodeById.get(node.parentId) : undefined;
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
      const card = example.url ? element("a", "citation-card") : element("div", "citation-card");
      if (card instanceof HTMLAnchorElement) {
        card.href = example.url;
        card.target = "_blank";
        card.rel = "noreferrer";
      }
      card.append(element("strong", "", example.label));
      const character = characterById.get(example.id);
      const term = sourceTermById.get(example.id);
      const citation = character?.citations[0] ?? term?.citations[0];
      const work = character?.work_or_witness;
      card.append(element("span", "", [example.sourceTitle, example.continuity, work, titleCase(example.kind)].filter(Boolean).join(" · ")));
      if (example.evidenceLevel || citation?.locator) card.append(element("small", "", [example.evidenceLevel, citation?.locator].filter(Boolean).join(" · ")));
      if (example.summary) card.append(element("small", "", compactLabel(example.summary, 240)));
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
  const discoveryRecord = discoveryRecordById(selectedDiscoveryId);
  const node = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
  if (discoveryRecord?.kind !== "concept" && discoveryRecord) renderDiscoveryDetail(discoveryRecord);
  else if (node) renderConceptDetail(node, discoveryRecord?.kind === "concept" ? discoveryRecord : undefined);
  else renderOverviewDetail();
}

function renderFocusBanner(): void {
  const node = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
  if (!node || viewMode !== "constellations") {
    focusBanner.hidden = true;
    return;
  }
  const context = selectionContext(node);
  const family = nodeById.get(context.familyId);
  const peerCount = Math.max(0, context.familyMembers.size - (node.tier === 2 ? 1 : 2));
  focusKicker.textContent = selectionOrigin === "search" ? "Search focus" : node.tier === 2 ? "Constellation family" : "Focused concept";
  focusTitle.textContent = node.label;
  focusContext.textContent = node.tier === 2
    ? `${node.childIds.length} subtypes · ${context.affinityMembers.size} cross-family affinities`
    : `${family?.label ?? node.domainLabel} · ${peerCount} sibling archetypes · ${context.affinityMembers.size} cross-family affinities`;
  focusBanner.style.setProperty("--focus-color", colorFor(node));
  focusBanner.hidden = false;
}

function selectNode(nodeId: string | null, zoom: boolean, origin: SelectionOrigin = "click"): void {
  selectedDiscoveryId = null;
  selectedNodeId = nodeId;
  selectionOrigin = nodeId ? origin : null;
  renderDetail();
  renderFocusBanner();
  if (viewMode === "constellations") {
    updateConstellationSelection();
    updateSemanticZoom(currentTransform);
    if (zoom && nodeId) zoomToNode(nodeId);
  } else if (viewMode === "relations") {
    renderRelations();
  }
}

function render(): void {
  const [kicker, description] = viewCopy[viewMode];
  viewKicker.textContent = kicker;
  viewDescription.textContent = description;
  constellationControls.hidden = viewMode !== "constellations";
  catalogueControls.hidden = viewMode !== "catalogue";
  zoomControls.hidden = viewMode !== "constellations" && viewMode !== "relations";
  document.querySelectorAll<HTMLButtonElement>(".view-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewMode);
  });
  searchInput.placeholder = viewMode === "research" ? "Find a source, work, or tradition…" : "Search the bounded corpus…";
  if (viewMode === "constellations") renderConstellations();
  else if (viewMode === "catalogue") renderCatalogue();
  else if (viewMode === "relations") renderRelations();
  else renderResearch();
  updateLegend();
  renderDetail();
  renderFocusBanner();
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

function showSearchResults(query: string): void {
  searchResults.replaceChildren();
  lastSearchQuery = query;
  if (!query) {
    searchResults.hidden = true;
    return;
  }
  const matches = discoveryMatches(query).slice(0, 12);
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
      searchInput.value = record.label;
      searchResults.hidden = true;
      selectedDiscoveryId = record.id;
      selectedNodeId = record.conceptId ?? record.relatedConceptIds[0] ?? null;
      selectionOrigin = selectedNodeId ? "search" : null;
      viewMode = record.kind === "source" && !selectedNodeId ? "research" : "constellations";
      selectedDomain = "";
      selectedFamily = "";
      selectedSource = "";
      selectedEvidence = "";
      domainFilter.value = "";
      familyFilter.value = "";
      sourceFilter.value = "";
      evidenceFilter.value = "";
      lineMode = "all";
      lineModeSelect.value = "all";
      render();
      if (selectedNodeId && viewMode === "constellations") requestAnimationFrame(() => zoomToSelection(selectedNodeId as string));
    });
    searchResults.append(button);
  }
  searchResults.hidden = false;
}

function fitView(): void {
  if (!currentZoom) return;
  d3.select(svgElement).transition().duration(motionDuration(450)).call(currentZoom.transform, d3.zoomIdentity);
}

function bindEvents(): void {
  document.querySelectorAll<HTMLButtonElement>(".view-button").forEach((button) => {
    button.addEventListener("click", () => {
      viewMode = button.dataset.view as ViewMode;
      searchInput.value = "";
      researchQuery = "";
      searchResults.hidden = true;
      render();
    });
  });
  domainFilter.addEventListener("change", () => {
    selectedDomain = domainFilter.value as "" | DomainId;
    if (selectedFamily && nodeById.get(selectedFamily)?.domainId !== selectedDomain && selectedDomain) {
      selectedFamily = "";
      familyFilter.value = "";
    }
    render();
  });
  detailLevelSelect.addEventListener("change", () => {
    detailLevel = detailLevelSelect.value as DetailLevel;
    if (viewMode === "constellations") updateSemanticZoom(currentTransform);
  });
  lineModeSelect.addEventListener("change", () => {
    lineMode = lineModeSelect.value as LineMode;
    if (viewMode === "constellations") {
      updateSemanticZoom(currentTransform);
      updateConstellationSelection();
    }
  });
  familyFilter.addEventListener("change", () => {
    selectedFamily = familyFilter.value;
    const family = selectedFamily ? nodeById.get(selectedFamily) : undefined;
    if (family) {
      selectedDomain = family.domainId;
      domainFilter.value = family.domainId;
    }
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
    if (viewMode === "research") {
      researchQuery = query.toLocaleLowerCase();
      renderResearch();
    } else {
      showSearchResults(query);
    }
  });
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchInput.value = "";
      searchResults.hidden = true;
      researchQuery = "";
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
    if (event.key === "Escape" && document.activeElement !== searchInput) closeDetail();
  });
  byId<HTMLButtonElement>("reset-view").addEventListener("click", () => {
    selectedNodeId = null;
    selectedDiscoveryId = null;
    selectionOrigin = null;
    selectedDomain = "";
    selectedFamily = "";
    selectedSource = "";
    selectedEvidence = "";
    detailLevel = "auto";
    lineMode = "taxonomy";
    domainFilter.value = "";
    familyFilter.value = "";
    sourceFilter.value = "";
    evidenceFilter.value = "";
    detailLevelSelect.value = "auto";
    lineModeSelect.value = "taxonomy";
    searchInput.value = "";
    render();
  });
  byId<HTMLButtonElement>("zoom-in").addEventListener("click", () => {
    if (currentZoom) d3.select(svgElement).transition().duration(motionDuration(250)).call(currentZoom.scaleBy, 1.5);
  });
  byId<HTMLButtonElement>("zoom-out").addEventListener("click", () => {
    if (currentZoom) d3.select(svgElement).transition().duration(motionDuration(250)).call(currentZoom.scaleBy, 1 / 1.5);
  });
  byId<HTMLButtonElement>("fit-view").addEventListener("click", fitView);
  byId<HTMLButtonElement>("focus-relations").addEventListener("click", () => {
    if (!selectedNodeId) return;
    viewMode = "relations";
    render();
  });
  byId<HTMLButtonElement>("focus-clear").addEventListener("click", () => {
    selectNode(null, false);
    fitView();
  });
  document.querySelector<HTMLAnchorElement>(".brand")?.addEventListener("click", (event) => {
    event.preventDefault();
    viewMode = "constellations";
    selectedNodeId = null;
    selectedDiscoveryId = null;
    selectionOrigin = null;
    render();
  });
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (viewMode === "constellations" || viewMode === "relations") render();
    }, 150);
  });
}

async function loadData(): Promise<void> {
  try {
    const [conceptResponse, researchResponse, discoveryResponse] = await Promise.all([
      fetch(assetUrl("data/constellations.json")),
      fetch(assetUrl("data/characters.json")),
      fetch(assetUrl("data/discovery.json")),
    ]);
    if (!conceptResponse.ok || !researchResponse.ok || !discoveryResponse.ok) throw new Error("Unable to load compiled atlas data");
    concepts = (await conceptResponse.json()) as ConstellationPayload;
    research = (await researchResponse.json()) as ResearchPayload;
    discovery = (await discoveryResponse.json()) as DiscoveryPayload;
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
  } catch (error) {
    loading.replaceChildren(element("p", "", error instanceof Error ? error.message : "Unable to load the atlas."));
  }
}

void loadData();
