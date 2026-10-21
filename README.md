# Visual Bible

An interactive visual Bible: every genealogy in Scripture woven into a single
explorable graph — from Adam to the apostles — plus a cinematic timeline of
four millennia of biblical events.

## Features

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
