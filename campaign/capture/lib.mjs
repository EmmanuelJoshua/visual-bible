// Frame-exact capture of the Visual Bible app for the campaign video.
//
// The app animates from requestAnimationFrame + performance.now. An init script
// swaps both for a virtual clock, so each output frame is one clock step: the
// footage plays at true speed and stays smooth however slow a frame is to
// render or screenshot. Until `clock.start()` the page runs in real time (for
// loading and the opening flight).
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const BASE = process.env.APP_URL ?? "http://localhost:4318";
export const FFMPEG = process.env.FFMPEG ?? "ffmpeg";

const VIRTUAL_CLOCK = () => {
  const realNow = performance.now.bind(performance);
  const realRAF = window.requestAnimationFrame.bind(window);
  const realCancel = window.cancelAnimationFrame.bind(window);
  const vc = { on: false, frozen: false, base: 0, stepStart: 0, last: 0, queue: new Map(), id: 1e9 };
  window.__vc = vc;
  performance.now = () => {
    if (!vc.on) return realNow();
    if (!vc.frozen) vc.last = Math.max(vc.last, vc.base + (realNow() - vc.stepStart));
    return vc.last;
  };
  window.requestAnimationFrame = (cb) => {
    if (!vc.on) return realRAF(cb);
    const id = ++vc.id;
    vc.queue.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => (vc.queue.delete(id) ? undefined : realCancel(id));
  vc.start = () => {
    vc.base = realNow();
    vc.last = vc.base;
    vc.on = true;
    vc.frozen = true;
  };
  // one clock step: time moves dt ms, every pending frame callback runs once
  vc.step = (dt) => {
    vc.base = Math.max(vc.base + dt, vc.last + 0.01);
    vc.stepStart = realNow();
    vc.frozen = false;
    const cbs = [...vc.queue.values()];
    vc.queue.clear();
    for (const cb of cbs) {
      try {
        cb(vc.base);
      } catch (e) {
        console.error(e);
      }
    }
    vc.frozen = true;
    return new Promise((r) => realRAF(() => realRAF(r)));
  };
};

/** the DioramaStage, found through React's fibers (no hook in the app's source) */
const FIND_STAGE = () => {
  if (window.__stage) return true;
  const isStage = (v) => v && typeof v === "object" && typeof v.jumpTo === "function" && typeof v.flyTo === "function" && v.camera;
  for (const el of document.querySelectorAll("div")) {
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    if (!key) continue;
    for (let f = el[key]; f; f = f.return) {
      for (let h = f.memoizedState; h && typeof h === "object"; h = h.next) {
        const v = h.memoizedState;
        if (isStage(v)) return (window.__stage = v), true;
        if (v && isStage(v.current)) return (window.__stage = v.current), true;
      }
    }
  }
  return false;
};

/** hide every piece of UI: only the WebGL canvas (and, optionally, map markers) */
const UI_CSS = {
  none: `
    body * { visibility: hidden !important; }
    canvas, canvas * { visibility: visible !important; }
    nextjs-portal { display: none !important; }
  `,
  // DioramaMarker wraps are the only divs styled will-change: transform
  markers: `
    body * { visibility: hidden !important; }
    canvas, div[style*="will-change: transform"], div[style*="will-change: transform"] * { visibility: visible !important; }
    nextjs-portal { display: none !important; }
  `,
  full: `nextjs-portal { display: none !important; }`,
};

export async function launch({ width, height, profile, dpr = 1 }) {
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: CHROME,
    headless: true,
    viewport: { width, height },
    deviceScaleFactor: dpr,
    args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader=false", "--hide-scrollbars"],
  });
  await ctx.addInitScript(VIRTUAL_CLOCK);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text().slice(0, 200)));
  return { ctx, page };
}

/** open /explore and wait until the curtain lifts and the stage is reachable */
export async function openExplore(page, query = "") {
  await page.goto(`${BASE}/explore.html${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(FIND_STAGE, null, { timeout: 180000, polling: 500 });
  await page.waitForFunction(() => {
    const c = [...document.querySelectorAll("div[aria-hidden]")].find((d) => d.textContent?.includes("Setting out the map"));
    return !c || c.getAttribute("aria-hidden") === "true";
  }, null, { timeout: 300000, polling: 500 });
}

export async function setUI(page, mode) {
  await page.evaluate(([css]) => {
    let s = document.getElementById("__campaign_ui");
    if (!s) {
      s = document.createElement("style");
      s.id = "__campaign_ui";
      document.head.appendChild(s);
    }
    s.textContent = css;
  }, [UI_CSS[mode]]);
}

/** put the map canvas full-bleed over the page (it normally sits under the site nav) */
export async function fullBleed(page) {
  await page.evaluate(() => {
    const canvas = window.__stage.renderer?.domElement ?? document.querySelector("canvas");
    let el = canvas.parentElement;
    while (el && el !== document.body) {
      if (getComputedStyle(el).position === "absolute" && el.getBoundingClientRect().top > 0) {
        el.style.top = "0px";
      }
      el = el.parentElement;
    }
    window.dispatchEvent(new Event("resize"));
  });
}

export const clock = {
  start: (page) => page.evaluate(() => window.__vc.start()),
  step: (page, dt) => page.evaluate((d) => window.__vc.step(d), dt),
  /** run real-time-equivalent frames without capturing (lets streaming settle) */
  async run(page, ms, dt = 1000 / 30) {
    for (let t = 0; t < ms; t += dt) await clock.step(page, dt);
  },
};

export const jumpTo = (page, pose) => page.evaluate((p) => window.__stage.jumpTo(p), pose);

/**
 * Record a shot: for each output frame, `frame(i, n)` may move the camera
 * (return a pose) or do anything else, then the clock steps and the page is
 * captured. Frames are encoded to an MP4 at `fps`.
 */
export async function record(page, { name, seconds, fps = 30, sub = 2, timeScale = 1, frame, outDir, warm = 0 }) {
  const dir = path.join(process.env.FRAMES_DIR ?? ".cache/frames", name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(seconds * fps);
  const dt = (1000 / fps) * timeScale;
  // settle at the first frame's pose: tiles, trees and cities stream in
  if (frame) {
    const p = await frame(0, n);
    if (p) await jumpTo(page, p);
  }
  for (let k = 0; k < warm; k++) await clock.step(page, 0.5);
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    if (frame) {
      const p = await frame(i, n);
      if (p) await jumpTo(page, p);
    }
    for (let s = 0; s < sub; s++) await clock.step(page, dt / sub);
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, "0")}.jpg`), type: "jpeg", quality: 93 });
    if (i % 30 === 0) process.stdout.write(`  ${name} ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)}s)\r`);
  }
  process.stdout.write("\n");
  const mp4 = path.join(outDir, `${name}.mp4`);
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "%05d.jpg"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  return mp4;
}

/* camera paths ---------------------------------------------------------- */

export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const smooth = (t) => t * t * (3 - 2 * t);
/** pose between two, zoom linear (log distance), angles and centre eased */
export function between(a, b, t, e = ease) {
  const k = e(t);
  return {
    center: [lerp(a.center[0], b.center[0], k), lerp(a.center[1], b.center[1], k)],
    zoom: lerp(a.zoom, b.zoom, k),
    pitch: lerp(a.pitch, b.pitch, k),
    bearing: lerp(a.bearing, b.bearing, k),
  };
}
