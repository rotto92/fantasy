import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves this project from /fantasy/; local Vite keeps / for
  // the shortest feedback loop. VITE_BASE remains available for previews.
  base: process.env.VITE_BASE ?? (process.env.GITHUB_ACTIONS ? "/fantasy/" : "/"),
});
