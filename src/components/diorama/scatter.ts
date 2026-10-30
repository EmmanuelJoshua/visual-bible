import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { TownNow } from "@/world/towns";
import { inTownNow } from "./cities";
import type { DioramaStage } from "./stage";

/**
 * What stands on the land close up: the trees, scrub and boulders of each
 * place, and its towns. Modelled in Blender (blender/landscape.py), drawn
 * many at once (instanced), and only near the camera.
 *
 * The land is cut into half-kilometre cells. Each grows the same things every
 * time (its seed is its place), chosen by what the land is there: the
 * painting's colour (green or bare), the slope, the height and the latitude,
 * gathered into groves and clearings by a little noise. Olive groves and
 * scrub on the hills of Judah and Samaria, palms by the Jordan and the Nile,
 * pine and oak in the mountains, acacia in the wilderness, boulders on the
 * steeps; around the towns, orchards in rows. A cell near the camera grows
 * fully; further off only its first few (the same few), so the screen holds
 * about the same number of things wherever the camera is. Nothing grows
 * inside a town standing in the year (cities.ts builds those).
 */

type Kind = "tree_olive" | "tree_cypress" | "tree_palm" | "tree_pine" | "tree_oak" | "tree_acacia" | "shrub" | "rock_a" | "rock_b";
const KINDS: Kind[] = ["tree_olive", "tree_cypress", "tree_palm", "tree_pine", "tree_oak", "tree_acacia", "shrub", "rock_a", "rock_b"];
const CAPACITY: Record<Kind, number> = {
  tree_olive: 24000, tree_cypress: 4000, tree_palm: 8000, tree_pine: 14000, tree_oak: 14000, tree_acacia: 3000,
  shrub: 20000, rock_a: 7000, rock_b: 3000,
};
const SOFT: Partial<Record<Kind, true>> = { tree_olive: true, tree_cypress: true, tree_palm: true, tree_pine: true, tree_oak: true, tree_acacia: true, shrub: true };
/**
 * drawn larger than life, as a model railway's trees are: at true size a grove
 * a kilometre off is a few specks; and larger still with distance, where there
 * are fewer, so the hills stay clothed
 */
const GROW: Partial<Record<Kind, number>> = { tree_olive: 2.1, tree_cypress: 1.9, tree_palm: 1.8, tree_pine: 2, tree_oak: 2.1, tree_acacia: 2, shrub: 2.2, rock_a: 1.5, rock_b: 1.5 };

/** something placed: where, which way, how big (x, y, z), how far into the ground (m); its height, as of a terrain generation */
type Item = { kind: Kind; lng: number; lat: number; yaw: number; sx: number; sy: number; sz: number; sink: number; m: number; gen: number };
type Placed = Item & { idx: number };
type Rand = { s: number };
type Cell = { cx: number; cy: number; rand: Rand; tried: number; items: Placed[]; grid: Float32Array; orchard: Set<string>; farm: number; towns: TownNow[] };
type Pick = { kind: Kind; size: number; sink: number };

const CELL = 0.005; // degrees, ~0.5 km
const GRID = 8; // a cell's heights for choosing, 9 × 9
/** candidates a cell near the camera tries */
const FULL = 1600;
/** within this of the camera a cell grows fully, km; beyond, falling as the square of the distance */
const FULL_KM = 1.2;
/** nothing grows past this from the camera, km: a tree there is under a pixel */
const FAR_KM = 7;
/** towns are looked for out to here, km */
const TOWN_KM = 12;
/** the camera must be within this of what it looks at for any of it to show, km */
export const SCATTER_BELOW = 10;

export class Scatter {
  readonly group = new THREE.Group();
  private meshes = new Map<Kind, THREE.InstancedMesh[]>();
  private cells = new Map<string, Cell>();
  private townsVersion = -1;
  private lastKey = "";
  private lastBuild = 0;
  private builtGen = -1;
  private ready = false;
  private frustum = new THREE.Frustum();
  private box = new THREE.Box3();

