import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const concepts = JSON.parse(await readFile(new URL("../public/data/constellations.json", import.meta.url), "utf8"));
const research = JSON.parse(await readFile(new URL("../public/data/characters.json", import.meta.url), "utf8"));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});

const failures = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") failures.push(`console: ${message.text()}`);
});

await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.locator("#loading").waitFor({ state: "detached" });

const status = await page.locator("#status-summary").textContent();
if (!status?.includes(`${concepts.meta.counts.nodes.toLocaleString("en-US")} class/race/entity stars`)) {
  failures.push(`unexpected status summary: ${status}`);
}
if (concepts.nodes.some((node) => !["being", "class"].includes(node.nodeKind))) {
  failures.push("constellation payload includes a non-class/race/entity node");
}
if (concepts.nodes.some((node) => node.id.startsWith("CHR-") || node.id.startsWith("SRC-"))) {
  failures.push("character or source records leaked into the concept-node set");
}
if (research.meta.researchCoverage.characterResearchedSources !== research.meta.researchCoverage.corpusSources) {
  failures.push("compiled research does not cover every corpus source");
}

const conceptMarks = await page.locator("#atlas-svg .concept-star").count();
const familyMarks = await page.locator("#atlas-svg .family-star").count();
const specificMarks = await page.locator("#atlas-svg .specific-star").count();
const taxonomyLines = await page.locator("#atlas-svg .taxonomy-line").count();
if (conceptMarks !== concepts.meta.counts.nodes) failures.push(`expected ${concepts.meta.counts.nodes} concept stars, got ${conceptMarks}`);
if (familyMarks !== concepts.meta.counts.families) failures.push(`expected ${concepts.meta.counts.families} family stars, got ${familyMarks}`);
if (specificMarks !== concepts.meta.counts.specificArchetypes) failures.push(`expected ${concepts.meta.counts.specificArchetypes} specific stars, got ${specificMarks}`);
if (taxonomyLines !== concepts.meta.counts.taxonomyEdges) failures.push(`expected ${concepts.meta.counts.taxonomyEdges} taxonomy lines, got ${taxonomyLines}`);
if ((await page.locator("#atlas-svg .character-mark").count()) !== 0) failures.push("character nodes remain in the graph");
if ((await page.locator("#atlas-svg .affinity-line:visible").count()) !== 0) failures.push("global affinity lines are visible before selection");

const connected = concepts.nodes.find((node) =>
  node.tier === 3 && concepts.edges.some((edge) => edge.kind === "affinity" && (edge.source === node.id || edge.target === node.id)),
);
if (!connected) {
  failures.push("compiled concept map has no evidence-backed cross-domain affinity");
} else {
  const expectedAffinities = concepts.edges.filter(
    (edge) => edge.kind === "affinity" && (edge.source === connected.id || edge.target === connected.id),
  ).length;
  const expectedFamilyMembers = concepts.nodes.filter(
    (node) => node.id === connected.familyId || node.familyId === connected.familyId,
  ).length;
  await page.locator("#search").fill(connected.label);
  await page.locator(".search-result").first().click();
  await page.locator(".concept-detail-header h2").filter({ hasText: connected.label }).waitFor();
  await page.waitForTimeout(800);
  if ((await page.locator(".attribute-item").count()) < 4) failures.push("concept attributes are not rendered as non-node dimensions");
  if (!(await page.locator("#focus-banner").isVisible())) failures.push("search did not open a stable focus banner");
  if ((await page.locator("#line-mode").inputValue()) !== "all") failures.push("search did not enable relationship lines");
  if ((await page.locator("#atlas-svg .is-family-member").count()) !== expectedFamilyMembers) failures.push("search did not illuminate the full aggregate family");
  if ((await page.locator("#atlas-svg .is-affinity-related").count()) !== expectedAffinities) failures.push("search did not illuminate cross-family affinities");
  if ((await page.locator("#atlas-svg .affinity-line:visible").count()) !== expectedAffinities) failures.push("selected affinities were not revealed");
  const relationshipTransform = await page.locator(".constellation-map").getAttribute("transform");
  const relationshipScale = Number(relationshipTransform?.match(/scale\(([^)]+)\)/)?.[1] ?? 0);
  if (relationshipScale < 0.72 || relationshipScale > 2.65) failures.push(`search relationship overview used an excessive zoom: ${relationshipScale}`);
  const localFontSize = await page.locator(".specific-star.is-selected .specific-label").evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  const renderedFontSize = localFontSize * relationshipScale;
  if (renderedFontSize < 7 || renderedFontSize > 11) failures.push(`semantic label size drifted while zooming: ${renderedFontSize}`);
  await page.locator(".primary-button").filter({ hasText: "Center star" }).click();
  await page.waitForTimeout(800);
  const drillTransform = await page.locator(".constellation-map").getAttribute("transform");
  const drillScale = Number(drillTransform?.match(/scale\(([^)]+)\)/)?.[1] ?? 0);
  if (drillScale < relationshipScale || drillScale > 4.3) failures.push(`staged drill-down zoom is outside its bounded range: ${drillScale}`);
  await page.locator("#focus-relations").click();
  const relationNodes = await page.locator("#atlas-svg .relation-star").count();
  const relationLines = await page.locator("#atlas-svg .local-relation-line").count();
  if (relationNodes < 2 || relationLines < 1 || relationNodes > 25) {
    failures.push(`unexpected local concept chart: ${relationNodes} stars / ${relationLines} lines`);
  }
}

await page.locator('[data-view="catalogue"]').click();
const familySections = await page.locator(".catalogue-family").count();
if (familySections !== concepts.meta.counts.families) failures.push(`expected ${concepts.meta.counts.families} catalogue families, got ${familySections}`);

await page.locator('[data-view="research"]').click();
const sourceRows = await page.locator(".research-table tbody tr").count();
if (sourceRows !== concepts.meta.counts.corpusSources) {
  failures.push(`expected ${concepts.meta.counts.corpusSources} research rows, got ${sourceRows}`);
}
const researchColumns = await page.locator(".research-table thead th").allTextContents();
if (!researchColumns.includes("Independent review")) failures.push("research table omits independent-review tracking");

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
mobile.on("pageerror", (error) => failures.push(`mobile pageerror: ${error.message}`));
await mobile.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await mobile.locator("#loading").waitFor({ state: "detached" });
await mobile.locator("#search").fill(connected?.label ?? concepts.nodes[0].label);
await mobile.locator(".search-result").first().click();
if (!(await mobile.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open")))) {
  failures.push("mobile concept selection did not open the detail drawer");
}
await mobile.locator(".mobile-detail-close").click();
if (!(await mobile.locator("#focus-banner").isVisible()) || (await mobile.locator("#atlas-svg .is-selected").count()) !== 1) {
  failures.push("closing the mobile detail drawer discarded the search focus");
}

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Concept constellation smoke test passed: ${conceptMarks} class/race/entity stars, ${familyMarks} semantic families, local relations, non-node attributes/evidence, and ${sourceRows} research rows.`,
);
