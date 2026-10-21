// Functional smoke test: search -> reveal -> isolate lineage.
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://localhost:3210/genealogy", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

// search for Rahab (non-core person -> tests expand-on-demand)
await page.fill('input[aria-label="Search people"]', "Rahab");
await page.waitForTimeout(1200);
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);
await page.screenshot({ path: ".shots/test-search-rahab.png" });

// isolate lineage of the selection
await page.click('button[title*="Dim everyone"]');
await page.waitForTimeout(1200);
await page.screenshot({ path: ".shots/test-isolate.png" });

await browser.close();
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no page errors");