  constructor(private stage: DioramaStage) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    void loader.loadAsync("/models/landscape.glb").then((gltf) => {
      gltf.scene.updateMatrixWorld(true);
      for (const kind of KINDS) {
        const node = gltf.scene.getObjectByName(kind);
        if (!node) continue;
        const parts: THREE.InstancedMesh[] = [];
        node.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const src = m.material as THREE.MeshStandardMaterial;
          // boulders a weathered grey, not the kit's fresh-cut limestone
          const mat = new THREE.MeshStandardMaterial({
            color: kind.startsWith("rock") ? src.color.clone().multiplyScalar(0.62) : src.color,
            roughness: 0.92,
            metalness: 0,
            flatShading: true,
            side: SOFT[kind] ? THREE.DoubleSide : THREE.FrontSide,
            envMapIntensity: 0.35,
          });
          // every kit piece sits at the file's origin, in metres (its world matrix only undoes the
          // compression's quantizing); drawn in km
          const geo = unpacked(m.geometry);
          geo.applyMatrix4(m.matrixWorld);
          geo.scale(0.001, 0.001, 0.001);
          const inst = new THREE.InstancedMesh(geo, mat, CAPACITY[kind]);
          inst.count = 0;
          inst.castShadow = true;
          inst.receiveShadow = true;
          inst.frustumCulled = false;
          this.group.add(inst);
          parts.push(inst);
        });
        this.meshes.set(kind, parts);
      }
      this.ready = true;
    });
  }

  /** once a frame: rebuilt when the camera has moved enough, or the land under it has changed */
  update(now: number) {
    const s = this.stage;
    const d = s.camera.position.distanceTo(s.controls.target);
    const show = this.ready && d < SCATTER_BELOW;
    this.group.visible = show;
    if (!show) return;
    const cam = s.camera.position;
    const dir = s.camera.getWorldDirection(new THREE.Vector3());
    const step = Math.max(0.04, d * 0.06);
    const q = (v: number, k: number) => Math.round(v / k);
    const clearings = [...s.clearings.values()].map((c) => `${c.at[0].toFixed(4)}${c.at[1].toFixed(4)}${c.km.toFixed(3)}`).join();
    const key = [q(cam.x, step), q(cam.y, step), q(cam.z, step), q(dir.x, 0.08), q(dir.y, 0.08), q(dir.z, 0.08), q(Math.log(s.exaggeration), 0.02), s.albedoGen, clearings].join(",");
    const gen = s.terrain?.gen ?? 0;
    // the towns standing changed with the year: grow every cell again round them
    const version = s.cities?.version ?? 0;
    if (version !== this.townsVersion) {
      this.townsVersion = version;
      this.cells.clear();
      this.lastKey = "";
    }
    const due = key !== this.lastKey ? now - this.lastBuild > 200 : gen !== this.builtGen && now - this.lastBuild > 700;
    if (!due) return;
    this.lastKey = key;
    this.lastBuild = now;
    this.builtGen = gen;
    this.build(gen);
  }

  private build(gen: number) {
    const s = this.stage;
    const cam = s.camera.position;
    s.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(s.camera.projectionMatrix, s.camera.matrixWorldInverse));
    const [lng, lat] = s.lngLatOf(cam);
    const kmLng = 111.32 * Math.cos((lat * Math.PI) / 180);
    const rLng = FAR_KM / kmLng;
    const rLat = FAR_KM / 111.32;
    const towns = (s.cities?.active ?? []).filter((t) => t.houses !== false && Math.hypot((t.at[0] - lng) * kmLng, (t.at[1] - lat) * 111.32) - t.radius / 1000 < TOWN_KM);
    const lists: { d: number; items: Item[] }[] = [];

    const x0 = Math.floor((lng - rLng) / CELL);
    const x1 = Math.floor((lng + rLng) / CELL);
    const y0 = Math.floor((lat - rLat) / CELL);
    const y1 = Math.floor((lat + rLat) / CELL);
    const nw = new THREE.Vector3();
    const se = new THREE.Vector3();
    const mid = new THREE.Vector3();
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        s.world([cx * CELL, (cy + 1) * CELL], 0, nw);
        s.world([(cx + 1) * CELL, cy * CELL], 0, se);
        s.world([(cx + 0.5) * CELL, (cy + 0.5) * CELL], 0, mid);
        this.box.min.set(nw.x, mid.y - 1.2, nw.z);
        this.box.max.set(se.x, mid.y + 1.2, se.z);
        const dk = Math.max(0.05, this.box.distanceToPoint(cam));
        if (dk > FAR_KM || !this.frustum.intersectsBox(this.box)) continue;
        const want = Math.round(FULL * Math.min(1, (FULL_KM / dk) ** 2));
        if (want < 4) continue;
        const cell = this.cell(cx, cy, towns, want);
        if (!cell) continue;
        const items: Item[] = [];
        for (const it of cell.items) {
          if (it.idx >= want) break;
          items.push(it);
        }
        if (items.length) lists.push({ d: dk, items });
      }
    }
    // the nearest first, so if a kind runs out it runs out far away
    lists.sort((a, b) => a.d - b.d);
    this.write(lists, gen);
  }

  /* -------------------------------------------------------------- nature */

  /** a cell, grown to `want` candidates (or as far as the land's colour is in); null if not known yet */
  private cell(cx: number, cy: number, towns: TownNow[], want: number): Cell | null {
    const s = this.stage;
    const key = `${cx},${cy}`;
    let cell = this.cells.get(key);
    if (!cell) {
      const lng0 = cx * CELL;
      const lat0 = cy * CELL;
      const clng = lng0 + CELL / 2;
      const clat = lat0 + CELL / 2;
      if (!s.albedoAt(clng, clat)) return null;
      const grid = new Float32Array((GRID + 1) ** 2);
      for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) grid[j * (GRID + 1) + i] = s.metresAt(lng0 + (i / GRID) * CELL, lat0 + (j / GRID) * CELL);
      const kmLng = 111.32 * Math.cos((clat * Math.PI) / 180);
      // fields and orchards round a town; none inside it
      let farm = 0;
      const near: TownNow[] = [];
      for (const t of towns) {
        const dk = Math.hypot((t.at[0] - clng) * kmLng, (t.at[1] - clat) * 111.32);
        const r = t.radius / 1000;
        farm = Math.max(farm, 1 - smoothstep(r + 0.4, 2 * r + 2.8, dk));
        if (dk < r * 1.3 + 0.4) near.push(t);
      }
      cell = { cx, cy, rand: { s: (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0 || 1 }, tried: 0, items: [], grid, orchard: new Set(), farm, towns: near };
      this.cells.set(key, cell);
      if (this.cells.size > 6000) {
        const first = this.cells.keys().next().value;
        if (first) this.cells.delete(first);
      }
    }
    while (cell.tried < want && this.grow(cell));
    return cell;
  }

  /** one more candidate for a cell; false if the land's colour there isn't in yet */
  private grow(cell: Cell): boolean {
    const s = this.stage;
    const r = cell.rand;
    const saved = r.s;
    const fx = next(r);
    const fy = next(r);
    let lng = (cell.cx + fx) * CELL;
    let lat = (cell.cy + fy) * CELL;
    const col = s.albedoAt(lng, lat);
    if (!col) {
      // the same candidate comes again once the colour is in
      r.s = saved;
      return false;
    }
    const yaw = next(r) * Math.PI * 2;
    const roll = next(r);
    const vary = next(r);
    const idx = cell.tried++;

    // the land here, from the cell's grid
    const gx = fx * GRID;
    const gy = fy * GRID;
    const i = Math.min(GRID - 1, Math.floor(gx));
    const j = Math.min(GRID - 1, Math.floor(gy));
    const tx = gx - i;
    const ty = gy - j;
    const g = cell.grid;
    const n = GRID + 1;
    const h00 = g[j * n + i];
    const h10 = g[j * n + i + 1];
    const h01 = g[(j + 1) * n + i];
    const h11 = g[(j + 1) * n + i + 1];
    const h = (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
    if (h < 1) return true; // the shore, and the sea
    const cellM = (CELL * 111320) / GRID;
    const dx = ((h10 - h00) * (1 - ty) + (h11 - h01) * ty) / (cellM * Math.cos((lat * Math.PI) / 180));
    const dz = ((h01 - h00) * (1 - tx) + (h11 - h10) * tx) / cellM;
    const slope = Math.hypot(dx, dz);
    if (s.inLake(lng, lat)) return true;
    for (const t of cell.towns) if (inTownNow(t, lng, lat)) return true;

    // how the painting reads: watered ground as green as it is red, and dark (the Nile, the
    // Euphrates); the paler the rest, the barer (Galilee darkest, the deserts palest)
    const lum = (col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11) / 255;
    if (col[2] > col[0] + 6 && lum < 0.42) return true; // water-coloured: a river or a marsh
    const lush = col[1] - col[0] > -8 && lum < 0.5;
    const veg = Math.min(1, Math.max(0, (0.68 - lum) / 0.25));
    const clump = 0.6 * noise(lng * 620, lat * 620) + 0.4 * noise(lng * 1900 + 17, lat * 1900 + 5);
    const grove = smoothstep(0.36, 0.72, clump);

    let pick: Pick | null;
    let sx: number;
    let sy: number;
    if (cell.farm > 0 && slope < 0.16 && (lush || veg > 0.25) && noise(lng * 240 + 3, lat * 240 + 9) > 0.66 - 0.18 * cell.farm) {
      // an orchard round a town, on gentle ground: trees in rows, a lattice a few hundred metres across
      const a = noise(Math.floor(lng * 240) * 1.7, Math.floor(lat * 240) * 2.3) * Math.PI;
      const kmLng = 111.32 * Math.cos((lat * Math.PI) / 180);
      const e = (lng - cell.cx * CELL) * kmLng * 1000;
      const nz = (lat - cell.cy * CELL) * 111320;
      const spacing = 9;
      const u = Math.round((e * Math.cos(a) + nz * Math.sin(a)) / spacing);
      const v = Math.round((-e * Math.sin(a) + nz * Math.cos(a)) / spacing);
      const k = `${u},${v}`;
      if (cell.orchard.has(k)) return true;
      cell.orchard.add(k);
      lng = cell.cx * CELL + ((u * Math.cos(a) - v * Math.sin(a)) * spacing) / (kmLng * 1000);
      lat = cell.cy * CELL + ((u * Math.sin(a) + v * Math.cos(a)) * spacing) / 111320;
      pick = lat < 31.6 && h < 300 ? { kind: "tree_palm", size: 0.9, sink: 0.3 } : { kind: "tree_olive", size: 0.85, sink: 0.3 };
      sx = sy = pick.size * (0.85 + vary * 0.25);
    } else {
      pick = choose({ veg, lush, slope, h, lat, grove }, roll, vary);
      if (!pick) return true;
      sx = pick.size * (0.75 + vary * 0.55);
      sy = sx * (0.85 + ((vary * 7.3) % 1) * 0.3);
    }
    cell.items.push({ kind: pick.kind, lng, lat, yaw, sx, sy, sz: sx, sink: pick.sink, m: h, gen: -1, idx });
    return true;
  }

  /* --------------------------------------------------------------- write */

  private write(lists: { d: number; items: Item[] }[], gen: number) {
    const s = this.stage;
    const counts = new Map<Kind, number>();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const clearings = [...s.clearings.values()];
    for (const list of lists) {
      const far = Math.min(1.8, 1 + 0.16 * list.d);
      for (const it of list.items) {
        const parts = this.meshes.get(it.kind);
        if (!parts) continue;
        const i = counts.get(it.kind) ?? 0;
        if (i >= CAPACITY[it.kind]) continue;
        if (clearings.length && clearings.some((c) => s.kmBetween(c.at, [it.lng, it.lat]) < c.km)) continue;
        if (it.gen !== gen) {
          it.m = s.metresAt(it.lng, it.lat);
          it.gen = gen;
        }
        counts.set(it.kind, i + 1);
        s.world([it.lng, it.lat], 0, p);
        p.y = s.yOf(it.m) - it.sink / 1000;
        q.setFromAxisAngle(up, it.yaw);
        const k = (GROW[it.kind] ?? 1) * (SOFT[it.kind] ? far : 1);
        sc.set(it.sx * k, it.sy * k, it.sz * k);
        m.compose(p, q, sc);
        for (const inst of parts) inst.setMatrixAt(i, m);
      }
    }
    for (const kind of KINDS) {
      const n = counts.get(kind) ?? 0;
      for (const inst of this.meshes.get(kind) ?? []) {
        inst.count = n;
        inst.instanceMatrix.needsUpdate = true;
      }
    }
  }

  dispose() {
    for (const parts of this.meshes.values()) {
      for (const inst of parts) {
        inst.geometry.dispose();
        (inst.material as THREE.Material).dispose();
        inst.dispose();
      }
    }
  }
}

