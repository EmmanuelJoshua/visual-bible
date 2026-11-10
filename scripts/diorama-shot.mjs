// Screenshots of the /explore map, headless, for checking how it renders.
//   node scripts/diorama-shot.mjs '<json>' | <file.json>
//   {url?, width?, height?, steps: [{js?, wait?, out?, hide?}]}
// `js` runs in the page with the stage at window.__dio (the page is opened with ?debug, which exposes it);
// `hide` 1 hides the app's panels, 2 the map's labels too. Needs Google Chrome (WebGL through Metal).
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const arg = process.argv[2];
const cfg = JSON.parse(arg.trim().startsWith("{") ? arg : readFileSync(arg, "utf8"));
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: cfg.width ?? 1600, height: cfg.height ?? 930 }, deviceScaleFactor: cfg.dpr ?? 1 });
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) logs.push(`http ${r.status()}: ${r.url()}`); });
await page.goto(cfg.url ?? `http://localhost:4317/explore.html?debug&v=${Date.now()}`, { timeout: 60000 });
await page.waitForFunction(() => window.__dio, null, { timeout: 60000 });
await page.evaluate(() => window.__dio.ready);
await page.waitForTimeout(2500);
const results = [];
for (const s of cfg.steps) {
  if (s.js) results.push(await page.evaluate(s.js));
  await page.waitForTimeout(s.wait ?? 6000);
  if (s.out) {
    await page.evaluate((hide) => {
      const g = window.__dio;
      const keep = new Set();
      for (let n = g.renderer.domElement; n; n = n.parentElement) keep.add(n);
      for (const k of keep) {
        if (!k.parentElement) continue;
        for (const c of k.parentElement.children) if (!keep.has(c) && c !== g.overlay) c.style.visibility = hide ? "hidden" : "";
      }
      g.overlay.style.opacity = hide === 2 ? "0" : "1";
    }, s.hide ?? 0);
    await page.waitForTimeout(400);
    await page.screenshot({ path: s.out });
  }
}
console.log(JSON.stringify({ results, logs: logs.filter((l) => !l.includes("metalnessMap") && !l.includes("favicon") && !l.includes("status of 404")).slice(0, 20) }));
await browser.close();
