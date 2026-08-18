import { readFile } from "node:fs/promises";
import { launchBrowser } from "./browser.mjs";

const concepts = JSON.parse(await readFile(new URL("../public/data/constellations.json", import.meta.url), "utf8"));
const research = JSON.parse(await readFile(new URL("../public/data/characters.json", import.meta.url), "utf8"));
const appUrl = process.env.FANTASY_TEST_URL ?? "http://127.0.0.1:5173/";
const browser = await launchBrowser({
  headless: true,
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});

const failures = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") failures.push(`console: ${message.text()}`);
});

await page.goto(appUrl, { waitUntil: "networkidle" });
await page.locator("#loading").waitFor({ state: "detached" });
await page.waitForFunction(() => !document.querySelector("#search")?.disabled);

const initialViewState = await page.locator(".view-button").evaluateAll((buttons) =>
  buttons.map((button) => [button.dataset.view, button.getAttribute("aria-pressed")]),
);
if (initialViewState.filter(([, pressed]) => pressed === "true").length !== 1
  || initialViewState.find(([view]) => view === "constellations")?.[1] !== "true") {
  failures.push(`view controls do not expose one semantic active state: ${JSON.stringify(initialViewState)}`);
}
await page.locator('.view-button[data-view="catalogue"]').click();
if (await page.locator('.view-button[data-view="catalogue"]').getAttribute("aria-pressed") !== "true"
  || await page.locator('.view-button[data-view="constellations"]').getAttribute("aria-pressed") !== "false") {
  failures.push("view controls did not synchronize semantic state after activation");
}
await page.locator('.view-button[data-view="constellations"]').click();

