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
if (discovery.records.some((record) => Object.hasOwn(record, "searchText"))) {
  failures.push("discovery index still carries the unused searchText payload");
}
const ankkaRecord = discovery.records.find((record) => record.id === "character:CHR-SRC162-001");
const sanskritAsuraRecord = discovery.records.find((record) => record.id === "source-term:STM-SRC277-004");
const abhimanyu = research.characters.find((character) => character.canonical_name === "Abhimanyu");
const mappedSourceTerm = research.sourceTerms.find((term) => term.term_id === "STM-SRC002-005");
const mappedConcept = concepts.nodes.find((node) => node.examples?.length);
const mappedSourceTermExample = concepts.nodes.flatMap((node) => node.examples ?? []).find((example) => example.id === mappedSourceTerm?.term_id);
if (!ankkaRecord || ankkaRecord.relatedConceptIds.length) failures.push("Ankka is no longer preserved as source-native evidence");
if (!sanskritAsuraRecord || sanskritAsuraRecord.relatedConceptIds.length) failures.push("SRC-277 asura was promoted into the graph");
if (!mappedConcept) failures.push("no mapped concept remains available for the failing-path comparison");
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(appUrl, { waitUntil: "networkidle" });
await page.locator("#loading").waitFor({ state: "detached" });

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
