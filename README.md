# Visual Bible

An interactive visual Bible: every genealogy in Scripture woven into a single
explorable graph — from Adam to the apostles — plus a cinematic timeline of
four millennia of biblical events.

## Features

- **Explore** (`/explore`) — the main experience: one world, one timeline.
  A 3D terrain map of the biblical world driven by the ages along the
  bottom. As the clock moves, the journeys, the people standing where the
  text puts them, nearby events, and the structures standing (or going up)
  in that year appear on the map. A person opens their family tree over the
  map; a structure opens its step-by-step build at the step reached that
  year. **Story mode** (`/explore?story=dwelling`) is a narrated path
  through the same world, built from scenes in `src/story/` — pause it
  anytime and explore from where it stopped.
- **Genealogy graph** (`/genealogy`) — a zoomable, generation-layered family
  graph of ~360 curated core figures, expandable on demand into the full
  ~3,000-person dataset. The messianic line from Adam to Jesus (65
  generations) is traced as an animated scarlet thread. Includes search with
  fly-to, isolate-lineage, era filtering, and a detail panel with Easton's
  Bible Dictionary bios, family links, and event cross-references.
- **Timeline** (`/timeline`) — a scroll-driven journey through ten eras, from
  Creation to the early church: 449 dated events on a central spine, lifespan
  bars for the major figures of each era, and living 3D era backdrops.
- **Atmosphere** — procedural Three.js scenes (a growing family tree on the
  landing page, constellation fields, nebulae, storms, and ember vortices)
  that lazy-load only when visible and fall back to static gradients under
  `prefers-reduced-motion`.

## Stack

Next.js (App Router, static export) · TypeScript · Tailwind CSS 4 ·
React Flow (`@xyflow/react`) + dagre for the graph · Framer Motion ·
Zustand · [ThreeUI](https://threeui.com) for the 3D scenes.

## Development

```bash
npm install
npm run build:data   # downloads + transforms the source dataset (first run)
npm run dev
```

`npm run build` produces a fully static site in `out/`, deployable to any
static host (Vercel, Netlify, GitHub Pages…).

## 3D models (Blender)

The step-by-step builds can take their parts from Blender. Each model is a
Python script in `blender/` (shared helpers in `blender/vb.py`) that builds the
structure in the app's own cubit coordinates, one `step_<id>` group per build
step, and exports a GLB. Materials are only named (`stone`, `cedar`, `gold`…);
the app swaps in its own PBR materials, and lights and fire stay in code.

```bash
npm run build:models            # every model in blender/
npm run build:models -- temple  # just one
```

This runs Blender headless (`BLENDER=/path/to/blender` to override), then
meshopt-compresses the result into `public/models/`. Steps a model leaves out
are still built in code (`src/lib/artifacts/build/`), so models can be added
one structure — or one step — at a time. Modelled so far: Solomon's Temple,
the Tabernacle, Noah's Ark and the Ark of the Covenant (the sanctuary
furniture is shared, in `blender/furniture.py`), plus every standalone piece
on the models page (`blender/objects.py`, one GLB each).

## Data pipeline

`scripts/build-data.mts` downloads the raw JSON from the Theographic
repository into `data/raw/` (gitignored) and generates:

- `src/data/generated/core-graph.json` — the curated core people and the
  messianic line (bundled with the app)
- `src/data/generated/events.json` — all dated events, era-tagged, with
  decoded verse references
- `public/data/people-all.json` — the full slim dataset, lazily fetched for
  search and expand-on-demand

Core selection = the walked messianic line ∪ the "Genealogy of Jesus" group ∪
the most verse-mentioned figures ∪ a small must-include list (writing
prophets) ∪ the immediate family of all of the above.

## Attribution

- Biblical people, relationships, and event data:
  [Theographic Bible Metadata](https://github.com/robertrouse/theographic-bible-metadata)
  by Robert Rouse, licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Bios: Easton's Bible Dictionary (public domain), via Theographic.
- 3D scenes: [ThreeUI](https://github.com/MengTo/threeui) by Meng To,
  MIT licensed.
- Cubit-model materials: gold & copper from
  [ambientCG](https://ambientcg.com) (CC0); wood, linen, fabric, stone, and
  studio HDRI from [Poly Haven](https://polyhaven.com) (CC0).
