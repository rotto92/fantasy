import { chromium } from "playwright-core";

export function launchBrowser(options = {}) {
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(),
    ...options,
  });
}
