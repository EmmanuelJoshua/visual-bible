// Usage: node scripts/shot.mjs <url> <outfile> [waitMs] [width] [height]
import { chromium } from "playwright";

const [url, out, waitMs = "2500", width = "1440", height = "900"] =
  process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: Number(height) },
});
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch((e) =>
  errors.push(`goto: ${e.message}`),
);
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out });
await browser.close();
if (errors.length) {
  console.log("PAGE ERRORS:");
  for (const e of [...new Set(errors)].slice(0, 12)) console.log(" -", e);
} else {
  console.log("no page errors");
}
