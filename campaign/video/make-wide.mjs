// Generates the 16:9 project, ../video-wide/index.html (1920×1080), from this
// index.html (1080×1920): same film, same timeline; the CSS's .w rules re-lay
// the type, and the 16:9 build and desktop stills are swapped in. HyperFrames
// wants one root composition per project, hence its own folder, sharing these
// assets through a symlink. Run after editing index.html: `npm run compose`.
import fs from "node:fs";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname);
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const swaps = [
  ['<meta name="viewport" content="width=1080, height=1920" />', '<meta name="viewport" content="width=1920, height=1080" />'],
  ['id="root" class="v"', 'id="root" class="w"'],
  ['data-width="1080" data-height="1920"', 'data-width="1920" data-height="1080"'],
  ["assets/footage/build-v.mp4", "assets/footage/build-w.mp4"],
  ["assets/stills/explore-mobile.png", "assets/stills/explore-desktop.png"],
  ["Vertical 1080×1920 master. ../video-wide/index.html (1920×1080) is generated from\n  this file by make-wide.mjs, so edit here and re-run `npm run compose`.",
   "GENERATED from index.html by make-wide.mjs: do not edit; edit index.html and run `npm run compose`."],
];
for (const [a, b] of swaps) {
  if (!html.includes(a)) throw new Error(`make-wide: not found: ${a}`);
  html = html.replace(a, b);
}
const out = path.join(dir, "..", "video-wide");
fs.mkdirSync(out, { recursive: true });
const link = path.join(out, "assets");
if (!fs.existsSync(link)) fs.symlinkSync("../video/assets", link);
fs.writeFileSync(path.join(out, "index.html"), html);
console.log("wrote video-wide/index.html");
