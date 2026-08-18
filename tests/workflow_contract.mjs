import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const workflow = parse(await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"));
const failures = [];

const triggers = workflow?.on ?? {};
if (!Object.hasOwn(triggers, "pull_request")) failures.push("pull requests do not trigger validation");
const pushBranches = triggers.push?.branches ?? [];
if (JSON.stringify(pushBranches) !== JSON.stringify(["main"])) {
  failures.push(`push trigger is not restricted to main: ${JSON.stringify(pushBranches)}`);
}

const build = workflow?.jobs?.build;
if (!build || build.if) failures.push("the validation job is not available to every configured event");

const mainPushClauses = new Set([
  "github.event_name == 'push'",
  "github.ref == 'refs/heads/main'",
]);
function isMainPushOnly(condition) {
  if (typeof condition !== "string") return false;
  const expression = condition
    .replace("${{", "")
    .replace("}}", "")
    .split("&&")
    .map((clause) => clause.trim().replace(/\s+/g, " "));
  return expression.length === mainPushClauses.size
    && expression.every((clause) => mainPushClauses.has(clause));
}

const pagesUploads = Object.entries(workflow?.jobs ?? {}).flatMap(([jobName, job]) =>
  (job.steps ?? [])
    .filter((step) => step.uses === "actions/upload-pages-artifact@v3")
    .map((step) => ({ jobName, jobCondition: job.if, stepCondition: step.if })),
);
if (pagesUploads.length !== 1
  || !pagesUploads.every(({ jobCondition, stepCondition }) => isMainPushOnly(jobCondition) || isMainPushOnly(stepCondition))) {
  failures.push(`Pages upload is not limited to main pushes: ${JSON.stringify(pagesUploads)}`);
}

const deploy = workflow?.jobs?.deploy;
if (!deploy || !isMainPushOnly(deploy.if)) failures.push("Pages deployment job is not limited to main pushes");
if (!(deploy?.steps ?? []).some((step) => step.uses === "actions/deploy-pages@v4")) {
  failures.push("main-push deployment does not invoke GitHub Pages");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Workflow contract passed for PR validation and main-only publication.");
