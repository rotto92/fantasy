import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
if (!html.includes('src="/fantasy/assets/')) {
  throw new Error("Pages build does not use the /fantasy/ asset base");
}

const assetNames = [...html.matchAll(/src="(\/fantasy\/assets\/[^\"]+\.js)"/g)].map((match) => match[1]);
if (!assetNames.length) throw new Error("Pages build has no JavaScript asset");
const assetText = await Promise.all(assetNames.map((name) => readFile(new URL(`../dist${name.replace(/^\/fantasy\//, "/")}`, import.meta.url), "utf8")));
const bundle = assetText.join("\n");
if (!bundle.includes("fantasy/")) throw new Error("Pages bundle omits the /fantasy/ runtime base");
for (const path of ["data/constellations.json", "data/characters.json", "data/discovery.json"]) {
  if (!bundle.includes(path)) throw new Error(`Pages bundle omits base-aware data path ${path}`);
}

console.log(`Static base contract passed: ${assetNames.length} Pages asset(s) use /fantasy/.`);