const placeholderContrast = await page.locator("#search").evaluate((node) => {
  const parseColor = (value) => (value.match(/[\d.]+/g) ?? []).map(Number);
  const composite = (foreground, background) => {
    const alpha = foreground[3] ?? 1;
    return foreground.slice(0, 3).map((channel, index) => channel * alpha + background[index] * (1 - alpha));
  };
  const luminance = (color) => {
    const channels = color.slice(0, 3).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const foreground = parseColor(getComputedStyle(node, "::placeholder").color);
  const header = composite(
    parseColor(getComputedStyle(node.closest(".topbar")).backgroundColor),
    parseColor(getComputedStyle(document.body).backgroundColor),
  );
  const background = composite(parseColor(getComputedStyle(node.parentElement).backgroundColor), header);
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
});
if (placeholderContrast < 4.5) failures.push(`search placeholder contrast is ${placeholderContrast.toFixed(2)}:1`);

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
if (taxonomyLines !== 0) failures.push(`global atlas rendered ${taxonomyLines} taxonomy lines`);
if ((await page.locator("#atlas-svg .character-mark").count()) !== 0) failures.push("character nodes remain in the graph");
if ((await page.locator("#atlas-svg .affinity-line:visible").count()) !== 0) failures.push("global affinity lines are visible before selection");

const aggregateFamily = concepts.nodes.find((node) => node.id === "PPL-100");
const aggregateLeaves = concepts.nodes.filter((node) => node.tier === 3 && node.familyId === aggregateFamily?.id);
if (!aggregateFamily || !aggregateLeaves.some((node) => node.evidenceCount === 0)) {
  failures.push("compiled concepts have no mixed-evidence family regression fixture");
} else {
  await page.locator("#evidence-filter").selectOption("framework");
  const frameworkFamily = page.locator(`#atlas-svg .family-star[data-node-id="${aggregateFamily.id}"]`);
  const frameworkScopeCounts = await page.locator("#scope-summary strong").allTextContents();
  if (frameworkScopeCounts.slice(-2).some((count) => count !== "0")) {
    failures.push(`framework-only families retained global evidence totals: ${JSON.stringify(frameworkScopeCounts)}`);
  }
  if ((await frameworkFamily.locator(".evidence-ring").count()) !== 0) {
    failures.push("framework-only family retained a global evidence ring");
  }
  await page.locator('.view-button[data-view="catalogue"]').click();
  await page.locator(`.catalogue-family-heading[data-node-id="${aggregateFamily.id}"]`).click();
  const frameworkDetail = {
    badge: await page.locator(".concept-detail-header .evidence-badge").textContent(),
    evidence: await page.locator(".concept-detail-header .evidence-row span:last-child").textContent(),
    sources: await page.locator(".concept-stat-grid > div:nth-child(2) strong").textContent(),
    examples: await page.locator("article.citation-card").count(),
  };
  if (frameworkDetail.badge !== "Framework only"
    || frameworkDetail.evidence !== "0 sources · 0 examples"
    || frameworkDetail.sources !== "0"
    || frameworkDetail.examples !== 0) {
    failures.push(`framework-only family detail retained global evidence: ${JSON.stringify(frameworkDetail)}`);
  }
  await page.locator("#reset-view").click();
  await page.locator('.view-button[data-view="constellations"]').click();

  const aggregateSourceId = "SRC-001";
  const aggregateSource = research.corpusSources.find((source) => source.sourceId === aggregateSourceId);
  const expectedSourceEvidence = new Map(
    aggregateLeaves
      .filter((node) => node.sourceIds.includes(aggregateSourceId))
      .flatMap((node) => node.evidenceMemberships ?? [])
      .filter((membership) => membership.sourceId === aggregateSourceId)
      .map((membership) => [`${membership.kind}:${membership.id}:${membership.sourceId}`, membership]),
  );
  await page.locator("#source-filter").selectOption(aggregateSourceId);
  await page.locator('.view-button[data-view="catalogue"]').click();
  await page.locator(`.catalogue-family-heading[data-node-id="${aggregateFamily.id}"]`).click();
  const sourceDetail = {
    evidence: await page.locator(".concept-detail-header .evidence-row span:last-child").textContent(),
    sources: await page.locator(".concept-stat-grid > div:nth-child(2) strong").textContent(),
    examples: await page.locator("article.citation-card").allTextContents(),
  };
  if (sourceDetail.evidence !== `1 sources · ${expectedSourceEvidence.size} examples`
    || sourceDetail.sources !== "1"
    || sourceDetail.examples.length !== Math.min(10, expectedSourceEvidence.size)
    || sourceDetail.examples.some((example) => !example.includes(aggregateSource?.title ?? ""))) {
    failures.push(`source-filtered family detail included unrelated evidence: ${JSON.stringify(sourceDetail)}`);
  }
  const ppl101 = aggregateLeaves.find((node) => node.id === "PPL-101");
  await page.locator('.concept-card[data-node-id="PPL-101"]').click();
  const ppl101SourceCount = await page.locator(".concept-detail-header .evidence-row span:last-child").textContent();
  const expectedPpl101SourceCount = (ppl101?.evidenceMemberships ?? [])
    .filter((membership) => membership.sourceId === aggregateSourceId).length;
  if (ppl101SourceCount !== `1 sources · ${expectedPpl101SourceCount} examples`
    || expectedPpl101SourceCount !== 13) {
    failures.push(`source-filtered PPL-101 count is not authoritative: ${ppl101SourceCount} / ${expectedPpl101SourceCount}`);
  }
  await page.locator("#reset-view").click();
  await page.locator('.view-button[data-view="constellations"]').click();

  await page.locator("#evidence-filter").selectOption("evidenced");
  await page.locator('.view-button[data-view="catalogue"]').click();
  await page.locator(`.catalogue-family-heading[data-node-id="${aggregateFamily.id}"]`).click();
  const evidencedFamilyCount = await page.locator(".concept-detail-header .evidence-row span:last-child").textContent();
  if (evidencedFamilyCount !== "6 sources · 52 examples") {
    failures.push(`evidence-filtered family count is not authoritative: ${evidencedFamilyCount}`);
  }
  await page.locator("#reset-view").click();
  await page.locator('.view-button[data-view="constellations"]').click();
}

const directFamilyFixtures = [
  { id: "PPL-200", sourceCount: 3, evidenceCount: 29 },
  { id: "PPL-300", sourceCount: 1, evidenceCount: 3 },
];
await page.locator("#evidence-filter").selectOption("evidenced");
await page.locator('.view-button[data-view="catalogue"]').click();
for (const fixture of directFamilyFixtures) {
  const familyHeading = page.locator(`.catalogue-family-heading[data-node-id="${fixture.id}"]`);
  if ((await familyHeading.count()) !== 1) {
    failures.push(`evidence filter dropped direct family ${fixture.id}`);
    continue;
  }
  await familyHeading.click();
  const evidenceCount = await page.locator(".concept-detail-header .evidence-row span:last-child").textContent();
  if (evidenceCount !== `${fixture.sourceCount} sources · ${fixture.evidenceCount} examples`) {
    failures.push(`evidence-filtered direct family ${fixture.id} reported ${evidenceCount}`);
  }
}
await page.locator("#reset-view").click();
await page.locator('.view-button[data-view="constellations"]').click();

await page.locator("#source-filter").selectOption("SRC-006");
await page.locator('.view-button[data-view="catalogue"]').click();
const directSourceFamily = page.locator('.catalogue-family-heading[data-node-id="PPL-300"]');
if ((await directSourceFamily.count()) !== 1) {
  failures.push("source filter dropped PPL-300 direct SRC-006 evidence");
} else {
  await directSourceFamily.click();
  const directSourceCount = await page.locator(".concept-detail-header .evidence-row span:last-child").textContent();
  if (directSourceCount !== "1 sources · 3 examples") {
    failures.push(`source-filtered PPL-300 reported ${directSourceCount}`);
  }
}
await page.locator("#reset-view").click();
await page.locator('.view-button[data-view="constellations"]').click();

const relationFamily = concepts.nodes.find((node) => node.id === "PPL-100");
const relationTarget = concepts.nodes.find((node) => node.id === "ROL-700");
if (!relationFamily || !relationTarget) {
  failures.push("compiled concepts have no filtered-affinity regression fixture");
} else {
  await page.locator("#evidence-filter").selectOption("framework");
  await page.locator('.view-button[data-view="catalogue"]').click();
  await page.locator(`.catalogue-family-heading[data-node-id="${relationFamily.id}"]`).click();
  if (await page.locator(".relation-button").filter({ hasText: relationTarget.label }).count()) {
    failures.push("framework-only detail retained a corpus-wide affinity");
  }
  await page.locator(".detail-actions button").filter({ hasText: "Show relations" }).click();
  if (await page.locator(`#atlas-svg .relation-star[data-node-id="${relationTarget.id}"]`).count()) {
    failures.push("framework-only Relations retained a corpus-wide affinity");
  }
  await page.locator("#reset-view").click();
  await page.locator('.view-button[data-view="constellations"]').click();

  await page.locator("#source-filter").selectOption("SRC-015");
  await page.locator('.view-button[data-view="catalogue"]').click();
  await page.locator(`.catalogue-family-heading[data-node-id="${relationFamily.id}"]`).click();
  const scopedRelation = page.locator(".relation-button").filter({ hasText: relationTarget.label });
  if ((await scopedRelation.locator("small").textContent()) !== "3 shared evidence records") {
    failures.push(`source-filtered detail retained a global affinity weight: ${await scopedRelation.textContent()}`);
  }
  await page.locator(".detail-actions button").filter({ hasText: "Show relations" }).click();
  const scopedRelationLine = page.locator(`.local-relation-line[aria-label*="${relationTarget.label}"]`);
  if ((await scopedRelationLine.count()) !== 1
    || await scopedRelationLine.getAttribute("stroke-width") !== "3"
    || !(await scopedRelationLine.getAttribute("aria-label"))?.includes("3 shared evidence records")) {
    failures.push("source-filtered relation line did not expose the scoped weight");
  }
  await page.locator("#reset-view").click();
  await page.locator('.view-button[data-view="constellations"]').click();
}

const humanConcept = concepts.nodes.find((node) => node.id === "PPL-101");
const warriorConcept = concepts.nodes.find((node) => node.id === "ROL-101");
if (!humanConcept || !warriorConcept) {
  failures.push("compiled concepts have no discovery-action regression fixtures");
} else {
  await page.locator("#search").fill("Achilles");
  await page.locator('.search-result[data-discovery-id="character:CHR-SRC001-021"]').click();
  await page.waitForTimeout(800);
  await page.locator("#domain-filter").selectOption("beings");
  const excludedRoleAction = page.locator("#detail-content .relation-button").filter({ hasText: warriorConcept.label });
  if ((await excludedRoleAction.count()) !== 0
    || (await page.locator("#atlas-svg .is-selected").getAttribute("data-node-id")) !== humanConcept.id) {
    failures.push("discovery detail retained a filter-excluded role action");
  }
  await page.locator("#reset-view").click();

  await page.locator("#search").fill("Achilles");
  await page.locator('.search-result[data-discovery-id="character:CHR-SRC001-021"]').click();
  await page.waitForTimeout(800);
  await page.locator("#source-filter").selectOption("SRC-001");
  const filteredHumanAction = page.locator("#detail-content .relation-button").filter({ hasText: humanConcept.label });
  const filteredHumanCount = await filteredHumanAction.locator("small").textContent().catch(() => null);
  if ((await filteredHumanAction.count()) !== 1 || filteredHumanCount !== "Beings & Peoples · 1 sources") {
    failures.push(`discovery action did not use the filtered concept aggregate: ${filteredHumanCount}`);
  }
  await page.locator("#reset-view").click();

  await page.locator("#search").fill("Achilles");
  await page.locator('.search-result[data-discovery-id="character:CHR-SRC001-021"]').click();
  await page.waitForTimeout(800);
  await page.locator("#evidence-filter").selectOption("framework");
  if ((await page.locator("#detail-content .relation-button").count()) !== 0
    || (await page.locator("#atlas-svg .is-selected").count()) !== 0
    || await page.locator(".discovery-detail-header").isVisible().catch(() => false)) {
    failures.push("evidence filter retained discovery actions for excluded mappings");
  }
  await page.locator("#reset-view").click();
}

await page.locator("#search").fill("Achilles");
await page.locator('.search-result[data-discovery-id="character:CHR-SRC001-021"]').click();
await page.waitForTimeout(800);
await page.locator("#source-filter").selectOption("SRC-003");
const downgradedSelection = {
  heading: await page.locator(".concept-detail-header h2").textContent().catch(() => ""),
  detail: await page.locator("#detail-content").innerText(),
  selectedNode: await page.locator("#atlas-svg .is-selected").getAttribute("data-node-id").catch(() => null),
  focusVisible: await page.locator("#focus-banner").isVisible(),
};
if (downgradedSelection.heading !== "Human and Near-Human Peoples"
  || downgradedSelection.detail.includes("Achilles")
  || downgradedSelection.detail.includes("Ancient Greek Mythology")
  || downgradedSelection.selectedNode !== "PPL-101"
  || !downgradedSelection.focusVisible) {
  failures.push(`out-of-scope discovery context was not downgraded atomically: ${JSON.stringify(downgradedSelection)}`);
}
await page.locator("#reset-view").click();

await page.locator("#evidence-filter").selectOption("framework");
await page.locator('.view-button[data-view="research"]').click();
const researchScope = {
  labels: await page.locator("#scope-summary span").allTextContents(),
  counts: await page.locator("#scope-summary strong").allTextContents(),
};
if (JSON.stringify(researchScope.labels) !== JSON.stringify(["source passes", "character records", "source terms", "focused reviews"])
  || researchScope.counts[0] !== String(research.corpusSources.length)) {
  failures.push(`Research retained a stale concept scope summary: ${JSON.stringify(researchScope)}`);
}
await page.locator("#reset-view").click();
await page.locator('.view-button[data-view="constellations"]').click();

const excludedSelection = concepts.nodes.find((node) => node.tier === 3 && node.evidenceCount > 0);
if (!excludedSelection) {
  failures.push("compiled concepts have no evidenced selection regression fixture");
} else {
  await page.locator("#search").fill(excludedSelection.label);
  await page.locator(`.search-result[data-discovery-id="concept:${excludedSelection.id}"]`).click();
  if (!(await page.locator("#focus-banner").isVisible()) || (await page.locator("#atlas-svg .is-selected").count()) !== 1) {
    failures.push("evidenced concept selection did not establish the filter-transition fixture");
  }
  await page.waitForTimeout(800);
  await page.locator("#evidence-filter").selectOption("framework");
  const filteredSelectionState = {
    selectedMarks: await page.locator("#atlas-svg .is-selected").count(),
    focusVisible: await page.locator("#focus-banner").isVisible(),
    detailOpen: await page.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open")),
  };
  await page.locator('.view-button[data-view="relations"]').click();
  filteredSelectionState.relationStars = await page.locator("#atlas-svg .relation-star").count();
  filteredSelectionState.relationPrompts = await page.locator("#atlas-svg .relation-prompt").count();
  if (filteredSelectionState.selectedMarks !== 0
    || filteredSelectionState.focusVisible
    || filteredSelectionState.detailOpen
    || filteredSelectionState.relationStars !== 0
    || filteredSelectionState.relationPrompts !== 1) {
    failures.push(`filter transition retained an excluded selection: ${JSON.stringify(filteredSelectionState)}`);
  }
  await page.locator("#reset-view").click();
  await page.locator('.view-button[data-view="constellations"]').click();
}

const mappedSourceOption = page.locator('#source-filter option[value]:not([value=""])').first();
const mappedSourceId = await mappedSourceOption.getAttribute("value");
if (!mappedSourceId) {
  failures.push("source filter has no mapped-source regression fixture");
} else {
  await page.locator("#source-filter").selectOption(mappedSourceId);
  await page.locator("#evidence-filter").selectOption("framework");
  const compositeScopeCounts = await page.locator("#scope-summary strong").allTextContents();
  const compositeMetrics = {
    conceptStars: await page.locator("#atlas-svg .concept-star").count(),
    familyStars: await page.locator("#atlas-svg .family-star").count(),
    visibleCount: await page.locator("#visible-count").textContent(),
  };
  if (compositeMetrics.conceptStars !== 0
    || compositeMetrics.familyStars !== 0
    || compositeMetrics.visibleCount !== "0 concept stars"
    || compositeScopeCounts.some((count) => count !== "0")) {
    failures.push(`source plus framework filter exposed inconsistent families or counts: ${JSON.stringify({ ...compositeMetrics, compositeScopeCounts })}`);
  }
  await page.locator('.view-button[data-view="catalogue"]').click();
  if ((await page.locator(".catalogue-family").count()) !== 0 || (await page.locator(".concept-card").count()) !== 0) {
    failures.push("catalogue reintroduced families with no leaves under the composite filter");
  }
  await page.locator('.view-button[data-view="constellations"]').click();
  await page.locator("#reset-view").click();
}

const accessibleStar = page.locator("#atlas-svg .concept-star").first();
if (await accessibleStar.getAttribute("role") !== "button" || await accessibleStar.getAttribute("tabindex") !== "0" || !(await accessibleStar.getAttribute("aria-label"))) {
  failures.push("map concepts are missing semantic keyboard control metadata");
} else {
  await accessibleStar.hover({ force: true });
  await page.locator("#tooltip:not([hidden]) small").waitFor();
  const tooltipEvidence = await page.locator("#tooltip").evaluate((node) => {
    const parseColor = (value) => (value.match(/[\d.]+/g) ?? []).map(Number);
    const tooltipBackground = parseColor(getComputedStyle(node).backgroundColor);
    const stageBackground = parseColor(getComputedStyle(document.querySelector("#stage")).backgroundColor);
    const alpha = tooltipBackground[3] ?? 1;
    const background = tooltipBackground.slice(0, 3).map((channel, index) => (
      channel * alpha + (stageBackground[index] ?? 0) * (1 - alpha)
    ));
    const luminance = (color) => {
      const channels = color.slice(0, 3).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const backgroundLuminance = luminance(background);
    return [...node.querySelectorAll("strong, span, small")].map((element) => {
      const style = getComputedStyle(element);
      const foregroundLuminance = luminance(parseColor(style.color));
      return {
        tag: element.tagName.toLocaleLowerCase(),
        fontSize: Number.parseFloat(style.fontSize),
        contrast: (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
          / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05),
      };
    });
  });
  const unreadableTooltipText = tooltipEvidence.find((item) => item.fontSize < 13 || item.contrast < 4.5);
  if (unreadableTooltipText) {
    failures.push(`tooltip ${unreadableTooltipText.tag} is unreadable: ${unreadableTooltipText.fontSize}px at ${unreadableTooltipText.contrast.toFixed(2)}:1`);
  }
  await page.mouse.move(0, 0);
  if ((await page.locator('#atlas-svg .concept-star[tabindex="0"]').count()) !== 1) failures.push("constellation map does not expose one roving tab stop");
  if (Number(await accessibleStar.locator(".star-hit-area").getAttribute("r")) < 22) failures.push("map concepts are missing touch-sized hit areas");
  await accessibleStar.focus();
  if (!(await accessibleStar.evaluate((node) => node === document.activeElement))) failures.push("map concept cannot receive keyboard focus");
  if ((await page.locator("#atlas-svg .is-selected").count()) || await page.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open"))) {
    failures.push("focusing a constellation star activated it");
  }
  const focusedBeforeArrow = await accessibleStar.getAttribute("data-node-id");
  await page.keyboard.press("ArrowRight");
  const focusedAfterArrow = await page.evaluate(() => document.activeElement?.getAttribute("data-node-id"));
  if (!focusedAfterArrow || focusedAfterArrow === focusedBeforeArrow || (await page.locator("#atlas-svg .is-selected").count())) {
    failures.push("spatial roving focus did not move without activating a star");
  }
  await page.keyboard.press("Enter");
  if (!(await page.locator(".concept-detail-header").isVisible())) failures.push("keyboard activation did not open concept detail");
  await page.waitForFunction(() => document.activeElement?.tagName === "H2");
  await page.waitForTimeout(800);
}

const denseTarget = await page.evaluate(() => {
  const stageBounds = document.querySelector("#stage")?.getBoundingClientRect();
  const marks = [...document.querySelectorAll("#atlas-svg .specific-star")]
    .filter((mark) => getComputedStyle(mark).display !== "none")
    .map((mark) => {
      const core = mark.querySelector(".specific-core");
      const bounds = core?.getBoundingClientRect();
      return bounds ? { id: mark.getAttribute("data-node-id"), x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 } : null;
    })
    .filter((mark) => mark
      && stageBounds
      && mark.x >= Math.max(0, stageBounds.left)
      && mark.x <= Math.min(innerWidth, stageBounds.right)
      && mark.y >= Math.max(0, stageBounds.top)
      && mark.y <= Math.min(innerHeight, stageBounds.bottom));
  let nearest = null;
  for (let left = 0; left < marks.length; left += 1) {
    for (let right = left + 1; right < marks.length; right += 1) {
      const distance = Math.hypot(marks[left].x - marks[right].x, marks[left].y - marks[right].y);
      if (!nearest || distance < nearest.distance) nearest = { ...marks[left], distance };
    }
  }
  return nearest;
});
if (!denseTarget || denseTarget.distance >= 44) {
  failures.push("map does not expose a dense touch-target regression case");
} else {
  await page.mouse.click(denseTarget.x, denseTarget.y);
  const selectedDenseTarget = await page.locator("#atlas-svg .is-selected").count()
    ? await page.locator("#atlas-svg .is-selected").getAttribute("data-node-id")
    : null;
  if (selectedDenseTarget !== denseTarget.id) {
    failures.push(`overlapping touch targets selected ${selectedDenseTarget ?? "nothing"} instead of nearest ${denseTarget.id} (${denseTarget.distance}px separation)`);
  }
}

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
  if ((await page.locator("#line-mode").inputValue()) !== "none") failures.push("global relationship display escaped local-only mode");
  if ((await page.locator("#atlas-svg .is-family-member").count()) !== expectedFamilyMembers) failures.push("search did not illuminate the full aggregate family");
  if ((await page.locator("#atlas-svg .is-affinity-related").count()) !== expectedAffinities) failures.push("search did not illuminate cross-family affinities");
  if ((await page.locator("#atlas-svg .affinity-line").count()) !== 0) failures.push("selected concept rendered global affinity lines");
  const relationshipTransform = await page.locator(".constellation-map").getAttribute("transform");
  const relationshipScale = Number(relationshipTransform?.match(/scale\(([^)]+)\)/)?.[1] ?? 0);
  if (relationshipScale < 0.72 || relationshipScale > 2.65) failures.push(`search relationship overview used an excessive zoom: ${relationshipScale}`);
  const relationshipHitRadius = Number(await page.locator("#atlas-svg .concept-star").first().locator(".star-hit-area").getAttribute("r"));
  if (Math.abs(relationshipHitRadius * relationshipScale - 22) > 0.75) failures.push("map touch targets changed size while zooming");
  const localFontSize = await page.locator(".specific-star.is-selected .specific-label").evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
  const renderedFontSize = localFontSize * relationshipScale;
  if (renderedFontSize < 6.95 || renderedFontSize > 11.05) failures.push(`semantic label size drifted while zooming: ${renderedFontSize}`);
  await page.locator(".primary-button").filter({ hasText: "Center star" }).click();
  await page.waitForTimeout(800);
  if (!(await page.evaluate(() => document.activeElement?.tagName === "H2"))) failures.push("detail action did not restore focus to the new heading");
  const drillTransform = await page.locator(".constellation-map").getAttribute("transform");
  const drillScale = Number(drillTransform?.match(/scale\(([^)]+)\)/)?.[1] ?? 0);
  if (drillScale < relationshipScale || drillScale > 4.3) failures.push(`staged drill-down zoom is outside its bounded range: ${drillScale}`);
  await page.locator(".detail-actions .secondary-button").filter({ hasText: "Show relations" }).click();
  await page.waitForFunction(() => document.activeElement?.tagName === "H2");
  const relationNodes = await page.locator("#atlas-svg .relation-star").count();
  const relationLines = await page.locator("#atlas-svg .local-relation-line").count();
  if (relationNodes < 2 || relationLines < 1 || relationNodes > 25) {
    failures.push(`unexpected local concept chart: ${relationNodes} stars / ${relationLines} lines`);
  }
  if ((await page.locator('#atlas-svg .relation-star[tabindex="0"]').count()) !== 1) failures.push("relation map does not expose one roving tab stop");
  const relationTarget = page.locator("#atlas-svg .relation-star").nth(1);
  const relationTargetId = await relationTarget.getAttribute("data-node-id");
  await relationTarget.focus();
  if (!(await relationTarget.evaluate((node) => node.isConnected && node === document.activeElement))) {
    failures.push("relation-map focus was detached while selecting a keyboard target");
  }
  await relationTarget.press("Enter");
  await page.waitForFunction((nodeId) => document.activeElement?.getAttribute("data-node-id") === nodeId, relationTargetId);
  if (!(await page.evaluate((nodeId) => document.activeElement?.isConnected === true && document.activeElement?.getAttribute("data-node-id") === nodeId, relationTargetId))) {
    failures.push("relation-map focus was detached during keyboard activation");
  }
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.activeElement?.id === "search");
  if ((await page.locator("#atlas-svg .relation-prompt").count()) !== 1 || (await page.locator("#atlas-svg .relation-star").count()) !== 0) {
    failures.push("Escape left stale relation-map content after clearing the selection");
  }

  await page.locator("#search").fill(connected.label);
  await page.locator(".search-result").first().click();
  await page.locator("#focus-relations").click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-node-id") !== null);
  if (!(await page.evaluate(() => document.activeElement?.classList.contains("relation-star")))) {
    failures.push("focus-relations left focus outside the live relation map");
  }
  await page.locator('[data-view="constellations"]').click();
  await page.locator("#focus-clear").click();
  if (!(await page.evaluate(() => document.activeElement?.id === "search"))) {
    failures.push("focus-clear left focus inside the hidden focus banner");
  }
}

