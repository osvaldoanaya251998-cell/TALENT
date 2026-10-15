// Rebuild the static sharing card with the existing logo; no external service.
// Run after `npm ci` in tests/. Chromium must be installed locally.
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
const require = createRequire(new URL("../tests/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  const logo = await readFile(new URL("../src/assets/insurtalent-logo.png", import.meta.url));
  const template = await readFile(new URL("./social-preview.html", import.meta.url), "utf8");
  await page.setContent(
    template.replace(
      "../src/assets/insurtalent-logo.png",
      `data:image/png;base64,${logo.toString("base64")}`,
    ),
  );
  await page.locator("img").evaluate((image) => image.decode());
  await page.screenshot({
    path: new URL("../public/og-insurtalent-v1.png", import.meta.url).pathname,
  });
} finally {
  await browser.close();
}
