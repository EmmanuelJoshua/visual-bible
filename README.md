# Visual Bible

An interactive visual Bible: every genealogy in Scripture woven into a single
explorable graph — from Adam to the apostles — plus a cinematic timeline of
four millennia of biblical events.

## Features

- **Explore** (`/explore`) — the main experience: one world, one timeline.
  A painted 3D relief of the biblical world — Rome to Persia, a tabletop
  diorama you can orbit and zoom just far enough to see the models — driven
  by the ages along the bottom. As the clock moves, the journeys, the people standing where the
  text puts them, nearby events, and the structures standing (or going up)
  in that year appear on the map — the builds' 3D models standing on the
  relief at their sites (the temple on Moriah, the tabernacle at Shiloh, the
  ark on Ararat), rising step by step through the years they were built, and
  drawn larger than life as diorama landmarks, with a note saying by how much. A person
  opens their family tree over the
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
Zustand · three.js for the map and the models (both built in Blender) ·
[ThreeUI](https://threeui.com) for the atmospheric scenes.

## Development

```bash
npm install
npm run build:data   # downloads + transforms the source dataset (first run)
npm run dev
```

`npm run build` produces a fully static site in `out/`, deployable to any
static host (Vercel, Netlify, GitHub Pages…).

## The map

`/explore` is a relief model of the biblical world, from Italy to Persia
and the Black Sea to Arabia (10–56°E, 22–44°N), built in Blender and set
out in three.js like a museum piece (`src/components/diorama/`).

`npm run build:diorama` (`scripts/build-diorama.py`, about 40 minutes the
first time) makes it in three steps:

- **data**: for 56 render tiles (8 × 4 chunks, plus the Nile-to-Euphrates
  chunks again as quarters), real elevation from AWS Terrain Tiles and a
  painted base colour. The land takes its own hues from Sentinel-2
  cloudless, softened past the scale of any modern field or town, with
  rivers, lakes and snow; the sea goes by depth, from turquoise shallows to
  deep blue. Land is exaggerated 7×, the sea floor 2.5×.
- **render**: Blender (`blender/diorama.py`) sculpts each tile, lights it
  with a low, soft north-west sun and the sky, and renders it from straight
  above with Cycles. That shaded relief, with its real cast shadows, is the
  map's texture. Blender also builds each chunk's mesh, decimated inside
  with its borders kept exact so neighbours meet without cracks.
- **pack**: WebP textures (2048 px a chunk; 4096 around the Levant), a
  whole-map preview, a heightmap and sea mask for the app, and the chunk
  meshes (meshopt) into `public/diorama/`, with a versioned `meta.json`.

In the app the land is drawn as rendered, unlit; each chunk sharpens as the
camera nears, and everything is kept in Cache Storage after the first visit.
The seas are clear resin over the painted sea floor. The cut sides show rock
strata (and the resin where a coast meets the edge), on a dark plinth. The
studio has a warm backdrop, drifting light shafts and dust, shallow depth of
field, vignette and grain. The build models stand at their sites at diorama
size, lit by the same north-west key light so their shadows match the
render's.

Needs Python with numpy, scipy, Pillow and requests, and Blender
(`BLENDER=` to override the path). Downloads and intermediate tiles live in
`data/raw/diorama/` (git-ignored).

(`src/components/globe/` holds an earlier streaming satellite globe, no
longer used by the explorer.)

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
  [ambientCG](https://ambientcg.com) (CC0); wood, linen, fabric, stone, the
  dry ground around the sites, and studio HDRI from
  [Poly Haven](https://polyhaven.com) (CC0).
- Map colour: [EOxCloudless 2016](https://cloudless.eox.at) by EOX IT
  Services GmbH (contains modified Copernicus Sentinel data 2016), licensed
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), softened and
  painted over.
- Elevation: [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) on
  AWS (Mapzen; SRTM, GMTED, ETOPO1 and others; see their attribution).
- Coastlines, lakes and rivers: [Natural Earth](https://www.naturalearthdata.com)
  (public domain).