/** a copy with plain float attributes: the compressed (normalized integer) ones clamp when moved or scaled */
function unpacked(src: THREE.BufferGeometry) {
  const geo = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(src.attributes)) {
    const n = a.itemSize;
    const out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) {
      out[i * n] = a.getX(i);
      if (n > 1) out[i * n + 1] = a.getY(i);
      if (n > 2) out[i * n + 2] = a.getZ(i);
      if (n > 3) out[i * n + 3] = a.getW(i);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, n));
  }
  if (src.index) geo.setIndex(src.index.clone());
  for (const g of src.groups) geo.addGroup(g.start, g.count, g.materialIndex);
  return geo;
}

/** what grows here, if anything */
function choose(c: { veg: number; lush: boolean; slope: number; h: number; lat: number; grove: number }, roll: number, vary: number): Pick | null {
  const { veg, lush, slope, h, lat, grove } = c;
  const rock = (size = 1): Pick => ({ kind: vary < 0.7 ? "rock_a" : "rock_b", size, sink: 0.4 });
  const shrub = (size: number): Pick => ({ kind: "shrub", size, sink: 0.1 });
  if (slope > 0.7) return roll < 0.1 ? rock() : roll < 0.14 ? shrub(0.8) : null;
  const mountain = h > 1100 || lat > 37.5;
  const hot = lat < 32.4 && h < 450;
  if (lush) {
    // the watered valleys: palm groves in the south, orchards and woods elsewhere
    const trees = 0.06 + 0.5 * grove;
    if (roll < trees) {
      if (mountain) return { kind: vary < 0.6 ? "tree_pine" : "tree_oak", size: 1, sink: 0.3 };
      if (lat < 34 && h < 300) return { kind: vary < 0.7 ? "tree_palm" : vary < 0.9 ? "tree_olive" : "tree_cypress", size: 1, sink: 0.3 };
      return { kind: vary < 0.45 ? "tree_olive" : vary < 0.8 ? "tree_oak" : "tree_cypress", size: 1, sink: 0.3 };
    }
    return roll < trees + 0.12 ? shrub(1.1) : null;
  }
  if (veg > 0) {
    // the hills: woods and olive groves where the land is darkest, maquis and stone where it is paler
    const trees = veg * (0.03 + 0.55 * grove);
    if (roll < trees) {
      if (mountain) return { kind: vary < 0.55 ? "tree_pine" : "tree_oak", size: 1, sink: 0.3 };
      if (slope > 0.35) return { kind: vary < 0.6 ? "tree_oak" : "tree_pine", size: 0.9, sink: 0.3 };
      return { kind: vary < 0.55 ? "tree_olive" : vary < 0.85 ? "tree_oak" : vary < 0.93 ? "tree_cypress" : "tree_pine", size: 1, sink: 0.3 };
    }
    const scrub = 0.06 + 0.3 * veg * (0.5 + grove);
    if (roll < trees + scrub) return shrub(0.8 + 0.4 * veg);
    return roll < trees + scrub + 0.03 + 0.06 * (1 - veg) + slope * 0.12 ? rock() : null;
  }
  // desert: a thorn tree here and there, a few bushes, stones
  if (hot && roll < 0.006 + 0.012 * grove) return { kind: "tree_acacia", size: 1, sink: 0.2 };
  if (roll < 0.035) return shrub(0.6);
  return roll < 0.07 + slope * 0.12 ? rock(0.8) : null;
}

/** xorshift: a seeded sequence whose state can be put back */
function next(r: Rand) {
  let s = r.s;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  r.s = s >>> 0;
  return r.s / 4294967296;
}

function hash2(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** smooth value noise, 0..1, a lattice cell per unit */
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
