import { launch, openExplore, clock, jumpTo, setUI, fullBleed } from "./lib.mjs";
const { ctx, page } = await launch({ width: 1920, height: 1920, profile: ".cache/profile" });
const t0 = Date.now();
await openExplore(page, "?journey=paul-1");
console.log("ready in", (Date.now() - t0) / 1000, "s");
const info = await page.evaluate(() => {
  const s = window.__stage;
  const c = document.querySelectorAll("canvas");
  const chain = [];
  for (let el = c[0]; el; el = el.parentElement) chain.push(el.tagName + "." + (el.className?.toString?.() ?? "").slice(0, 60));
  return { keys: Object.keys(s).slice(0, 60), canvases: c.length, chain, markers: !!s.markers, zoom: s.getZoom(), tilt: s.getTilt(),
    gl: (() => { const g = c[0].getContext("webgl2"); const d = g?.getExtension("WEBGL_debug_renderer_info"); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : "?"; })() };
});
console.log(JSON.stringify(info, null, 1));
// real-time fps
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
console.log("real fps", fps);
await page.waitForTimeout(5000);
await page.screenshot({ path: ".cache/probe-real.jpg", type: "jpeg", quality: 85 });
await setUI(page, "none"); await fullBleed(page);
await clock.start(page);
await jumpTo(page, { center: [36.16, 36.20], zoom: 14.2, pitch: 62, bearing: 30 });
let t = Date.now(); await clock.run(page, 3000); console.log("3s virtual took", (Date.now() - t) / 1000);
t = Date.now(); await page.screenshot({ path: ".cache/probe-antioch.jpg", type: "jpeg", quality: 90 }); console.log("shot", Date.now() - t, "ms");
await ctx.close();