await page.locator("#search").fill("");
await page.locator('[data-view="catalogue"]').click();
const familySections = await page.locator(".catalogue-family").count();
if (familySections !== concepts.meta.counts.families) failures.push(`expected ${concepts.meta.counts.families} catalogue families, got ${familySections}`);
await page.locator(".concept-card").first().click();
await page.waitForFunction(() => document.activeElement?.tagName === "H2");

await page.locator('[data-view="research"]').click();
const sourceRows = await page.locator(".research-table tbody tr").count();
if (sourceRows !== concepts.meta.counts.corpusSources) {
  failures.push(`expected ${concepts.meta.counts.corpusSources} research rows, got ${sourceRows}`);
}
const researchColumns = await page.locator(".research-table thead th").allTextContents();
const requiredResearchColumns = ["Scoped", "Character pass", "Terminology pass", "Relationship pass", "Second review", "Continuity review"];
if (requiredResearchColumns.some((column) => !researchColumns.includes(column))) {
  failures.push(`research table omits authoritative review lanes: ${researchColumns.join(", ")}`);
}
const zeroCharacterAudit = research.sources.find((audit) => audit.completed_character_count === 0);
if (zeroCharacterAudit) {
  await page.locator("#search").fill(zeroCharacterAudit.source_title);
  const zeroCharacterRow = (await page.locator(".research-table tbody tr").first().innerText()).toLocaleLowerCase();
  if (!zeroCharacterRow.includes("0 accepted records") || !zeroCharacterRow.includes("pass complete") || !zeroCharacterRow.includes("no lane-specific continuity or witness review is recorded")) {
    failures.push(`zero-character review lanes are ambiguous: ${zeroCharacterRow}`);
  }
  await page.locator("#search").fill("");
}

