import { readFile } from "node:fs/promises";
import { launchBrowser } from "./browser.mjs";

const discovery = JSON.parse(await readFile(new URL("../public/data/discovery.json", import.meta.url), "utf8"));
const concepts = JSON.parse(await readFile(new URL("../public/data/constellations.json", import.meta.url), "utf8"));
const research = JSON.parse(await readFile(new URL("../public/data/characters.json", import.meta.url), "utf8"));
const appUrl = process.env.FANTASY_TEST_URL ?? "http://127.0.0.1:5173/";
const failures = [];

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
const ankkaRecord = discovery.records.find((record) => record.id === "character:CHR-SRC162-001");
const sanskritAsuraRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC277-004");
const abhimanyu = research.characters.find((character) => character.canonical_name === "Abhimanyu");
const mappedSourceTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC002-005");
const mappedConcept = concepts.nodes.find((node) => node.examples?.length);
const mappedSourceTermExample = concepts.nodes.flatMap((node) => node.examples ?? []).find((example) => example.id === mappedSourceTerm?.term_id);
const xeniaRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC001-007");
const aetherbladesRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC162-002");
const jotunnRecord = discovery.records.find((record) => record.kind === "dimension-term" && record.sourceId === "SRC-002" && record.label === "jötunn");
const dvergrTerm = research.sourceTerms.find((term) => term.canonical_term === "dvergr" && term.source_id === "SRC-002");
const dvergrRecord = discovery.records.find((record) => record.id === `source-term:${dvergrTerm?.term_id}`);
const dvergrSourceRecord = discovery.records.find((record) => record.id === `source:${dvergrTerm?.source_id}`);
const dvergrExample = concepts.nodes.flatMap((node) => node.examples ?? []).find((example) => example.id === dvergrTerm?.term_id);
const mortalFamily = concepts.nodes.find((node) => node.label === "Mortal and Natural Peoples");
if (!ankkaRecord || ankkaRecord.relatedConceptIds.length) failures.push("Ankka is no longer preserved as source-native evidence");
if (!sanskritAsuraRecord || sanskritAsuraRecord.relatedConceptIds.length) failures.push("SRC-277 asura was promoted into the graph");
if (!mappedConcept) failures.push("no mapped concept remains available for the failing-path comparison");
if (!xeniaRecord?.normalizedConceptIds.includes("LAW-801") || !xeniaRecord.normalizedConceptIds.includes("LAW-802") || xeniaRecord.relatedConceptIds.length) {
  failures.push("non-graph normalized mappings were not preserved separately from graph-selectable links");
}
for (const name of ["Ankka", "Ivan", "Mai Trin", "Scarlet"]) {
  if (!aetherbladesRecord?.characterExamples.includes(name)) failures.push(`Aetherblades source-term evidence omitted ${name}`);
}
if (!jotunnRecord?.continuity.includes("Poetic Edda witness") || !jotunnRecord.continuity.includes("Prose Edda witness") || !jotunnRecord.work.includes("Vafþrúðnismál") || !jotunnRecord.work.includes("Gylfaginning")) {
  failures.push("grouped jötunn evidence collapsed its continuity or work provenance");
}
const dvergrWork = dvergrTerm?.citations.map((citation) => citation.locator).filter(Boolean).join("; ") ?? "";
if (!dvergrRecord || dvergrRecord.work !== dvergrWork || dvergrRecord.work.includes("Gylfaginning") || !dvergrSourceRecord?.work.includes("Gylfaginning")) {
  failures.push("dvergr discovery provenance overclaims the source-wide witness list");
}
if (!dvergrExample || dvergrExample.work !== dvergrWork || dvergrExample.work.includes("Gylfaginning")) {
  failures.push("dvergr concept evidence overclaims the source-wide witness list");
}
if (!mortalFamily?.evidenceCount || !mortalFamily.sourceCount || !mortalFamily.examples.some((example) => example.kind === "character-example")) {
  failures.push("tier-2 Mortal and Natural Peoples omitted descendant evidence");
}
if (mappedSourceTerm && mappedSourceTermExample) {
  const source = research.corpusSources.find((item) => item.sourceId === mappedSourceTerm.source_id);
  const audit = research.sources.find((item) => item.source_id === mappedSourceTerm.source_id);
  if (mappedSourceTermExample.continuity !== source?.continuityUnit) failures.push("source-term concept evidence omitted source continuity");
  if (mappedSourceTermExample.evidenceLevel === mappedSourceTerm.review_status) failures.push("source-term concept evidence mislabeled review status as evidence level");
  if (mappedSourceTermExample.evidenceBasis !== audit?.evidence_basis) failures.push("source-term concept evidence omitted its evidence basis");
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

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(appUrl, { waitUntil: "networkidle" });
await page.locator("#loading").waitFor({ state: "detached" });
await page.waitForFunction(() => !document.querySelector("#search")?.disabled);

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
}

await page.locator("#search").fill("asura");
const asuraText = await page.locator("#search-results").innerText();
if (!asuraText.includes("Ankka") || !asuraText.includes("Guild Wars")) {
  failures.push(`asura search omitted the Ankka/Guild Wars evidence: ${asuraText}`);
}
if (!(await page.locator("#search-results .search-result small").allTextContents()).some((text) => text.includes("Matched"))) {
  failures.push("search results do not explain why the query matched");
}

