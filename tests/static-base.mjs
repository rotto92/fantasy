import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./browser.mjs";

const distRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const mimeTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    if (!pathname.startsWith("/fantasy/")) {
      response.writeHead(404).end();
      return;
    }
    const requested = pathname.slice("/fantasy/".length) || "index.html";
    const filePath = resolve(distRoot, requested);
    if (relative(distRoot, filePath).startsWith("..")) {
      response.writeHead(403).end();
      return;
    }
    const fileStats = await stat(filePath);
    const actualPath = fileStats.isDirectory() ? resolve(filePath, "index.html") : filePath;
    const body = await readFile(actualPath);
    response.writeHead(200, { "content-type": mimeTypes[extname(actualPath)] ?? "application/octet-stream" }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Unable to start Pages artifact server");

const browser = await launchBrowser({ headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const requests = [];
page.on("request", (request) => requests.push(new URL(request.url())));
await page.goto(`http://127.0.0.1:${address.port}/fantasy/`, { waitUntil: "networkidle" });
await page.locator("#loading").waitFor({ state: "detached" });

const requestedPaths = requests.map((url) => url.pathname);
for (const path of ["/fantasy/data/constellations.json", "/fantasy/data/characters.json", "/fantasy/data/discovery.json"]) {
  if (!requestedPaths.includes(path)) throw new Error(`Built app did not request ${path}`);
}
if (requestedPaths.some((path) => path.startsWith("/data/") || path.startsWith("/src/"))) {
  throw new Error(`Built app requested an unbased asset: ${requestedPaths.join(", ")}`);
}
if (!(await page.locator("#status-summary").textContent())?.includes("class/race/entity stars")) {
  throw new Error("Built Pages app did not render its loaded state");
}

await browser.close();
await new Promise((resolveServer) => server.close(resolveServer));
console.log("Static base contract passed through the built /fantasy/ app.");
