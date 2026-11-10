// Captures every app shot the campaign video uses, into video/assets/footage/.
// Needs the static export served (node capture/serve.mjs ../out 4318).
//   node capture/shots.mjs            all shots
//   node capture/shots.mjs antioch    just the named ones
import fs from "node:fs";
import { launch, openExplore, clock, setUI, fullBleed, record, between, ease, easeOut, smooth, lerp, BASE } from "./lib.mjs";

const OUT = "video/assets/footage";
const STILLS = "video/assets/stills";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(STILLS, { recursive: true });
const want = new Set(process.argv.slice(2));
const on = (name) => want.size === 0 || want.has(name);
const PROFILE = ".cache/profile";
// square frames: the vertical cut crops the sides, the 16:9 cut the top and bottom
const SQ = { width: 1920, height: 1920 };

const P = {
  plinthA: { center: [33.0, 33.0], zoom: 3.35, pitch: 58, bearing: -24 },
  plinthB: { center: [33.6, 33.0], zoom: 3.75, pitch: 56, bearing: -8 },
  galilee: { center: [35.47, 32.78], zoom: 15.2, pitch: 74, bearing: 70 },
  galileeEnd: { center: [35.482, 32.783], zoom: 15.45, pitch: 75, bearing: 84 },
  antiochA: { center: [36.162, 36.204], zoom: 14.55, pitch: 68, bearing: 22 },
  antiochB: { center: [36.164, 36.206], zoom: 14.9, pitch: 70, bearing: 58 },
  babylonA: { center: [44.418, 32.537], zoom: 15.15, pitch: 63, bearing: 2 },
  babylonB: { center: [44.418, 32.539], zoom: 15.45, pitch: 65, bearing: 34 },
};

/* --- the world, cinematic: no UI ------------------------------------------- */
if (["plinth", "dive", "antioch", "babylon"].some(on)) {
  const { ctx, page } = await launch({ ...SQ, profile: PROFILE });
  await openExplore(page, "?journey=paul-1"); // AD 45: Antioch in its Roman phase
  await page.waitForTimeout(4500); // let the opening flight finish
  await setUI(page, "none");
  await fullBleed(page);
  await clock.start(page);

  if (on("plinth"))
    await record(page, { name: "plinth", seconds: 4.5, warm: 90, outDir: OUT,
      frame: (i, n) => between(P.plinthA, P.plinthB, i / (n - 1), smooth) });

  if (on("dive")) {
    // log-distance zoom eased; the centre arrives early so the land doesn't slide
    // past at street level; then a slow glide over the trees
    const dive = 5.0, glide = 3.5, fps = 30, nd = dive * fps;
    await record(page, { name: "dive", seconds: dive + glide, sub: 4, warm: 60, outDir: OUT,
      frame: (i) => {
        if (i < nd) {
          const t = i / (nd - 1);
          const k = ease(t), c = easeOut(Math.min(1, t * 1.35));
          return {
            center: [lerp(P.plinthB.center[0], P.galilee.center[0], c), lerp(P.plinthB.center[1], P.galilee.center[1], c)],
            zoom: lerp(P.plinthB.zoom, P.galilee.zoom, k),
            pitch: lerp(P.plinthB.pitch, P.galilee.pitch, ease(Math.min(1, t * 1.15))),
            bearing: lerp(P.plinthB.bearing, P.galilee.bearing, k),
          };
        }
        return between(P.galilee, P.galileeEnd, (i - nd) / (glide * fps - 1), (x) => x);
      } });
  }

  if (on("antioch"))
    await record(page, { name: "antioch", seconds: 4.5, warm: 150, outDir: OUT,
      frame: (i, n) => between(P.antiochA, P.antiochB, i / (n - 1), smooth) });

  if (on("babylon")) {
    await page.evaluate(() => window.__stage.setYear(-560)); // Nebuchadnezzar's city, the Ishtar Gate up
    await record(page, { name: "babylon", seconds: 4.5, warm: 150, outDir: OUT,
      frame: (i, n) => between(P.babylonA, P.babylonB, i / (n - 1), smooth) });
  }
  await ctx.close();
}

/* --- a journey playing: the app's own follow camera, markers kept ---------- */
if (on("journey")) {
  const { ctx, page } = await launch({ ...SQ, profile: PROFILE });
  await openExplore(page, "?journey=paul-1");
  await page.waitForTimeout(5000);
  await setUI(page, "markers");
  await fullBleed(page);
  await page.waitForTimeout(800);
  await clock.start(page);
  await page.keyboard.press("Space"); // play
  await clock.run(page, 400);
  await record(page, { name: "journey", seconds: 6, timeScale: 2.2, warm: 30, outDir: OUT });
  await ctx.close();
}

/* --- the temple going up, step by step: the build stage made full-frame ----
   build-w is 2880 wide: the film shows its left 1920, which puts the temple
   right of centre and leaves room for the title. */
for (const [name, vp] of [["build-v", { width: 1080, height: 1920 }], ["build-w", { width: 2880, height: 1080 }]]) {
  if (!on(name) && !on("build")) continue;
  const { ctx, page } = await launch({ ...vp, profile: PROFILE });
  await page.goto(`${BASE}/artifacts.html?object=temple&step=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll("canvas").length > 0, null, { timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    // the stage box (canvas + its label and stepper) over the whole page
    const canvas = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    let box = canvas.parentElement;
    while (box && box.getBoundingClientRect().height < 300) box = box.parentElement;
    const host = box.closest("[class*='rounded']") ?? box;
    host.style.cssText += ";position:fixed !important;inset:0 !important;width:100vw !important;height:100vh !important;z-index:9999;border-radius:0 !important;border:0 !important;margin:0 !important;";
    document.querySelectorAll("nextjs-portal").forEach((n) => n.remove());
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(1500);
  await clock.start(page);
  await clock.run(page, 1500);
  const every = 0.36; // seconds per step
  let next = 0.6, steps = 0;
  await record(page, { name, seconds: 0.6 + 16 * every + 1.4, warm: 10, outDir: OUT,
    frame: async (i) => {
      const t = i / 30;
      if (t >= next && steps < 16) {
        await page.keyboard.press("ArrowRight");
        steps++;
        next += every;
      }
    } });
  await ctx.close();
}

/* --- stills of the app with its UI, for device frames ---------------------- */
if (on("ui")) {
  for (const [name, vp, q] of [
    ["explore-desktop", { width: 1920, height: 1080 }, "?journey=exodus"],
    ["explore-mobile", { width: 430, height: 932, dpr: 3 }, "?journey=paul-1"],
  ]) {
    const { ctx, page } = await launch({ ...vp, profile: PROFILE });
    await openExplore(page, q);
    await page.waitForTimeout(9000);
    await setUI(page, "full");
    await page.screenshot({ path: `${STILLS}/${name}.png` });
    await ctx.close();
  }
}
console.log("done");