await page.locator("#search").fill("GuildWars2");
if (!(await page.locator("#search-results").innerText()).includes("Ankka")) {
  failures.push("concatenated continuity search omitted the Ankka evidence");
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

if (mappedSourceTerm) {
  await page.locator("#search").fill(mappedSourceTerm.canonical_term);
  await page.locator(".search-result").first().click();
  const mappedSourceTermDetail = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
  if (!mappedSourceTermDetail.includes("normalized family") || !mappedSourceTermDetail.includes(`review status: ${mappedSourceTerm.review_status.toLocaleLowerCase()}`) || !mappedSourceTermDetail.includes(mappedSourceTerm.cultural_caution.toLocaleLowerCase())) {
    failures.push(`mapped source-term detail omitted family, status, or caution: ${mappedSourceTermDetail}`);
  }
}

await page.locator("#search").fill("Kreiß");
const kreissText = await page.locator("#search-results").innerText();
if (!kreissText.includes("Kreiß")) failures.push(`compiler-compatible Unicode folding omitted Kreiß: ${kreissText}`);

const exactHumanEvidenceIds = discovery.records
  .filter((record) => ["being_types", "roles_and_vocations"].includes(record.dimension) && record.foldedLabel === "human")
  .map((record) => record.id);
if (exactHumanEvidenceIds.length <= 12) failures.push("human fixture no longer exercises search pagination");
await page.locator("#search").fill("human");
while (await page.locator("#search-results .search-more").count()) {
  await page.locator("#search-results .search-more").click();
}
const shownHumanIds = new Set(await page.locator("#search-results .search-result").evaluateAll((buttons) =>
  buttons.map((button) => button.getAttribute("data-discovery-id")),
));
for (const id of exactHumanEvidenceIds) {
  if (!shownHumanIds.has(id)) failures.push(`paginated human search omitted accepted evidence ${id}`);
}

await page.locator("#search").fill("Abhimanyu");
await page.locator(".search-result").first().click();
const sourceContextBeforeNavigation = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
if (!sourceContextBeforeNavigation.includes("droṇa parva") || !sourceContextBeforeNavigation.includes("mahābhārata")) {
  failures.push("source evidence detail did not expose work and series before related navigation");
}
if (abhimanyu && (!sourceContextBeforeNavigation.includes(abhimanyu.evidence_level.toLocaleLowerCase()) || !sourceContextBeforeNavigation.includes(abhimanyu.citations[0]?.locator.toLocaleLowerCase() ?? ""))) {
  failures.push("representative evidence detail omitted evidence level or citation locator");
}
await page.locator(".primary-button").filter({ hasText: "Open related concept" }).click();
const sourceContextAfterNavigation = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
if (!sourceContextAfterNavigation.includes("why this matched") || !sourceContextAfterNavigation.includes("droṇa parva") || !sourceContextAfterNavigation.includes("open discovery citation")) {
  failures.push("related concept navigation discarded discovery context or citation evidence");
}
const nearbyConcept = page.locator(".detail-section").filter({ hasText: "Nearby stars" }).locator(".relation-button").first();
if (await nearbyConcept.count()) {
  await nearbyConcept.click();
  if ((await page.locator(".detail-panel").innerText()).toLocaleLowerCase().includes("why this matched")) {
    failures.push("unrelated nearby concept inherited the original discovery context");
  }
}

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
if (!xeniaDetail.includes("normalized family") || !xeniaDetail.includes("hospitality, kinship & social metaphysics (law-800)") || !xeniaDetail.includes("normalized mapping") || !xeniaDetail.includes("sacred hospitality (law-801)") || !xeniaDetail.includes("guest–host reciprocity (law-802)") || !xeniaDetail.includes("outside the being/class graph")) {
  failures.push(`xenia detail discarded non-graph normalized mappings: ${xeniaDetail}`);
}

await page.locator("#search").fill("dvergr");
await page.locator(".search-result").filter({ hasText: `Source-native term · ${dvergrRecord?.sourceTitle}` }).first().click();
const dvergrDetail = await page.locator(".detail-panel").innerText();
const foldedDvergrDetail = dvergrDetail.toLocaleLowerCase();
if (!foldedDvergrDetail.includes(`work / witness\n${dvergrWork.toLocaleLowerCase()}`) || !foldedDvergrDetail.includes("source-wide scope") || !foldedDvergrDetail.includes("gylfaginning")) {
  failures.push(`dvergr detail did not separate claim provenance from source scope: ${dvergrDetail}`);
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

await page.locator("#search").fill("The Once and Future King");
await page.locator(".search-result").filter({ hasText: "Source / series · The Once and Future King" }).first().click();
const sourceOnlyDetail = (await page.locator(".detail-panel").innerText()).toLocaleLowerCase();
if (!sourceOnlyDetail.includes("source evidence and status") || !sourceOnlyDetail.includes("status: pass-complete") || !sourceOnlyDetail.includes("work / witness\nthe once and future king") || !sourceOnlyDetail.includes("caution:") || !sourceOnlyDetail.includes("open supporting source evidence")) {
  failures.push(`zero-character source detail omitted evidence/status/caution: ${sourceOnlyDetail}`);
}
if (await page.locator(".research-table tbody tr").count() !== 1 || !(await page.locator(".research-table tbody tr").first().innerText()).toLocaleLowerCase().includes("pass-complete")) {
  failures.push("source result did not preserve its query and actual audit status in Research");
}

const limitedAudit = research.sources.find((audit) => audit.completion_status.includes("insufficient") || audit.completion_status.includes("narrow"));
if (limitedAudit) {
  await page.locator("#search").fill(limitedAudit.source_title);
  await page.locator(".search-result").filter({ hasText: `Source / series · ${limitedAudit.source_title}` }).first().click();
  const limitedResearch = (await page.locator(".research-table tbody tr").first().innerText()).toLocaleLowerCase();
  if (!limitedResearch.includes(limitedAudit.completion_status.toLocaleLowerCase()) || !limitedResearch.includes("caution:")) {
    failures.push(`Research hid the actual limited audit status: ${limitedResearch}`);
  }
}

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Discovery regression test passed: ${discovery.records.length} indexed records.`);