if (connected) {
  await page.locator("#search").fill(connected.label);
  if (!(await page.locator(".research-table tbody tr").count())) {
    failures.push("research concept search did not expose the concept's supporting source rows");
  }
}

await page.locator("#search").fill("Ankka");
if (!(await page.locator(".research-table tbody tr").filter({ hasText: "Guild Wars" }).count())) {
  failures.push("research search did not route corpus character evidence to its source pass");
}
await page.locator("#search").fill("Kamandjan");
const kamandjanRows = await page.locator(".research-table tbody tr").allTextContents();
if (kamandjanRows.length !== 1 || !kamandjanRows[0].includes("Sundiata Epic")) {
  failures.push(`research character search fanned out beyond its evidence source: ${kamandjanRows.join(" | ")}`);
}
await page.locator("#search").fill("Ankka");
if (!(await page.locator("#search-results .search-result").count())) failures.push("research search omitted the corpus discovery result");
await page.locator("#search").press("Escape");
if ((await page.locator("#search").inputValue()) || (await page.locator(".research-table tbody tr").count()) !== sourceRows) {
  failures.push("research Escape left a stale filtered table");
}
await page.locator("#search").fill("Ankka");
await page.locator('[data-view="constellations"]').click();
if ((await page.locator("#search").inputValue()) !== "Ankka") failures.push("view switch discarded the corpus search query");
await page.locator('[data-view="research"]').click();
if ((await page.locator("#search").inputValue()) !== "Ankka" || !(await page.locator(".research-table tbody tr").filter({ hasText: "Guild Wars" }).count())) {
  failures.push("Research did not retain the corpus search context across view switches");
}
await page.locator("#search").fill("no-source-or-corpus-record");
if (!(await page.locator(".research-empty").isVisible())) failures.push("research search has no zero-result recovery");
await page.locator("#search").fill("Ankka");
await page.locator("#reset-view").click();
if ((await page.locator("#search").inputValue()) || (await page.locator(".research-table tbody tr").count()) !== sourceRows || !(await page.locator("#search-results").isHidden())) {
  failures.push("Reset left stale research or discovery search state");
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
mobile.on("pageerror", (error) => failures.push(`mobile pageerror: ${error.message}`));
await mobile.goto(appUrl, { waitUntil: "networkidle" });
await mobile.locator("#loading").waitFor({ state: "detached" });
await mobile.waitForFunction(() => !document.querySelector("#search")?.disabled);
const mobileZoomBox = await mobile.locator("#zoom-in").boundingBox();
if (!mobileZoomBox || mobileZoomBox.width < 44 || mobileZoomBox.height < 44) failures.push("mobile zoom control is smaller than the touch target");
const mobileFamilyLabels = mobile.locator("#atlas-svg .family-label:visible");
if ((await mobileFamilyLabels.count()) > 8) failures.push("mobile constellation exceeds its progressive family-label budget");
for (const label of await mobileFamilyLabels.all()) {
  if (Number.parseFloat(await label.evaluate((node) => getComputedStyle(node).fontSize)) < 12) {
    failures.push("mobile constellation renders a microscopic family label");
    break;
  }
}
const mobileRovingStar = mobile.locator('#atlas-svg .concept-star[tabindex="0"]');
if ((await mobileRovingStar.count()) !== 1) {
  failures.push("mobile constellation does not expose one roving tab stop");
} else {
  await mobileRovingStar.focus();
  await mobile.keyboard.press("ArrowRight");
  if ((await mobile.locator("#atlas-svg .is-selected").count()) || await mobile.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open"))) {
    failures.push("mobile keyboard focus opened the fixed detail drawer");
  }
}
const mobileConcept = connected ?? concepts.nodes.find((node) => node.tier === 3) ?? concepts.nodes[0];
await mobile.locator("#search").fill(mobileConcept.label);
await mobile.locator(".search-result").filter({ hasText: "Normalized graph concept" }).first().click();
if (!(await mobile.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open")))) {
  failures.push("mobile concept selection did not open the detail drawer");
}
const mobileCloseBox = await mobile.locator(".mobile-detail-close").boundingBox();
if (!mobileCloseBox || mobileCloseBox.width < 44 || mobileCloseBox.height < 44) failures.push("mobile detail close control is smaller than the touch target");
const mobileFocusClearBox = await mobile.locator("#focus-clear").boundingBox();
if (!mobileFocusClearBox || mobileFocusClearBox.width < 44 || mobileFocusClearBox.height < 44) failures.push("mobile focus-clear control is smaller than the touch target");
const mobileDetailActionBox = await mobile.locator(".detail-actions button").first().boundingBox();
if (!mobileDetailActionBox || mobileDetailActionBox.height < 44) failures.push("mobile detail action is smaller than the touch target");
if (await mobile.locator(".relation-button").count()) {
  const mobileRelationActionBox = await mobile.locator(".relation-button").first().boundingBox();
  if (!mobileRelationActionBox || mobileRelationActionBox.height < 44) failures.push("mobile relation action is smaller than the touch target");
}
await mobile.locator(".mobile-detail-close").click();
if (await mobile.locator(".detail-panel").evaluate((node) => node.classList.contains("is-open")) || !(await mobile.locator("#focus-banner").isVisible()) || (await mobile.locator("#atlas-svg .is-selected").count()) !== 1 || !(await mobile.locator("#atlas-svg .is-selected").evaluate((node) => node === document.activeElement))) {
  failures.push("closing the mobile detail drawer discarded the search focus");
}
await mobile.locator('[data-view="catalogue"]').click();
await mobile.locator(".mobile-detail-close").click();
const catalogueCard = mobile.locator(".concept-card").first();
const catalogueLabel = (await catalogueCard.locator("strong").innerText()).trim();
await catalogueCard.click();
await mobile.locator(".mobile-detail-close").click();
if (!(await mobile.locator(".concept-card").first().evaluate((node) => node === document.activeElement))) {
  failures.push("catalogue detail close focused a stale hidden map control");
}
await mobile.locator('[data-view="constellations"]').click();
await mobile.locator(".mobile-detail-close").click();
await mobile.locator("#search").fill(catalogueLabel);
await mobile.locator(".search-result").filter({ hasText: catalogueLabel }).first().click();
await mobile.locator(".mobile-detail-close").click();
if (!(await mobile.locator("#atlas-svg .is-selected").evaluate((node) => node === document.activeElement))) {
  failures.push("constellation detail close preferred a hidden catalogue control");
}
await mobile.locator("#search").fill(catalogueLabel);
await mobile.locator(".search-result").filter({ hasText: catalogueLabel }).first().click();
const showMobileRelations = mobile.locator(".detail-actions button").filter({ hasText: "Show relations" });
if (await showMobileRelations.count()) {
  await showMobileRelations.click();
  const relationLabels = mobile.locator("#atlas-svg .relation-label:visible");
  if ((await relationLabels.count()) > 7) failures.push("mobile Relations exceeds its progressive label budget");
  for (const label of await relationLabels.all()) {
    if (Number.parseFloat(await label.evaluate((node) => getComputedStyle(node).fontSize)) < 12) {
      failures.push("mobile Relations renders a microscopic label");
      break;
    }
  }
}

for (const viewport of [
  { width: 320, height: 740, label: "320px" },
  { width: 375, height: 812, label: "375px" },
  { width: 768, height: 1024, label: "768px" },
  { width: 1440, height: 900, label: "1440px" },
  { width: 1920, height: 1080, label: "wide desktop" },
]) {
  const responsive = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  responsive.on("pageerror", (error) => failures.push(`${viewport.label} pageerror: ${error.message}`));
  await responsive.goto(appUrl, { waitUntil: "networkidle" });
  await responsive.locator("#loading").waitFor({ state: "detached" });
  await responsive.waitForFunction(() => !document.querySelector("#search")?.disabled);
  await responsive.locator("#search").fill("asura");
  await responsive.locator(".search-result").first().waitFor();
  const metrics = await responsive.evaluate(() => {
    const brand = document.querySelector(".brand")?.getBoundingClientRect();
    const results = document.querySelector("#search-results")?.getBoundingClientRect();
    const resultTitle = document.querySelector(".search-result strong");
    const resultContext = document.querySelector(".search-result small");
    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      brand: brand ? { width: brand.width, height: brand.height } : null,
      results: results ? { left: results.left, right: results.right } : null,
      titleFont: resultTitle ? Number.parseFloat(getComputedStyle(resultTitle).fontSize) : 0,
      contextFont: resultContext ? Number.parseFloat(getComputedStyle(resultContext).fontSize) : 0,
    };
  });
  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    failures.push(`${viewport.label} layout overflows horizontally: ${JSON.stringify(metrics)}`);
  }
  if (!metrics.results || metrics.results.left < -1 || metrics.results.right > viewport.width + 1) {
    failures.push(`${viewport.label} search results clip outside the viewport: ${JSON.stringify(metrics.results)}`);
  }
  if (metrics.titleFont < 12 || metrics.contextFont < 11) {
    failures.push(`${viewport.label} search typography is microscopic: ${metrics.titleFont}px/${metrics.contextFont}px`);
  }
  if (viewport.width <= 520 && (!metrics.brand || metrics.brand.width < 44 || metrics.brand.height < 44)) {
    failures.push(`${viewport.label} home link is smaller than the touch target`);
  }
  if (viewport.width <= 1040) {
    const controlsToggle = responsive.locator("#mobile-controls-toggle");
    const toggleBox = await controlsToggle.boundingBox();
    if (!toggleBox || toggleBox.width < 44 || toggleBox.height < 44 || await controlsToggle.getAttribute("aria-expanded") !== "false") {
      failures.push(`${viewport.label} controls toggle is not a collapsed touch target`);
    }
    await controlsToggle.click();
    if (!(await responsive.locator("#lens-panel").isVisible()) || await controlsToggle.getAttribute("aria-expanded") !== "true") {
      failures.push(`${viewport.label} controls drawer did not expose its expanded state`);
    }
    for (const selector of ["#reset-view", "#domain-filter", "#detail-level", "#source-filter", "#evidence-filter"]) {
      const box = await responsive.locator(selector).boundingBox();
      if (!box || box.height < 44) failures.push(`${viewport.label} ${selector} is not touch-operable in the controls drawer`);
    }
    await responsive.locator("#evidence-filter").selectOption("evidenced");
    if (await responsive.locator("#evidence-filter").inputValue() !== "evidenced") {
      failures.push(`${viewport.label} controls drawer did not apply the evidence filter`);
    }
    await responsive.locator('.view-button[data-view="catalogue"]').click();
    await controlsToggle.click();
    const familyBox = await responsive.locator("#family-filter").boundingBox();
    if (!familyBox || familyBox.height < 44 || !(await responsive.locator("#catalogue-controls").isVisible())) {
      failures.push(`${viewport.label} controls drawer did not expose the catalogue family filter`);
    }
    await responsive.locator("#reset-view").click();
  }
  await responsive.close();
}

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `Concept constellation smoke test passed: ${conceptMarks} class/race/entity stars, ${familyMarks} semantic families, local relations, non-node attributes/evidence, and ${sourceRows} research rows.`,
);
