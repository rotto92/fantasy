import { readdir, readFile } from "node:fs/promises";
import { launchBrowser } from "./browser.mjs";

const discovery = JSON.parse(await readFile(new URL("../public/data/discovery.json", import.meta.url), "utf8"));
const concepts = JSON.parse(await readFile(new URL("../public/data/constellations.json", import.meta.url), "utf8"));
const research = JSON.parse(await readFile(new URL("../public/data/characters.json", import.meta.url), "utf8"));
const reviewDirectory = new URL("../research/independent_reviews/", import.meta.url);
const reviewLedgers = await Promise.all(
  (await readdir(reviewDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.startsWith("review_") && entry.name.endsWith(".json"))
    .map(async (entry) => JSON.parse(await readFile(new URL(entry.name, reviewDirectory), "utf8"))),
);
const appUrl = process.env.FANTASY_TEST_URL ?? "http://127.0.0.1:5173/";
const failures = [];
const foldContractValue = (value) => [...String(value)
  .normalize("NFKD")
  .replace(/\p{Mark}/gu, "")
  .toLocaleLowerCase()]
  .map((character) => discovery.meta.foldingMap?.[character] ?? character)
  .join("")
  .replace(/[^\p{Letter}\p{Number}]/gu, "");

if (discovery.meta.scope?.kind !== "bounded-accepted-research-corpus") {
  failures.push("discovery index does not declare the accepted bounded corpus scope");
}
if (discovery.meta.foldingMap?.["ß"] !== "ss") {
  failures.push("discovery index does not publish the compiler-compatible Unicode folding map");
}
if (JSON.stringify(discovery.meta.dimensionLabels) !== JSON.stringify(research.dimensionLabels)) {
  failures.push("generated discovery and research payloads disagree on the dimension schema");
}
if (discovery.records.some((record) => Object.hasOwn(record, "searchText"))) {
  failures.push("discovery index still carries the unused searchText payload");
}
const missingAuditSourceTitles = research.sources.filter((audit) => {
  const sourceRecord = discovery.records.find((record) => record.id === `source:${audit.source_id}`);
  const foldedAuditTitle = foldContractValue(audit.source_title);
  return !sourceRecord?.searchFields.some(([label, foldedValue]) =>
    label === "source / series" && foldedValue === foldedAuditTitle);
});
if (missingAuditSourceTitles.length) {
  failures.push(`validated audit source titles are not discoverable for ${missingAuditSourceTitles.map((audit) => audit.source_id).join(", ")}`);
}
const ankkaRecord = discovery.records.find((record) => record.id === "character:CHR-SRC162-001");
const sanskritAsuraRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC277-004");
const acceptedMappedCharacterRecord = discovery.records.find((record) => record.kind === "character" && record.relatedConceptIds.length);
const acceptedMappedCharacter = research.characters.find((character) => character.character_id === acceptedMappedCharacterRecord?.characterIds[0]);
const mappedConcept = concepts.nodes.find((node) => node.examples?.length);
const xeniaRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC001-007");
const aetherbladesRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC162-002");
const chanjiaoTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC017-006");
const chanjiaoRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC017-006");
const jinnTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC009-001");
const jinnRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC009-001");
const remadeTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC050-003");
const remadeRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC050-003");
const crisisTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC050-005");
const crisisRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC050-005");
const goldenSunTerms = research.sourceTerms.filter((term) => /^STM-SRC172-00[3-6]$/.test(term.term_id));
const firstLawCompoundTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC051-004");
const firstLawCompoundRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC051-004");
const lodossCompoundTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC075-002");
const lodossCompoundRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC075-002");
const dndCompoundTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC272-003");
const dndCompoundRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC272-003");
const theosTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC001-001");
const theosRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC001-001");
const quarantinedDimensionRecord = discovery.records.find((record) => record.kind === "dimension-term" && record.sourceId === "SRC-050" && record.label === "weaving and reality-altering action");
const chineseTerms = research.sourceTerms.filter((term) => term.source_id === "SRC-279");
const jotunnRecord = discovery.records.find((record) => record.kind === "dimension-term" && record.sourceId === "SRC-002" && record.label === "jötunn");
const dvergrTerm = research.sourceTerms.find((term) => term.canonical_term === "dvergr" && term.source_id === "SRC-002");
const dvergrRecord = discovery.records.find((record) => record.id === `source-term:${dvergrTerm?.term_id}`);
const dvergrSourceRecord = discovery.records.find((record) => record.id === `source:${dvergrTerm?.source_id}`);
const dvergrExample = concepts.nodes.flatMap((node) => node.examples ?? []).find((example) => example.id === dvergrTerm?.term_id);
const mortalFamily = concepts.nodes.find((node) => node.label === "Mortal and Natural Peoples");
const egyptianTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC013-001");
const boundaryRecord = research.researchBoundaries?.find((record) => record.term_id === "STM-SRC033-001");
const semanticRoleTermIds = ["STM-SRC192-003", "STM-SRC218-002"];
const source277Record = discovery.records.find((record) => record.id === "source:SRC-277");
if (!ankkaRecord || ankkaRecord.relatedConceptIds.length) failures.push("Ankka is no longer preserved as source-native evidence");
if (!sanskritAsuraRecord || sanskritAsuraRecord.relatedConceptIds.length) failures.push("SRC-277 asura was promoted into the graph");
if (!mappedConcept) failures.push("no mapped concept remains available for the failing-path comparison");
if (xeniaRecord?.normalizedConceptIds.length || !xeniaRecord?.mappingQuarantined || xeniaRecord.relatedConceptIds.length) {
  failures.push("unreviewed xenia mappings were not withheld from graph-selectable links");
}
if (!research.sourceTerms.every((term) => typeof term.work_or_witness === "string" && /\p{Letter}/u.test(term.work_or_witness))) {
  failures.push("source-term schema omitted identity-bearing claim work provenance");
}
if (!research.sourceTerms.every((term) => typeof term.witness_identity === "string" && /\p{Letter}/u.test(term.witness_identity))) {
  failures.push("source-term schema omitted a witness identity separate from its locator");
}
if (!research.sourceTerms.every((term) => term.citations.every((citation) => term.work_or_witness.includes(citation.locator)))) {
  failures.push("source-term work provenance does not pair every citation with its locator");
}
const goldenSunWitness = "Nintendo of America, New update! A pair of golden games have been added for Nintendo Switch Online + Expansion Pack members, 16 January 2024";
if (goldenSunTerms.length !== 4 || goldenSunTerms.some((term) => term.witness_identity !== goldenSunWitness || !term.work_or_witness.includes(goldenSunWitness))) {
  failures.push("Golden Sun source terms do not identify the Nintendo page separately from the section locator");
}
const irishTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC003-001");
const irishWitness = "Cath Maige Tuired: The Second Battle of Mag Tuired";
if (irishTerm?.witness_identity !== irishWitness || !irishTerm.work_or_witness.includes(irishWitness)) {
  failures.push("Irish source terms do not resolve the cited declared witness separately from section locators");
}
const wizardryTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC154-002");
const wizardryWitness = "Drecom: Official release version of Wizardry: Proving Grounds of the Mad Overlord available on consoles & PC";
if (wizardryTerm?.witness_identity !== wizardryWitness || !wizardryTerm.work_or_witness.includes(wizardryWitness)) {
  failures.push("Wizardry source terms do not resolve the cited declared witness separately from section locators");
}
const reviewLaneNames = ["scoped", "characterPass", "terminologyPass", "relationshipPass", "secondReview", "continuityReview"];
if (research.sources.some((audit) => reviewLaneNames.some((lane) => !audit.review_lanes?.[lane]?.status || !audit.review_lanes[lane].detail))) {
  failures.push("compiled research omits an authoritative review-lane status");
}
const characterPassPresentation = new Map([
  ["pass-complete", { label: "Pass complete", className: "complete" }],
  ["narrow-metadata-pass-complete", { label: "Limited metadata pass", className: "limited" }],
  ["evidence-insufficient-zero-character-audit", { label: "Evidence insufficient", className: "evidence-insufficient" }],
]);
for (const audit of research.sources) {
  const expected = characterPassPresentation.get(audit.completion_status);
  if (!expected
    || audit.review_lanes.characterPass.status !== audit.completion_status
    || audit.review_lanes.characterPass.label !== expected.label) {
    failures.push(`character-pass status is not derived from ${audit.source_id} completion: ${JSON.stringify(audit.review_lanes.characterPass)}`);
  }
}
const jinnAudit = research.sources.find((audit) => audit.source_id === "SRC-010");
if (jinnAudit?.review_lanes.secondReview.status !== "not-started" || jinnAudit.review_lanes.continuityReview.status !== "not-started") {
  failures.push("SRC-010 corpus-wide and completion-status audits were conflated with focused claim review");
}
if (research.sources.some((audit) => audit.review_lanes.terminologyPass.status === "pass-complete" || audit.review_lanes.relationshipPass.status === "pass-complete")) {
  failures.push("record counts were promoted into undeclared terminology or relationship pass completion");
}
const sourceTermCounts = new Map();
for (const term of research.sourceTerms) sourceTermCounts.set(term.source_id, (sourceTermCounts.get(term.source_id) ?? 0) + 1);
const falseEmptyTerminologyLanes = research.sources.filter((audit) =>
  !sourceTermCounts.has(audit.source_id)
  && (audit.review_lanes.terminologyPass.status !== "not-started"
    || audit.review_lanes.terminologyPass.label !== "Not started"
    || !audit.review_lanes.terminologyPass.detail.includes("No accepted source-term evidence")),
);
if (falseEmptyTerminologyLanes.length) {
  failures.push(`zero-evidence terminology lanes claim progress: ${falseEmptyTerminologyLanes.map((audit) => audit.source_id).join(", ")}`);
}
const focusedReviewedSources = research.sources.filter((audit) => audit.review_lanes.secondReview.status !== "not-started").length;
if (research.meta.reviewCoverage.focusedReviewedSources !== focusedReviewedSources) {
  failures.push("public focused-review source count is not derived from reviewed claim IDs");
}
const fullyReviewedSources = research.sources.filter((audit) => audit.review_lanes.secondReview.status === "reviewed").length;
if (research.meta.reviewCoverage.pendingFullSecondReviewSources !== research.sources.length - fullyReviewedSources) {
  failures.push("public pending full-review count treats partial claim samples as completed source reviews");
}
const shahnamehDiv = research.sourceTerms.find((term) => term.term_id === "STM-SRC011-003");
if (!shahnamehDiv?.work_or_witness.includes("Ferdowsi, Shāhnāmeh") || !shahnamehDiv.work_or_witness.includes("Encyclopaedia Iranica, DĪV") || shahnamehDiv.work_or_witness.includes("Vols. I–VI cited in this pass")) {
  failures.push("Shāhnāmeh dīv provenance does not identify each claim-specific witness");
}
if (!egyptianTerm?.witness_identity.includes("Papyrus of Ani") || !egyptianTerm.work_or_witness.includes("Papyrus of Ani")) {
  failures.push("Egyptian source-term provenance did not resolve the declared Papyrus of Ani witness");
}
if (!boundaryRecord || boundaryRecord.record_kind !== "research-boundary" || research.sourceTerms.some((term) => term.term_id === boundaryRecord.term_id) || discovery.records.some((record) => record.id === `source-term:${boundaryRecord.term_id}`)) {
  failures.push("research coverage boundaries leaked into semantic source-term discovery");
}
if (!research.sourceTerms.every((term) => term.record_kind === "source-term") || !research.researchBoundaries?.every((record) => record.record_kind === "research-boundary")) {
  failures.push("compiled source-term records do not preserve their validated record kind");
}
for (const termId of semanticRoleTermIds) {
  if (!research.sourceTerms.some((term) => term.term_id === termId && term.record_kind === "source-term")
    || !discovery.records.some((record) => record.id === `source-term:${termId}` && record.dimension === "roles_and_vocations")) {
    failures.push(`semantic role evidence ${termId} was misclassified as a research boundary`);
  }
}
if (research.sourceTerms.some((term) => term.term_id === "STM-SRC002-013") || discovery.records.some((record) => record.id === "source-term:STM-SRC002-013") || !research.meta.reviewCoverage.quarantinedRecordIds.includes("STM-SRC002-013")) {
  failures.push("unsupported draugr evidence was not quarantined from public discovery");
}
if (!xeniaRecord?.work.includes("Homer, Odyssey") || !xeniaRecord.work.includes("9.105–566")) {
  failures.push("xenia discovery provenance does not identify its Odyssey witness");
}
for (const name of ["Ankka", "Ivan", "Mai Trin", "Scarlet"]) {
  if (!aetherbladesRecord?.characterExamples.includes(name)) failures.push(`Aetherblades source-term evidence omitted ${name}`);
}
const chanjiaoCharacters = research.characters.filter((character) =>
  character.source_id === chanjiaoTerm?.source_id
  && (character.dimensions?.[chanjiaoTerm?.dimension] ?? []).some((value) => value.term === chanjiaoTerm?.transliteration),
);
for (const character of chanjiaoCharacters) {
  if (!chanjiaoRecord?.characterExamples.includes(character.canonical_name)) failures.push(`Chanjiao source-term evidence omitted ${character.canonical_name}`);
}
if (!jinnTerm?.identity_forms?.includes("Jinn") || !jinnTerm.identity_forms.includes("Jinni") || !jinnRecord?.characterExamples.includes("The Jinni") || !jinnRecord.characterExamples.includes("The Jinni of the Ring")) {
  failures.push("explicit Jinn/Jinni identities did not link representative character evidence");
}
if (!remadeTerm?.identity_forms?.includes("Remade") || !remadeTerm.identity_forms.includes("remaking") || !remadeRecord?.characterExamples.includes("Mr. Motley")) {
  failures.push("explicit Remade/remaking identities did not link representative character evidence");
}
if (!crisisTerm?.identity_forms?.includes("crisis energy") || !crisisTerm.identity_forms.includes("crisis conductor") || !crisisRecord?.characterExamples.includes("Isaac Dan der Grimnebulin")) {
  failures.push("explicit crisis-energy identities did not link representative character evidence");
}
if (!firstLawCompoundTerm?.identity_forms?.includes("the Inquisition") || !firstLawCompoundRecord?.characterExamples.includes("Sand dan Glokta")) {
  failures.push("semicolon-delimited source-term identity did not link representative character evidence");
}
if (!lodossCompoundTerm?.identity_forms?.includes("elf") || !lodossCompoundRecord?.characterExamples.includes("ディードリット")) {
  failures.push("transliteration identity did not link representative character evidence");
}
for (const [identity, character] of [["bard", "Edgin"], ["barbarian", "Holga"], ["paladin", "Xenk"], ["sorcerer", "Simon"], ["druid", "Doric"]]) {
  if (!dndCompoundTerm?.identity_forms?.includes(identity) || !dndCompoundRecord?.characterExamples.includes(character)) {
    failures.push(`comma/and-delimited identity ${identity} omitted ${character}`);
  }
}
for (const term of chineseTerms) {
  const locators = term.citations.map((citation) => citation.locator);
  if (!locators.some((locator) => term.work_or_witness.includes(locator)) || term.work_or_witness.startsWith("Shanhai jing; Huainanzi;")) {
    failures.push(`${term.term_id} does not preserve claim-specific Chinese witness provenance`);
  }
}
const reviewCoverage = research.meta.reviewCoverage;
if (!reviewCoverage || reviewCoverage.claimCoverage < reviewCoverage.minimumClaimCoverage || reviewCoverage.minimumClaimCoverage !== 0.2) {
  failures.push("compiled research does not enforce the 20% independent-review claim gate");
}
const promotedClaimIds = new Set([
  ...research.characters.flatMap((character) => [
    `character:${character.character_id}`,
    ...Object.entries(character.dimensions).filter(([, values]) => values.length).map(([dimension]) => `dimension:${character.character_id}:${dimension}`),
  ]),
  ...research.relationships.map((relationship) => `relationship:${relationship.relationship_id}`),
  ...research.sourceTerms.map((term) => `source-term:${term.term_id}`),
]);
const reviewedClaimIds = new Set([
  ...reviewLedgers.flatMap((ledger) => {
    const entries = Array.isArray(ledger) ? ledger : [ledger];
    return entries.flatMap((entry) => entry.reviewed_claim_ids ?? []);
  }),
]);
const reviewedPromotedClaims = [...reviewedClaimIds].filter((claimId) => promotedClaimIds.has(claimId));
if (reviewCoverage?.reviewedClaims !== reviewedPromotedClaims.length || reviewCoverage?.totalClaims !== promotedClaimIds.size) {
  failures.push("compiled review coverage is not the exact reviewed-claim intersection");
}
const relationshipLedger = reviewLedgers.find((ledger) => !Array.isArray(ledger) && ledger.scanned_count === 1258);
if (!relationshipLedger || relationshipLedger.reviewed_claim_ids.length !== relationshipLedger.inspected_count || relationshipLedger.reviewed_claim_ids.length >= relationshipLedger.scanned_count) {
  failures.push("relationship structural scans still inflate substantive claim-review coverage");
}
for (const recordId of reviewCoverage?.quarantinedRecordIds ?? []) {
  if (research.characters.some((record) => record.character_id === recordId)
    || research.relationships.some((record) => record.relationship_id === recordId)
    || research.sourceTerms.some((record) => record.term_id === recordId)) {
    failures.push(`independent-review quarantine promoted unresolved record ${recordId}`);
  }
}
for (const claimId of reviewCoverage?.quarantinedMappingClaimIds ?? []) {
  const [claimKind, recordId, dimension] = claimId.split(":");
  const character = claimKind === "dimension" ? research.characters.find((record) => record.character_id === recordId) : undefined;
  const term = claimKind === "source-term" ? research.sourceTerms.find((record) => record.term_id === recordId) : undefined;
  const retainedMappings = character
    ? (character.dimensions[dimension] ?? []).flatMap((value) => value.archetype_ids)
    : term?.archetype_ids ?? [];
  if ((!character && !term) || retainedMappings.length) failures.push(`mapping quarantine did not retain and unmap ${claimId}`);
}
if (!jotunnRecord?.continuity.includes("Poetic Edda witness") || !jotunnRecord.continuity.includes("Prose Edda witness") || !jotunnRecord.work.includes("Vafþrúðnismál") || !jotunnRecord.work.includes("Gylfaginning")) {
  failures.push("grouped jötunn evidence collapsed its continuity or work provenance");
}
const dvergrWork = dvergrTerm?.work_or_witness ?? "";
if (!dvergrRecord || dvergrRecord.work !== dvergrWork || dvergrRecord.work.includes("Gylfaginning") || !dvergrSourceRecord?.work.includes("Gylfaginning")) {
  failures.push("dvergr discovery provenance overclaims the source-wide witness list");
}
if (dvergrExample || !(reviewCoverage?.quarantinedMappingClaimIds ?? []).includes(`source-term:${dvergrTerm?.term_id}`)) {
  failures.push("unreviewed dvergr mapping still contributes concept evidence");
}
if (!mortalFamily?.evidenceCount || !mortalFamily.sourceCount || !mortalFamily.examples.some((example) => example.kind === "character-example")) {
  failures.push("tier-2 Mortal and Natural Peoples omitted descendant evidence");
}
if (!theosTerm || theosTerm.archetype_ids.length || theosRecord?.normalizedConceptIds.length || !theosRecord?.mappingQuarantined || !(reviewCoverage?.quarantinedMappingClaimIds ?? []).includes("source-term:STM-SRC001-001")) {
  failures.push("unreviewed culturally cautioned theos mapping was promoted");
}
const jadeEmperor = research.characters.find((character) => character.character_id === "CHR-SRC279-014");
if ((jadeEmperor?.dimensions.being_types ?? []).some((value) => value.archetype_ids.length)
  || !(reviewCoverage?.quarantinedMappingClaimIds ?? []).includes("dimension:CHR-SRC279-014:being_types")) {
  failures.push("generic character review still bypasses culturally sensitive dimension review");
}
if (!quarantinedDimensionRecord?.mappingQuarantined || quarantinedDimensionRecord.normalizedConceptIds.length) {
  failures.push("grouped dimension evidence conceals its withheld mapping status");
}
const allConceptExamples = concepts.nodes.flatMap((node) => node.examples ?? []);
const allAffinityEvidence = concepts.edges.filter((edge) => edge.kind === "affinity").flatMap((edge) => edge.evidence ?? []);
if (allConceptExamples.some((example) => example.kind === "source-entry") || allAffinityEvidence.some((evidence) => evidence.kind === "source entry" || evidence.id === "ENT-0014")) {
  failures.push("legacy seeded atlas rows still contribute public examples or affinities");
}
if (allConceptExamples.some((example) => example.id === "STM-SRC001-001")) {
  failures.push("unreviewed culturally sensitive source-term mapping still contributes concept evidence");
}
if (!concepts.edges.some((edge) => edge.kind === "affinity" && (edge.source === mortalFamily?.id || edge.target === mortalFamily?.id) && edge.evidence?.length)) {
  failures.push("tier-2 family evidence did not produce evidence-backed related concepts");
}
if (discovery.meta.coverage?.being_types?.excludedRows !== 0 || discovery.meta.coverage?.roles_and_vocations?.excludedRows !== 0) {
  failures.push("being and role coverage reports unexplained exclusions");
}
if (discovery.meta.coverage?.being_types?.missingRows?.length || discovery.meta.coverage?.roles_and_vocations?.missingRows?.length) {
  failures.push("being or role coverage has undiscoverable rows");
}
for (const dimension of ["being_types", "roles_and_vocations"]) {
  const coverage = discovery.meta.coverage?.[dimension];
  if (!coverage || coverage.acceptedRows !== coverage.discoverableRows + coverage.excludedRows || coverage.missingRows.length !== coverage.excludedRows) {
    failures.push(`${dimension} coverage arithmetic is inconsistent`);
  }
  const characterRows = research.characters.reduce((count, character) => count + (character.dimensions?.[dimension] ?? []).filter((value) => value.term?.trim()).length, 0);
  const sourceRows = research.sourceTerms.filter((term) => term.dimension === dimension && term.canonical_term?.trim()).length;
  if (discovery.meta.coverage?.[dimension]?.acceptedRows !== characterRows + sourceRows) {
    failures.push(`${dimension} coverage count does not match accepted research rows`);
  }
}
for (const [sourceId, connections] of Object.entries(discovery.meta.sourceConnections ?? {})) {
  for (const connection of connections) {
    if (connection.sourceId === sourceId || !connection.sharedConceptIds.length) failures.push(`invalid source connection for ${sourceId}`);
  }
}

const browser = await launchBrowser({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const stagedPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
let releaseDiscovery;
const discoveryGate = new Promise((resolve) => { releaseDiscovery = resolve; });
await stagedPage.route("**/data/discovery.json", async (route) => {
  await discoveryGate;
  await route.continue();
});
await stagedPage.goto(appUrl, { waitUntil: "domcontentloaded" });
await stagedPage.locator("#loading").waitFor({ state: "detached" });
if (!(await stagedPage.locator("#status-summary").textContent())?.includes("class/race/entity stars") || !(await stagedPage.locator("#search").isDisabled())) {
  failures.push("initial atlas render still waits on discovery parsing or enables incomplete search");
}
releaseDiscovery();
await stagedPage.waitForFunction(() => !document.querySelector("#search")?.disabled);
await stagedPage.close();

const initialRecoveryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
let initialDataAttempts = 0;
await initialRecoveryPage.route("**/data/constellations.json", async (route) => {
  initialDataAttempts += 1;
  if (initialDataAttempts === 1) await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  else await route.continue();
});
await initialRecoveryPage.goto(appUrl, { waitUntil: "domcontentloaded" });
const initialRetry = initialRecoveryPage.locator("#loading button", { hasText: "Retry atlas data" });
await initialRetry.waitFor();
await initialRecoveryPage.waitForFunction(() => document.activeElement?.textContent === "Retry atlas data");
if (await initialRecoveryPage.locator("#search").getAttribute("aria-busy") !== null
  || !(await initialRetry.evaluate((node) => node === document.activeElement))) {
  failures.push("initial data failure did not expose a focused, settled retry control");
}
await initialRetry.click();
await initialRecoveryPage.waitForFunction(() => !document.querySelector("#search")?.disabled);
await initialRecoveryPage.locator("#loading").waitFor({ state: "detached" });
if (initialDataAttempts !== 2) failures.push(`initial data retry made ${initialDataAttempts} constellation requests`);
await initialRecoveryPage.close();

const discoveryRecoveryPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
let discoveryAttempts = 0;
await discoveryRecoveryPage.route("**/data/discovery.json", async (route) => {
  discoveryAttempts += 1;
  if (discoveryAttempts === 1) await route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
  else await route.continue();
});
await discoveryRecoveryPage.goto(appUrl, { waitUntil: "domcontentloaded" });
const discoveryRetry = discoveryRecoveryPage.locator("#discovery-notice button", { hasText: "Retry discovery" });
await discoveryRetry.waitFor();
await discoveryRecoveryPage.waitForFunction(() => document.activeElement?.textContent === "Retry discovery");
if (!(await discoveryRecoveryPage.locator("#status-summary").textContent())?.includes("class/race/entity stars")
  || await discoveryRecoveryPage.locator("#search").getAttribute("aria-busy") !== null
  || !(await discoveryRetry.evaluate((node) => node === document.activeElement))
  || await discoveryRecoveryPage.locator("#loading").count() !== 0
  || !(await discoveryRecoveryPage.locator("#atlas-svg").isVisible())) {
  failures.push("discovery failure did not preserve the usable atlas with a focused, settled retry control");
}
await discoveryRecoveryPage.locator('.view-button[data-view="research"]').click();
if (!(await discoveryRecoveryPage.locator("#coverage-board").isVisible())) {
  failures.push("discovery recovery notice blocked an already loaded atlas view");
}
await discoveryRetry.click();
await discoveryRecoveryPage.waitForFunction(() => !document.querySelector("#search")?.disabled);
if (await discoveryRecoveryPage.locator("#discovery-notice").isVisible()) {
  failures.push("successful discovery retry left the recovery notice visible");
}
if (discoveryAttempts !== 2) failures.push(`discovery retry made ${discoveryAttempts} discovery requests`);
await discoveryRecoveryPage.close();

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(appUrl, { waitUntil: "networkidle" });
await page.locator("#loading").waitFor({ state: "detached" });
await page.waitForFunction(() => !document.querySelector("#search")?.disabled);
if (await page.locator("#atlas-svg .taxonomy-line, #atlas-svg .affinity-line").count()) {
  failures.push("global constellation edges are still rendered outside the local relation view");
}

await page.locator("#detail-level").selectOption("all");
await page.locator("#zoom-in").click();
await page.waitForTimeout(350);
const visibleConceptLabels = await page.locator("#atlas-svg .concept-label:visible").count();
if (visibleConceptLabels > 24) failures.push(`wide constellation label budget exceeded: ${visibleConceptLabels}`);
const visibleFamilyLabels = await page.locator("#atlas-svg .family-label:visible").count();
if (visibleFamilyLabels > 12) failures.push(`wide constellation family-label budget exceeded: ${visibleFamilyLabels}`);
await page.locator("#fit-view").click();
await page.waitForTimeout(350);
const rovingSpecific = page.locator("#atlas-svg .specific-star:visible").first();
if (!(await rovingSpecific.count())) {
  failures.push("all-detail constellation has no roving specific star fixture");
} else {
  await rovingSpecific.focus();
  await page.locator("#detail-level").selectOption("families");
  await page.locator("#detail-level").selectOption("all");
  const rovingTabs = page.locator('#atlas-svg .concept-star[tabindex="0"]');
  if ((await rovingTabs.count()) !== 1 || !(await rovingTabs.first().isVisible())) {
    failures.push("detail-level changes left a hidden duplicate map tab stop");
  }
}

const familyOnlyFixture = concepts.nodes.find((node) => node.tier === 2 && node.childIds?.length);
const familyOnlyLeaf = concepts.nodes.find((node) => node.tier === 3 && node.familyId === familyOnlyFixture?.id);
if (!familyOnlyFixture || !familyOnlyLeaf) {
  failures.push("compiled concepts have no Families-only selection fixture");
} else {
  await page.locator("#detail-level").selectOption("all");
  await page.locator("#search").fill(familyOnlyFixture.label);
  await page.locator(`.search-result[data-discovery-id="concept:${familyOnlyFixture.id}"]`).click();
  await page.locator("#detail-level").selectOption("families");
  const selectedFamilyState = {
    specifics: await page.locator("#atlas-svg .specific-star:visible").count(),
    specificTabs: await page.locator('#atlas-svg .specific-star[tabindex="0"]').count(),
    visibleTabs: await page.locator('#atlas-svg .concept-star[tabindex="0"]:visible').count(),
  };
  await page.locator(`#atlas-svg .family-star[data-node-id="${familyOnlyFixture.id}"]`).focus();
  await page.keyboard.press("ArrowRight");
  selectedFamilyState.keyboardTarget = await page.evaluate(() => document.activeElement?.classList.contains("family-star"));
  if (selectedFamilyState.specifics !== 0
    || selectedFamilyState.specificTabs !== 0
    || selectedFamilyState.visibleTabs !== 1
    || !selectedFamilyState.keyboardTarget) {
    failures.push(`Families only exposed specifics after family selection: ${JSON.stringify(selectedFamilyState)}`);
  }

  await page.locator("#detail-level").selectOption("all");
  const keyboardLeaf = page.locator(`#atlas-svg .specific-star[data-node-id="${familyOnlyLeaf.id}"]`);
  await keyboardLeaf.focus();
  await keyboardLeaf.press("Enter");
  await page.locator("#detail-level").selectOption("families");
  const directLeafState = {
    specificIds: await page.locator("#atlas-svg .specific-star:visible").evaluateAll((marks) =>
      marks.map((mark) => mark.getAttribute("data-node-id")),
    ),
    specificTabs: await page.locator('#atlas-svg .specific-star[tabindex="0"]').count(),
    visibleTabs: await page.locator('#atlas-svg .concept-star[tabindex="0"]:visible').count(),
  };
  if (directLeafState.specificIds.length !== 0
    || directLeafState.specificTabs !== 0
    || directLeafState.visibleTabs !== 1) {
    failures.push(`Families only retained a keyboard-origin specific: ${JSON.stringify(directLeafState)}`);
  }

  await page.locator("#search").fill(familyOnlyLeaf.label);
  await page.locator(`.search-result[data-discovery-id="concept:${familyOnlyLeaf.id}"]`).click();
  const selectedLeafState = {
    specificIds: await page.locator("#atlas-svg .specific-star:visible").evaluateAll((marks) =>
      marks.map((mark) => mark.getAttribute("data-node-id")),
    ),
    specificTabIds: await page.locator('#atlas-svg .specific-star[tabindex="0"]').evaluateAll((marks) =>
      marks.map((mark) => mark.getAttribute("data-node-id")),
    ),
  };
  if (JSON.stringify(selectedLeafState.specificIds) !== JSON.stringify([familyOnlyLeaf.id])
    || JSON.stringify(selectedLeafState.specificTabIds) !== JSON.stringify([familyOnlyLeaf.id])) {
    failures.push(`Families only exposed unrelated specifics after leaf selection: ${JSON.stringify(selectedLeafState)}`);
  }
  await page.locator("#reset-view").click();
}

if (mappedConcept) {
  await page.locator("#search").fill(mappedConcept.label);
  await page.locator(".search-result").first().waitFor();
  await page.locator(".search-result").filter({ hasText: mappedConcept.label }).first().click();
  await page.waitForFunction(() => document.activeElement?.tagName === "H2");
  const mappedText = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
  if (!mappedText.includes("concept-detail-header") && !await page.locator(".concept-detail-header").isVisible()) {
    failures.push(`mapped concept path did not open a concept detail: ${mappedText}`);
  }
  if (!mappedText.includes("source evidence and examples")) failures.push("mapped concept path omitted source evidence");
  const mappedExample = mappedConcept.examples?.[0];
  for (const value of [mappedExample?.work, mappedExample?.reviewStatus, mappedExample?.canonStatus, mappedExample?.caution]) {
    if (value && !mappedText.includes(value.toLocaleLowerCase())) failures.push(`mapped concept evidence omitted provenance: ${value}`);
  }
  for (const selector of [".citation-card strong", ".citation-card small", ".citation-card span", ".dimension-note", ".evidence-row", ".concept-stat-grid span", ".attribute-item small"]) {
    const element = page.locator(selector).first();
    if (!(await element.count())) {
      failures.push(`${selector} has no rendered contrast fixture`);
      continue;
    }
    const ratio = await element.evaluate((node) => {
      const values = getComputedStyle(node).color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
      const luminance = (channels) => channels
        .map((channel) => channel / 255)
        .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const foreground = luminance(values);
      const background = luminance([7, 12, 22]);
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    if (ratio < 4.5) failures.push(`${selector} contrast is ${ratio.toFixed(2)}:1`);
  }
  for (const selector of [".citation-card strong", ".concept-stat-grid span"]) {
    const fontSize = Number.parseFloat(await page.locator(selector).first().evaluate((node) => getComputedStyle(node).fontSize));
    if (fontSize < 11) failures.push(`${selector} remains microscopic at ${fontSize}px`);
  }
}

await page.locator("#search").fill("Achilles");
await page.locator('.search-result[data-discovery-id="character:CHR-SRC001-021"]').click();
if (!(await page.locator(".discovery-detail-header").isVisible())
  || !(await page.locator(".detail-panel").innerText()).includes("Achilles")) {
  failures.push("desktop stale-selection regression did not establish Achilles discovery detail");
}
await page.locator("#search").fill("human");
const downgradedQuery = {
  concept: await page.locator(".concept-detail-header h2").textContent().catch(() => null),
  discoveryHeaders: await page.locator(".discovery-detail-header").count(),
  focusVisible: await page.locator("#focus-banner").isVisible(),
};
if (downgradedQuery.concept !== "Human and Near-Human Peoples"
  || downgradedQuery.discoveryHeaders !== 0
  || !downgradedQuery.focusVisible) {
  failures.push(`matching typed query did not downgrade to truthful concept context: ${JSON.stringify(downgradedQuery)}`);
}
await page.locator("#search").fill("Achilles");
await page.locator('.search-result[data-discovery-id="character:CHR-SRC001-021"]').click();
await page.locator("#search").fill("asura");
await page.locator('.view-button[data-view="research"]').click();
const desktopDivergedQuery = {
  detailHeaders: await page.locator(".concept-detail-header, .discovery-detail-header").count(),
  detailText: await page.locator(".detail-panel").innerText(),
  focusVisible: await page.locator("#focus-banner").isVisible(),
  guildWarsRows: await page.locator(".research-table tbody tr").filter({ hasText: "Guild Wars" }).count(),
};
if (desktopDivergedQuery.detailHeaders !== 0
  || desktopDivergedQuery.detailText.includes("Achilles")
  || desktopDivergedQuery.focusVisible
  || desktopDivergedQuery.guildWarsRows !== 1) {
  failures.push(`desktop typed query retained stale Achilles state: ${JSON.stringify(desktopDivergedQuery)}`);
}
await page.locator("#reset-view").click();
await page.locator('.view-button[data-view="constellations"]').click();

await page.locator("#search").fill("Vali");
await page.locator('.search-result[data-discovery-id="character:CHR-SRC015-026"]').click();
await page.locator(".primary-button").filter({ hasText: "Open related concept" }).click();
await page.locator("#domain-filter").selectOption("beings");
const filteredValiQuery = await page.locator("#search").inputValue();
await page.locator('.view-button[data-view="research"]').click();
const filteredValiRows = await page.locator(".research-table tbody tr").count();
if (filteredValiQuery || filteredValiRows !== research.sources.length) {
  failures.push(`discarded Vāli filter scope broadened globally: ${JSON.stringify({ query: filteredValiQuery, rows: filteredValiRows })}`);
}
await page.locator("#reset-view").click();
await page.locator('.view-button[data-view="constellations"]').click();

await page.locator("#search").fill("Vali");
await page.locator('.search-result[data-discovery-id="character:CHR-SRC015-026"]').click();
await page.waitForFunction(() => document.activeElement?.matches(".detail-panel h2"));
await page.keyboard.press("Escape");
const escapedValiQuery = await page.locator("#search").inputValue();
await page.locator('.view-button[data-view="research"]').click();
const escapedValiRows = await page.locator(".research-table tbody tr").count();
if (escapedValiQuery || escapedValiRows !== research.sources.length) {
  failures.push(`desktop Escape discarded Vāli scope without clearing its query: ${JSON.stringify({ query: escapedValiQuery, rows: escapedValiRows })}`);
}
await page.locator("#reset-view").click();
await page.locator('.view-button[data-view="constellations"]').click();

await page.locator("#search").fill("asura");
const asuraText = await page.locator("#search-results").innerText();
if (!asuraText.includes("Ankka") || !asuraText.includes("Guild Wars")) {
  failures.push(`asura search omitted the Ankka/Guild Wars evidence: ${asuraText}`);
}
if (!(await page.locator("#search-results .search-result small").allTextContents()).some((text) => text.includes("Matched"))) {
  failures.push("search results do not explain why the query matched");
}
const searchContextContrast = await page.locator("#search-results .search-result span").first().evaluate((node) => {
  const values = getComputedStyle(node).color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  const luminance = (channels) => channels
    .map((channel) => channel / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const foreground = luminance(values);
  const background = luminance([8, 14, 25]);
  return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
});
if (searchContextContrast < 4.5) failures.push(`search-result context contrast is ${searchContextContrast.toFixed(2)}:1`);

await page.locator("#search").fill("GuildWars2");
if (!(await page.locator("#search-results").innerText()).includes("Ankka")) {
  failures.push("concatenated continuity search omitted the Ankka evidence");
}

await page.locator("#search").fill("SongOfIceAndFire");
if (!(await page.locator("#search-results").innerText()).includes("A Song of Ice and Fire")) {
  failures.push("five-token spacing-tolerant source-title search omitted A Song of Ice and Fire");
}

await page.locator("#search").fill("Guild Wars 2");
if (!(await page.locator("#search-results .search-result").filter({ hasText: "Ankka" }).count())) {
  failures.push("multi-word continuity search omitted the Ankka evidence record");
}

await page.locator("#search").fill("Fantasy_47v16");
if (!(await page.locator("#search-results").innerText()).includes("Elric of Melniboné")) {
  failures.push("underscore-separated work identifier search omitted the Elric witness");
}

await page.locator("#search").fill("ashura");
const ashuraText = await page.locator("#search-results").innerText();
if (!ashuraText.includes("Mahābhārata") || ashuraText.includes("Guild Wars") || ashuraText.includes("Paraśurāma") || ashuraText.includes("Rāmāyaṇa")) {
  failures.push(`ashura search conflated or omitted its justified Sanskrit result: ${ashuraText}`);
}
await page.locator(".search-result").filter({ hasText: "Mahābhārata" }).first().click();
const sourceTermDetail = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
if (!sourceTermDetail.includes("source language: sanskrit") || sourceTermDetail.includes("work / witness\nsanskrit")) {
  failures.push(`source-term detail mislabeled language as work: ${sourceTermDetail}`);
}
for (const view of ["catalogue", "relations", "constellations", "research"]) {
  await page.locator(`.view-button[data-view="${view}"]`).click();
  if ((await page.locator("#search").inputValue()) !== "ashura") {
    failures.push(`${view} view broadened the selected ashura alias to ${(await page.locator("#search").inputValue())}`);
  }
}
const scopedResearchRows = await page.locator(".research-table tbody tr").allTextContents();
if (scopedResearchRows.length !== 1
  || !scopedResearchRows[0].includes(sanskritAsuraRecord?.sourceTitle ?? "")
  || scopedResearchRows[0].includes("Guild Wars")) {
  failures.push(`selected ashura evidence broadened across view switches: ${scopedResearchRows.join(" | ")}`);
}
await page.locator('.view-button[data-view="constellations"]').click();

await page.locator("#search").fill("Kreiß");
const kreissText = await page.locator("#search-results").innerText();
if (!kreissText.includes("Kreiß")) failures.push(`compiler-compatible Unicode folding omitted Kreiß: ${kreissText}`);

const exactHumanEvidenceIds = discovery.records
  .filter((record) => ["being_types", "roles_and_vocations"].includes(record.dimension) && record.foldedLabel === "human")
  .map((record) => record.id);
if (exactHumanEvidenceIds.length <= 12) failures.push("human fixture no longer exercises search pagination");
await page.locator("#search").fill("human");
const firstMore = page.locator("#search-results .search-more");
await firstMore.focus();
await firstMore.press("Enter");
await page.waitForFunction(() => document.activeElement?.classList.contains("search-result"));
const firstExpandedIds = await page.locator("#search-results .search-result").evaluateAll((buttons) =>
  buttons.map((button) => button.getAttribute("data-discovery-id")),
);
const firstExpandedFocus = await page.evaluate(() => document.activeElement?.getAttribute("data-discovery-id"));
if (firstExpandedFocus !== firstExpandedIds[12]) failures.push("pagination did not focus the first newly revealed result");
await page.keyboard.press("Tab");
const secondExpandedFocus = await page.evaluate(() => document.activeElement?.getAttribute("data-discovery-id"));
if (secondExpandedFocus !== firstExpandedIds[13]) failures.push("pagination focus order skipped newly revealed results");
while (await page.locator("#search-results .search-more").count()) {
  await page.locator("#search-results .search-more").click();
}
const shownHumanIds = new Set(await page.locator("#search-results .search-result").evaluateAll((buttons) =>
  buttons.map((button) => button.getAttribute("data-discovery-id")),
));
for (const id of exactHumanEvidenceIds) {
  if (!shownHumanIds.has(id)) failures.push(`paginated human search omitted accepted evidence ${id}`);
}

await page.locator("#search").fill(acceptedMappedCharacterRecord?.label ?? "");
await page.locator(".search-result").filter({ hasText: acceptedMappedCharacterRecord?.label ?? "" }).first().click();
const sourceContextBeforeNavigation = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
if (!acceptedMappedCharacterRecord
  || !sourceContextBeforeNavigation.includes(acceptedMappedCharacterRecord.work.toLocaleLowerCase())
  || !sourceContextBeforeNavigation.includes(acceptedMappedCharacterRecord.sourceTitle.toLocaleLowerCase())) {
  failures.push("source evidence detail did not expose work and series before related navigation");
}
if (acceptedMappedCharacter && (!sourceContextBeforeNavigation.includes(acceptedMappedCharacter.evidence_level.toLocaleLowerCase()) || !sourceContextBeforeNavigation.includes(acceptedMappedCharacter.citations[0]?.locator.toLocaleLowerCase() ?? ""))) {
  failures.push("representative evidence detail omitted evidence level or citation locator");
}
await page.locator(".primary-button").filter({ hasText: "Open related concept" }).click();
const sourceContextAfterNavigation = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
if (!sourceContextAfterNavigation.includes("why this matched")
  || !sourceContextAfterNavigation.includes(acceptedMappedCharacterRecord?.work.toLocaleLowerCase() ?? "")
  || !sourceContextAfterNavigation.includes("open discovery citation")) {
  failures.push("related concept navigation discarded discovery context or citation evidence");
}
const nearbyConcept = page.locator(".detail-section").filter({ hasText: "Nearby stars" }).locator(".relation-button").first();
if (await nearbyConcept.count()) {
  await nearbyConcept.click();
  if ((await page.locator(".detail-panel").innerText()).toLocaleLowerCase().includes("why this matched")) {
    failures.push("unrelated nearby concept inherited the original discovery context");
  }
  if (await page.locator("#search").inputValue()) {
    failures.push("unrelated nearby concept retained a scoped discovery query");
  }
}

await page.locator("#search").fill("Vali");
await page.locator('.search-result[data-discovery-id="character:CHR-SRC015-026"]').click();
await page.locator(".primary-button").filter({ hasText: "Open related concept" }).click();
await page.locator(".detail-section").filter({ hasText: "Nearby stars" }).locator(".relation-button").filter({ hasText: "Leadership and Social Office Roles" }).click();
const subsequentValiNavigation = {
  query: await page.locator("#search").inputValue(),
  detail: (await page.locator(".detail-panel").innerText()).toLocaleLowerCase(),
};
await page.locator('.view-button[data-view="research"]').click();
const subsequentValiRows = await page.locator(".research-table tbody tr").count();
if (subsequentValiNavigation.query
  || subsequentValiNavigation.detail.includes("why this matched")
  || subsequentValiRows !== research.sources.length) {
  failures.push(`subsequent Vāli navigation left a scoped query while broadening: ${JSON.stringify({ ...subsequentValiNavigation, rows: subsequentValiRows })}`);
}
await page.locator('.view-button[data-view="constellations"]').click();

await page.locator("#search").fill("asura");
await page.locator(".search-result").filter({ hasText: "Guild Wars" }).first().click();
const evidenceDetail = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
if (!evidenceDetail.includes("ankka") || !evidenceDetail.includes("source and continuity") || !evidenceDetail.includes("no normalized archetype id")) {
  failures.push(`selected source evidence did not expose identity and mapping status: ${evidenceDetail}`);
}
if (!evidenceDetail.includes("review status:") || !evidenceDetail.includes("canon status:") || !evidenceDetail.includes("caution:")) {
  failures.push(`aggregate evidence omitted status or caution context: ${evidenceDetail}`);
}
if (!evidenceDetail.includes("dimensions:") || !evidenceDetail.includes("being / species / entity: asura") || !evidenceDetail.includes("role / class / vocation: antagonist")) {
  failures.push(`character evidence omitted indexed dimensions: ${evidenceDetail}`);
}

await page.locator("#search").fill("Ank-ka");
const punctuationText = await page.locator("#search-results").innerText();
if (!punctuationText.includes("Ankka")) {
  failures.push(`punctuation-tolerant character search omitted Ankka: ${punctuationText}`);
}

for (const [query, expected] of [["DAngeline", "Kushiel's Legacy"], ["Kiche", "Popol Vuh"]]) {
  await page.locator("#search").fill(query);
  const resultText = await page.locator("#search-results").innerText();
  if (!resultText.includes(expected)) failures.push(`joined punctuation search ${query} omitted ${expected}: ${resultText}`);
}

await page.locator("#search").fill("xenia");
await page.locator(".search-result").filter({ hasText: "Source-native term · Ancient Greek Mythology" }).first().click();
const xeniaDetail = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
if (!xeniaDetail.includes("work / witness\nhomer, odyssey · 9.105–566") || !xeniaDetail.includes("mapping withheld pending second review") || !xeniaDetail.includes("remains only in the retained research bundle") || xeniaDetail.includes("sacred hospitality (law-801)")) {
  failures.push(`xenia detail exposed or concealed its quarantined mapping status: ${xeniaDetail}`);
}

await page.locator("#search").fill("Chanjiao");
await page.locator(".search-result").filter({ hasText: `Source-native term · ${chanjiaoRecord?.sourceTitle}` }).first().click();
const chanjiaoDetail = await page.locator(".detail-panel").innerText();
for (const character of chanjiaoCharacters) {
  if (!chanjiaoDetail.includes(character.canonical_name)) failures.push(`Chanjiao detail omitted representative character ${character.canonical_name}`);
}

await page.locator("#search").fill("dvergr");
await page.locator(".search-result").filter({ hasText: `Source-native term · ${dvergrRecord?.sourceTitle}` }).first().click();
const dvergrDetail = await page.locator(".detail-panel").innerText();
const foldedDvergrDetail = dvergrDetail.toLocaleLowerCase();
if (!foldedDvergrDetail.includes(`work / witness\n${dvergrWork.toLocaleLowerCase()}`) || !foldedDvergrDetail.includes("source-wide scope") || !foldedDvergrDetail.includes("gylfaginning")) {
  failures.push(`dvergr detail did not separate claim provenance from source scope: ${dvergrDetail}`);
}

await page.locator("#search").fill("dīv");
await page.locator(".search-result").filter({ hasText: "Source-native term" }).first().click();
const divCitationSection = page.locator(".detail-section").filter({ hasText: "Term evidence and caution" });
const renderedDivCitations = await divCitationSection.locator(".citation-card").allTextContents();
if (renderedDivCitations.length !== shahnamehDiv?.citations.length
  || shahnamehDiv.citations.some((citation) => !renderedDivCitations.some((text) => text.includes(citation.locator)))) {
  failures.push("source-term detail hid one or more claim-specific citations");
}

const baldr = research.characters.find((character) => character.character_id === "CHR-SRC002-006");
await page.locator("#search").fill("Baldr");
await page.locator('.search-result[data-discovery-id="character:CHR-SRC002-006"]').click();
const baldrCard = page.locator(".detail-section").filter({ hasText: "Representative characters" }).locator("article.citation-card").filter({ hasText: "Baldr" }).first();
const baldrCitations = await baldrCard.locator(".evidence-citation").allTextContents();
if (!baldr || baldrCitations.length !== baldr.citations.length || baldr.citations.some((citation) => !baldrCitations.some((text) => text.includes(citation.locator)))) {
  failures.push("character detail hid one or more claim-specific citations");
}

const greekAudit = research.sources.find((audit) => audit.source_id === "SRC-001");
await page.locator("#search").fill("Achilles");
await page.locator('.search-result[data-discovery-id="character:CHR-SRC001-021"]').click();
const achillesSourceContext = await page.locator(".detail-section").filter({ hasText: "Source and continuity" }).innerText();
if (!greekAudit
  || !achillesSourceContext.includes(greekAudit.omissions[0])
  || !achillesSourceContext.includes(greekAudit.uncertainties[0])) {
  failures.push(`character detail omitted source-audit caution context: ${achillesSourceContext}`);
}

const irishAudit = research.sources.find((audit) => audit.source_id === "SRC-003");
await page.locator("#search").fill("Irish Mythological Cycle");
await page.locator(".search-result").filter({ hasText: "Source / series · Irish Mythological Cycle" }).first().click();
const irishCitations = await page.locator(".detail-section").filter({ hasText: "Source evidence and status" }).locator(".evidence-citation").allTextContents();
if (!irishAudit || irishCitations.length !== irishAudit.citations.length || irishAudit.citations.some((citation) => !irishCitations.some((text) => text.includes(citation.locator)))) {
  failures.push("source detail hid one or more claim-specific citations");
}

if (!source277Record) {
  failures.push("missing SRC-277 source discovery record");
} else {
  await page.locator("#search").fill(source277Record.label);
  await page.locator('.search-result[data-discovery-id="source:SRC-277"]').click();
  const source277CharacterSection = page.locator(".detail-section").filter({ has: page.locator("article.citation-card") }).last();
  const source277Presentation = {
    header: (await page.locator(".discovery-detail-header .evidence-row").innerText()).toLocaleLowerCase(),
    detail: (await source277CharacterSection.innerText()).toLocaleLowerCase(),
    cards: await source277CharacterSection.locator("article.citation-card").count(),
  };
  if (source277Presentation.header !== "indexed evidence\n49 indexed character records · 0 accepted normalized mappings"
    || !source277Presentation.detail.includes("character evidence sample")
    || !source277Presentation.detail.includes("showing 8 of 49 indexed character records.")
    || source277Presentation.cards !== 8) {
    failures.push(`SRC-277 source detail conflated totals and samples: ${JSON.stringify(source277Presentation)}`);
  }
}

const gucumatz = research.characters.find((character) => character.character_id === "CHR-SRC021-002");
await page.locator("#search").fill("Divine and Celestial Beings");
await page.locator(".search-result").filter({ hasText: "Normalized graph concept" }).first().click();
const gucumatzCard = page.locator(".detail-section").filter({ hasText: "Source evidence and examples" }).locator("article.citation-card").filter({ hasText: "Gucumatz" }).first();
const gucumatzCitations = await gucumatzCard.locator(".evidence-citation").allTextContents();
if (!gucumatz || gucumatzCitations.length !== gucumatz.citations.length || gucumatz.citations.some((citation) => !gucumatzCitations.some((text) => text.includes(citation.locator)))) {
  failures.push("concept evidence detail hid one or more claim-specific citations");
}

await page.locator("#search").fill("Aetherblades");
await page.locator(".search-result").filter({ hasText: "Source-native term · Guild Wars" }).first().click();
const aetherbladesDetail = await page.locator(".detail-panel").innerText();
for (const name of ["Ankka", "Ivan", "Mai Trin", "Scarlet"]) {
  if (!aetherbladesDetail.includes(name)) failures.push(`Aetherblades detail omitted representative character ${name}`);
}

for (const label of ["Human and Near-Human Peoples", "Deities", "Warrior or Fighter", "Mortal and Natural Peoples"]) {
  await page.locator("#search").fill(label);
  await page.locator(".search-result").filter({ hasText: "Normalized graph concept" }).first().click();
  if (label === "Mortal and Natural Peoples") {
    const evidenceBadge = (await page.locator(".detail-panel .evidence-badge").first().innerText()).toLocaleLowerCase();
    if (evidenceBadge !== "mapped evidence") failures.push("Mortal and Natural Peoples still presents descendant evidence as framework-only");
  }
  const evidenceText = await page.locator(".detail-section").filter({ hasText: "Source evidence and examples" }).innerText();
  if (!evidenceText.includes("Character Example")) failures.push(`${label} detail sampling omitted character evidence`);
}

const rankedExampleNode = concepts.nodes.find((node) => node.examples?.length > 10);
if (!rankedExampleNode) {
  failures.push("no concept exercises the generated representative-example limit");
} else {
  await page.locator("#search").fill(rankedExampleNode.label);
  await page.locator(".search-result").filter({ hasText: "Normalized graph concept" }).first().click();
  const displayedExamples = await page.locator(".detail-section")
    .filter({ hasText: "Source evidence and examples" })
    .locator("article.citation-card")
    .evaluateAll((cards) => cards.map((card) => card.querySelector(":scope > strong")?.textContent ?? ""));
  const generatedExamples = rankedExampleNode.examples.slice(0, 10).map((example) => example.label);
  if (JSON.stringify(displayedExamples) !== JSON.stringify(generatedExamples)) {
    failures.push(`browser reordered generator-ranked examples: ${JSON.stringify(displayedExamples)}`);
  }
}

for (const [sourceId, auditTitle, corpusTitle] of [
  ["SRC-087", "The Burning Kingdoms", "The Jasmine Throne"],
  ["SRC-009", "The Thousand and One Nights", "One Thousand and One Nights"],
]) {
  await page.locator("#search").fill(auditTitle);
  const sourceResult = page.locator(`.search-result[data-discovery-id="source:${sourceId}"]`).first();
  try {
    await sourceResult.waitFor({ state: "visible", timeout: 3_000 });
  } catch {
    failures.push(`${auditTitle} did not return its accepted source record`);
    continue;
  }
  const sourceResultText = await sourceResult.innerText();
  if (!sourceResultText.includes(`Source / series · ${corpusTitle}`) || !sourceResultText.includes("Matched source / series")) {
    failures.push(`${auditTitle} did not explain its source / series alias match: ${sourceResultText}`);
  }
  await sourceResult.click();
  const sourceWhy = await page.locator(".detail-section").filter({ hasText: "Why this matched" }).first().innerText();
  if (!sourceWhy.includes(auditTitle) || !sourceWhy.includes("source / series")) {
    failures.push(`${auditTitle} detail did not preserve its source / series match context: ${sourceWhy}`);
  }
}

await page.locator("#search").fill("The Once and Future King");
await page.locator(".search-result").filter({ hasText: "Source / series · The Once and Future King" }).first().click();
const sourceOnlyDetail = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
if (!sourceOnlyDetail.includes("source evidence and status") || !sourceOnlyDetail.includes("status: pass-complete") || !sourceOnlyDetail.includes("work / witness\nthe once and future king") || !sourceOnlyDetail.includes("caution:") || !sourceOnlyDetail.includes("open supporting source evidence")) {
  failures.push(`zero-character source detail omitted evidence/status/caution: ${sourceOnlyDetail}`);
}
if (await page.locator(".research-table tbody tr").count() !== 1 || !(await page.locator(".research-table tbody tr").first().innerText()).toLocaleLowerCase().includes("pass complete")) {
  failures.push("source result did not preserve its query and actual audit status in Research");
}

const limitedAudit = research.sources.find((audit) => audit.completion_status.includes("insufficient") || audit.completion_status.includes("narrow"));
if (limitedAudit) {
  await page.locator("#search").fill(limitedAudit.source_title);
  await page.locator(".search-result").filter({ hasText: `Source / series · ${limitedAudit.source_title}` }).first().click();
  const limitedResearch = (await page.locator(".research-table tbody tr").first().innerText()).toLocaleLowerCase();
  const limitedLabel = characterPassPresentation.get(limitedAudit.completion_status)?.label.toLocaleLowerCase();
  if (!limitedLabel || !limitedResearch.includes(limitedLabel) || !limitedResearch.includes("caution:")) {
    failures.push(`Research hid the actual limited audit status: ${limitedResearch}`);
  }
}

for (const sourceId of ["SRC-001", "SRC-073", "SRC-071", "SRC-072", "SRC-084"]) {
  const audit = research.sources.find((source) => source.source_id === sourceId);
  const expected = audit ? characterPassPresentation.get(audit.completion_status) : undefined;
  if (!audit || !expected) {
    failures.push(`missing character-pass browser fixture ${sourceId}`);
    continue;
  }
  await page.locator("#search").fill(audit.source_title);
  const row = page.locator(".research-table tbody tr").first();
  const pill = row.locator("td").nth(2).locator(".status-pill");
  const presentation = {
    rows: await page.locator(".research-table tbody tr").count(),
    label: await pill.textContent().catch(() => null),
    classes: await pill.getAttribute("class").catch(() => null),
  };
  if (presentation.rows !== 1
    || presentation.label !== expected.label
    || !presentation.classes?.split(/\s+/).includes(expected.className)) {
    failures.push(`${sourceId} character-pass styling is untruthful: ${JSON.stringify(presentation)}`);
  }
}
await page.locator("#search").fill("");

await page.locator('.view-button[data-view="research"]').click();
for (const [selector, background] of [[".research-card small", [11, 18, 31]], [".research-table th", [11, 19, 32]], [".review-lane .dimension-note", [8, 14, 24]], [".micro-stat", [9, 15, 27]], [".scope-fact span", [9, 15, 27]], [".legend-item", [9, 15, 27]], [".legend-note", [9, 15, 27]], [".statusbar", [5, 9, 18]]]) {
  const element = page.locator(selector).first();
  const ratio = await element.evaluate((node, backgroundColor) => {
    const values = getComputedStyle(node).color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
    const luminance = (channels) => channels
      .map((channel) => channel / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const foreground = luminance(values);
    const backdrop = luminance(backgroundColor);
    return (Math.max(foreground, backdrop) + 0.05) / (Math.min(foreground, backdrop) + 0.05);
  }, background);
  if (ratio < 4.5) failures.push(`${selector} contrast is ${ratio.toFixed(2)}:1`);
}

const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
await mobile.goto(appUrl, { waitUntil: "networkidle" });
await mobile.locator("#loading").waitFor({ state: "detached" });
await mobile.waitForFunction(() => !document.querySelector("#search")?.disabled);
const mobileConceptLabels = await mobile.locator("#atlas-svg .concept-label:visible").count();
if (mobileConceptLabels > 8) failures.push(`mobile constellation label budget exceeded: ${mobileConceptLabels}`);
await mobile.locator("#search").fill("Achilles");
await mobile.locator('.search-result[data-discovery-id="character:CHR-SRC001-021"]').click();
if (!(await mobile.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open")))) {
  failures.push("mobile search fixture did not open the detail drawer");
}
await mobile.keyboard.press("/");
await mobile.locator("#search").fill("human");
const mobileMatchingQuery = {
  detailOpen: await mobile.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open")),
  resultsVisible: await mobile.locator("#search-results").isVisible(),
  concept: await mobile.locator(".concept-detail-header h2").textContent().catch(() => null),
};
if (mobileMatchingQuery.detailOpen
  || !mobileMatchingQuery.resultsVisible
  || mobileMatchingQuery.concept !== "Human and Near-Human Peoples") {
  failures.push(`mobile matching query reopened the detail drawer: ${JSON.stringify(mobileMatchingQuery)}`);
}
await mobile.locator("#search").press("Escape");
const mobileEscapedQuery = {
  query: await mobile.locator("#search").inputValue(),
  detailOpen: await mobile.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open")),
  detailHeaders: await mobile.locator(".concept-detail-header, .discovery-detail-header").count(),
  focusVisible: await mobile.locator("#focus-banner").isVisible(),
};
if (mobileEscapedQuery.query
  || mobileEscapedQuery.detailOpen
  || mobileEscapedQuery.detailHeaders !== 0
  || mobileEscapedQuery.focusVisible) {
  failures.push(`mobile Escape retained stale selection state: ${JSON.stringify(mobileEscapedQuery)}`);
}
await mobile.locator("#search").fill("Achilles");
await mobile.locator('.search-result[data-discovery-id="character:CHR-SRC001-021"]').click({ force: true });
await mobile.keyboard.press("/");
await mobile.locator("#search").fill("asura");
if (await mobile.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open"))
  || !(await mobile.locator("#search-results").isVisible())
  || (await mobile.locator("#search-results").innerText()).includes("Ankka") === false) {
  failures.push("slash search remained obscured by the compact detail drawer");
}
await mobile.locator('.view-button[data-view="research"]').click();
const mobileDivergedQuery = {
  detailOpen: await mobile.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open")),
  detailHeaders: await mobile.locator(".concept-detail-header, .discovery-detail-header").count(),
  detailText: await mobile.locator(".detail-panel").innerText(),
  focusVisible: await mobile.locator("#focus-banner").isVisible(),
  guildWarsRows: await mobile.locator(".research-table tbody tr").filter({ hasText: "Guild Wars" }).count(),
};
if (mobileDivergedQuery.detailOpen
  || mobileDivergedQuery.detailHeaders !== 0
  || mobileDivergedQuery.detailText.includes("Achilles")
  || mobileDivergedQuery.focusVisible
  || mobileDivergedQuery.guildWarsRows !== 1) {
  failures.push(`mobile typed query reopened stale Achilles state: ${JSON.stringify(mobileDivergedQuery)}`);
}
await mobile.close();

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Discovery regression test passed: ${discovery.records.length} indexed records.`);
