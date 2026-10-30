import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { LngLat } from "@/data/journeys";
import { TOWNS, townAt, type LandmarkKind, type Style, type TownNow } from "@/world/towns";
import type { DioramaStage } from "./stage";

/**
 * The cities of the biblical world, standing in their years
 * (src/world/towns.ts), built from two Blender kits (blender/landscape.py,
 * blender/city.py): street blocks inside their walls, towers and gates, the
 * landmarks each is remembered by (Antioch's colonnaded street and circus,
 * Babylon's ziggurat and Ishtar Gate, the pyramids, the Pharos), harbour
 * moles and aqueducts.
 *
 * Up close a city stands at its true size, the blocks near the camera opened
 * into their houses. From further off it grows, as the build models do, into
 * a miniature of itself that still reads on the map: at a hundred kilometres
 * Antioch spans a few times its true length, and a village is a kilometre
 * across. Everything is drawn instanced, and only a city whose scale, land or
 * neighbourhood has changed is placed again.
 */

const KITS = ["/models/landscape.glb", "/models/city.glb"];
const BLOCK: Record<Style, string> = { levant: "block_stone", mesopotamia: "block_mud", egypt: "block_mud", persia: "block_mud", greek: "block_roman", roman: "block_roman" };
const CAPACITY: Record<string, number> = {
  block_stone: 16000, block_mud: 16000, block_roman: 12000,
  house_a: 6000, house_b: 6000, house_c: 4000, house_d: 4000, house_roman: 6000, insula: 2000,
  wall: 14000, tower: 4000, gate: 600, colonnade: 3000, mole: 800, aqueduct: 3000, paving: 2500,
  temple_greek: 200, theatre: 160, hippodrome: 60, amphitheatre: 40, ziggurat: 80, palace: 200, apadana: 20,
  pyramid: 20, step_pyramid: 10, obelisk: 60, egypt_temple: 60, lighthouse: 10, citadel: 120, gate_glazed: 10,
};
/** colours a style lays over the kit's limestone */
const TINT: Record<Style, [number, number, number]> = {
  levant: [1, 1, 1],
  mesopotamia: [0.86, 0.72, 0.6],
  egypt: [0.92, 0.8, 0.64],
  persia: [0.94, 0.88, 0.78],
  greek: [1.03, 1.02, 1],
  roman: [0.99, 0.95, 0.9],
};
const TINTED = new Set(["wall", "tower", "gate", "house_a", "house_c"]);
/** each landmark's ground, in kit metres [x0, y0, x1, y1] (x east, y north): kept clear of houses */
const FOOT: Record<LandmarkKind, [number, number, number, number]> = {
  temple_greek: [-19, -38, 19, 38],
  theatre: [-53, -19, 53, 53],
  hippodrome: [-235, -56, 225, 56],
  amphitheatre: [-95, -79, 95, 79],
  ziggurat: [-46, -106, 46, 46],
  palace: [-96, -66, 96, 66],
  apadana: [-80, -110, 80, 80],
  pyramid: [-120, -120, 120, 120],
  step_pyramid: [-63, -55, 63, 55],
  obelisk: [-3, -3, 3, 3],
  egypt_temple: [-38, -48, 38, 112],
  lighthouse: [-36, -36, 36, 36],
  citadel: [-41, -41, 41, 41],
  gate_glazed: [-22, -10, 22, 10],
  paving: [-10, -10, 10, 10],
};
/** kit houses' plans, metres, for fitting them to a block's rows */
const HOUSE_PLAN: Record<string, [number, number]> = { house_a: [7, 5.5], house_b: [6, 6], house_c: [9, 7], house_d: [5, 4.5] };
const HOUSES: Record<Style, string[]> = {
  levant: ["house_a", "house_c", "house_a", "house_b", "house_d"],
  mesopotamia: ["house_b", "house_d", "house_b", "house_c"],
  egypt: ["house_b", "house_d", "house_b", "house_a"],
  persia: ["house_b", "house_a", "house_d"],
  greek: [],
  roman: [],
};

/** street blocks, metres: a block piece is 48 × 36 with the streets round it */
const PITCH: [number, number] = [60, 46];
/** blocks nearer the camera than this open into houses, km */
const OPEN_KM = 1.5;
/** a city is placed while the camera is within this of it, km */
const VIEW_KM = 700;
/** and while the camera is within this of what it looks at */
const SHOW_BELOW = 2600;

/** something placed: metres [east, north] of the town's centre, turned (counter-clockwise from east), sized */
type Piece = { kind: string; e: number; n: number; yaw: number; sx: number; sy: number; sz: number; sink: number; tint?: [number, number, number]; water?: boolean };
type Block = { e: number; n: number; yaw: number; seed: number; rank: number; houses: Piece[] | null };
type Layout = { pieces: Piece[]; blocks: Block[]; reach: number };
type Placed = Map<string, { m: number[]; c: number[] }>;
type City = { town: TownNow; layout: Layout; key: string; placed: Placed; dist: number };

export class DioramaCities {
  readonly group = new THREE.Group();
  /** the towns standing in the year, for the scatter to keep its trees out of */
  active: TownNow[] = [];
  /** bumps when `active` changes */
  version = 0;
  private meshes = new Map<string, { parts: THREE.InstancedMesh[]; matrix: THREE.InstancedBufferAttribute; color: THREE.InstancedBufferAttribute }>();
  private cities = new Map<string, City>();
  private layouts = new Map<string, Layout>();
  private ready = false;
  private last = 0;
  private lastKey = "";
  private frustum = new THREE.Frustum();
  private sphere = new THREE.Sphere();

  constructor(private stage: DioramaStage) {
    this.group.name = "cities";
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    void Promise.all(KITS.map((k) => loader.loadAsync(k))).then((kits) => {
      for (const gltf of kits) {
        gltf.scene.updateMatrixWorld(true);
        for (const node of gltf.scene.children) {
          const kind = node.name;
          if (!CAPACITY[kind]) continue;
          const cap = CAPACITY[kind];
          // one set of instance transforms and tints, shared by the piece's parts (a part per material)
          const matrix = new THREE.InstancedBufferAttribute(new Float32Array(cap * 16), 16);
          matrix.setUsage(THREE.DynamicDrawUsage);
          const color = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
          color.setUsage(THREE.DynamicDrawUsage);
          const parts: THREE.InstancedMesh[] = [];
          node.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!m.isMesh) return;
            const src = m.material as THREE.MeshStandardMaterial;
            const mat = new THREE.MeshStandardMaterial({ color: src.color, roughness: 0.9, metalness: 0, flatShading: true, envMapIntensity: 0.35 });
            // every kit piece sits at its file's origin in metres; drawn in km
            const geo = unpacked(m.geometry);
            geo.applyMatrix4(m.matrixWorld);
            geo.scale(0.001, 0.001, 0.001);
            const inst = new THREE.InstancedMesh(geo, mat, cap);
            inst.instanceMatrix = matrix;
            inst.instanceColor = color;
            inst.count = 0;
            inst.castShadow = true;
            inst.receiveShadow = true;
            inst.frustumCulled = false;
            this.group.add(inst);
            parts.push(inst);
          });
          this.meshes.set(kind, { parts, matrix, color });
        }
      }
      this.ready = true;
    });
    this.setYear(null);
  }

  /** the year to stand cities in; null for every city at its height */
  setYear(year: number | null) {
    const active: TownNow[] = [];
    for (const t of TOWNS) {
      const now = townAt(t, year);
      if (now) active.push(now);
    }
    const sig = (t: TownNow) => `${t.name}|${t.phase}|${t.landmarks?.length ?? 0}|${t.lines?.length ?? 0}`;
    if (active.map(sig).join() === this.active.map(sig).join()) return;
    this.active = active;
    this.version++;
    this.lastKey = "";
  }

  /** once a frame: cities placed again when the camera, the land or the year has moved them */
  update(now: number) {
    const s = this.stage;
    const d = s.camera.position.distanceTo(s.controls.target);
    const show = this.ready && d < SHOW_BELOW;
    this.group.visible = show;
    if (!show) return;
    const cam = s.camera.position;
    const q = (v: number, k: number) => Math.round(v / k);
    const step = Math.max(0.05, d * 0.03);
    const dir = s.camera.getWorldDirection(new THREE.Vector3());
    const key = [q(cam.x, step), q(cam.y, step), q(cam.z, step), q(dir.x, 0.1), q(dir.y, 0.1), q(dir.z, 0.1), q(Math.log(s.exaggeration), 0.02), s.terrain?.gen ?? 0, this.version, s.clearings.size].join();
    if (key === this.lastKey || now - this.last < 120) return;
    this.lastKey = key;
    this.last = now;
    this.place();
  }

  private place() {
    const s = this.stage;
    const cam = s.camera.position;
    s.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(s.camera.projectionMatrix, s.camera.matrixWorldInverse));
    const gen = s.terrain?.gen ?? 0;
    const e = Math.round(Math.log(s.exaggeration) / 0.02);
    const shown: City[] = [];
    const centre = new THREE.Vector3();
    for (const t of this.active) {
      const layout = this.layout(t);
      if (!layout.pieces.length && !layout.blocks.length) continue;
      s.world(t.at, 0, centre);
      const dist = centre.distanceTo(cam);
      if (dist > VIEW_KM) continue;
      const scale = scaleFor(dist, layout.reach);
      this.sphere.set(centre, (layout.reach / 1000) * scale * 1.3 + 0.5);
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      // blocks near the camera open into houses (only at true size); far off, fewer and larger
      const open = scale === 1 && dist < layout.reach / 1000 + OPEN_KM;
      const near = open ? `${Math.round(cam.x / 0.1)},${Math.round(cam.z / 0.1)}` : "";
      const thin = Math.round(Math.log(blockShare(dist)) / 0.15);
      const id = `${t.name}|${t.phase}`;
      const key = `${scale.toFixed(3)}|${gen}|${e}|${near}|${thin}|${this.version}|${[...s.clearings.values()].map((c) => c.km.toFixed(3)).join()}`;
      let city = this.cities.get(id);
      if (!city || city.layout !== layout) {
        city = { town: t, layout, key: "", placed: new Map(), dist };
        this.cities.set(id, city);
      }
      city.dist = dist;
      if (city.key !== key) {
        city.key = key;
        city.placed = this.build(t, layout, scale, open, blockShare(dist));
      }
      shown.push(city);
    }
    shown.sort((a, b) => a.dist - b.dist);
    this.write(shown);
  }

  /* -------------------------------------------------------------- layout */

  /** a town's plan in metres round its centre: worked out once for each phase and set of landmarks */
  private layout(t: TownNow): Layout {
    const id = `${t.name}|${t.phase}|${t.landmarks?.length ?? 0}|${t.lines?.length ?? 0}`;
    const hit = this.layouts.get(id);
    if (hit) return hit;
    const rand = rng(hash(t.name) + t.phase * 7919);
    const kmLng = 111.32 * Math.cos((t.at[1] * Math.PI) / 180);
    // offsets are given from the town's first centre; the plan is drawn round its centre now
    const base = TOWNS.find((x) => x.name === t.name)?.at ?? t.at;
    const rel = (ll: LngLat): [number, number] => [(ll[0] - t.at[0]) * kmLng * 1000, (ll[1] - t.at[1]) * 111320];
    const fromBase = (o: [number, number]): [number, number] => rel([base[0] + o[0] / 1000 / kmLng, base[1] + o[1] / 111320]);
    const tint = TINT[t.style];
    const pieces: Piece[] = [];
    const feet: { e: number; n: number; c: number; s: number; f: [number, number, number, number] }[] = [];
    let reach = Math.max(t.radius, 60);

    for (const l of t.landmarks ?? []) {
      const [e, n] = l.at ? rel(l.at) : fromBase(l.off ?? [0, 0]);
      const turn = ((l.turn ?? 0) * Math.PI) / 180;
      const k = l.scale ?? 1;
      const [sx, sz] = l.kind === "paving" ? (l.stretch ?? [1, 1]) : [k, k];
      pieces.push({ kind: l.kind, e, n, yaw: -turn, sx, sy: l.kind === "paving" ? 1 : k, sz, sink: l.kind === "paving" ? 0.3 : 0.6, water: l.kind === "lighthouse" });
      const f = FOOT[l.kind];
      feet.push({ e, n, c: Math.cos(turn), s: Math.sin(turn), f: [f[0] * sx, f[1] * sz, f[2] * sx, f[3] * sz] });
      reach = Math.max(reach, Math.hypot(e, n) + Math.max(...f.map(Math.abs)) * Math.max(sx, sz));
    }

    // colonnaded streets, roads, moles and aqueducts: kit pieces 20 m long, end to end
    const lines: [number, number, number, number][] = [];
    for (const l of t.lines ?? []) {
      const pts = l.path ? l.path.map(rel) : (l.off ?? []).map(fromBase);
      for (let i = 0; i < pts.length - 1; i++) {
        const [e0, n0] = pts[i];
        const [e1, n1] = pts[i + 1];
        const len = Math.hypot(e1 - e0, n1 - n0);
        const count = Math.max(1, Math.round(len / 20));
        const yaw = Math.atan2(n1 - n0, e1 - e0);
        for (let k = 0; k < count; k++) {
          const f = (k + 0.5) / count;
          const kind = l.kind === "road" ? "paving" : l.kind;
          pieces.push({ kind, e: e0 + (e1 - e0) * f, n: n0 + (n1 - n0) * f, yaw, sx: len / count / 20 + 0.02, sy: 1, sz: l.kind === "road" ? 1.1 : 1, sink: l.kind === "mole" ? 0 : 0.4, water: l.kind === "mole" || l.kind === "aqueduct" });
        }
        if (l.kind !== "mole" && l.kind !== "aqueduct") lines.push([e0, n0, e1, n1]);
        reach = Math.max(reach, Math.hypot(e0, n0), Math.hypot(e1, n1));
      }
    }

    // the wall, its towers and gates
    const walled = t.walled && t.radius >= 40;
    if (walled) {
      const ring = wallRing(t);
      const gates = gateSet(ring.length, t.rect ? 4 : 3 + Math.floor(rand() * 2), rand, ring);
      for (let k = 0; k < ring.length; k++) {
        const [e0, n0] = ring[k];
        const [e1, n1] = ring[(k + 1) % ring.length];
        const seg = Math.hypot(e1 - e0, n1 - n0);
        if (seg < 1) continue;
        const yaw = Math.atan2(n1 - n0, e1 - e0);
        const e = (e0 + e1) / 2;
        const n = (n0 + n1) / 2;
        if (gates.has(k)) pieces.push({ kind: "gate", e, n, yaw, sx: seg / 14, sy: 1.1, sz: 1, sink: 2.5, tint });
        else pieces.push({ kind: "wall", e, n, yaw, sx: seg / 20 + 0.04, sy: 1, sz: 1, sink: 3, tint });
        if (k % 4 === 0 || ring.corner?.has(k)) pieces.push({ kind: "tower", e: e0, n: n0, yaw, sx: 1.1, sy: 1.2, sz: 1.1, sink: 3, tint });
      }
    }

    // the street blocks: a grid turned with the town, inside its wall, clear of its landmarks and main streets
    const blocks: Block[] = [];
    if (t.houses !== false && t.radius >= 40) {
      const g = (((t.grid ?? t.rect?.turn ?? Math.floor(rand() * 90)) as number) * Math.PI) / 180;
      const cg = Math.cos(g);
      const sg = Math.sin(g);
      const span = t.rect && (t.grid === undefined || t.grid === t.rect.turn) ? [t.rect.w / 2, t.rect.h / 2] : [t.radius * 1.2, t.radius * 1.2];
      for (let y = -span[1]; y <= span[1]; y += PITCH[1]) {
        for (let x = -span[0]; x <= span[0]; x += PITCH[0]) {
          const e = x * cg + y * sg;
          const n = -x * sg + y * cg;
          const r = rand();
          const rank = rand();
          if (!inside(t, e, n, 26)) continue;
          const dist = Math.hypot(e, n) / Math.max(1, t.radius);
          // packed at the heart; yards, gardens and open ground toward the wall
          if (r > 0.97 - 0.42 * dist * dist) continue;
          if (feet.some((ft) => inFoot(ft, e, n, 28))) continue;
          if (lines.some(([e0, n0, e1, n1]) => toSegment(e, n, e0, n0, e1, n1) < 34)) continue;
          blocks.push({ e, n, yaw: -g, seed: Math.floor(rand() * 1e9), rank, houses: null });
        }
      }
    }
    const layout = { pieces, blocks, reach };
    this.layouts.set(id, layout);
    return layout;
  }

  /** a block's houses, when the camera comes close enough to see them */
  private houses(t: TownNow, b: Block): Piece[] {
    if (b.houses) return b.houses;
    const rand = rng(b.seed);
    const out: Piece[] = [];
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    const at = (x: number, y: number) => [b.e + x * c - y * s, b.n + x * s + y * c] as const;
    const tint = TINT[t.style];
    if (t.style === "greek" || t.style === "roman") {
      // courtyard houses under red tiles; in a Roman city's heart, an apartment block
      const heart = t.style === "roman" && Math.hypot(b.e, b.n) < t.radius * 0.45;
      if (heart) {
        const [e, n] = at(-10, 0);
        out.push({ kind: "insula", e, n, yaw: b.yaw, sx: 1, sy: 0.9 + rand() * 0.25, sz: 1, sink: 1.5 });
      }
      for (const [x, y] of heart ? [[13, -9], [13, 9]] : [[-12, -9], [12, -9], [-12, 9], [12, 9]]) {
        if (rand() < 0.08) continue;
        const [e, n] = at(x, y);
        // packed to the block's alleys, as a city's houses were
        const wide = heart ? 1.25 : 1.5;
        out.push({ kind: "house_roman", e, n, yaw: b.yaw + (y > 0 ? Math.PI : 0), sx: wide - rand() * 0.1, sy: 0.9 + rand() * 0.35, sz: 1.32 - rand() * 0.1, sink: 1.5 });
      }
    } else {
      const kinds = HOUSES[t.style];
      for (const [row, y] of [-11, 0, 11].entries()) {
        let x = -23;
        while (x < 21) {
          const kind = kinds[Math.floor(rand() * kinds.length)];
          const [pw, pd] = HOUSE_PLAN[kind];
          const w = 6 + rand() * 4;
          if (rand() < 0.1) {
            x += w;
            continue;
          }
          const [e, n] = at(x + w / 2, y);
          out.push({ kind, e, n, yaw: b.yaw + (row === 2 ? Math.PI : 0), sx: (w - 0.6) / pw, sy: 0.85 + rand() * 0.45, sz: (8.5 + rand()) / pd, sink: 1.2, tint: TINTED.has(kind) ? tint : undefined });
          x += w + (rand() < 0.15 ? 2.5 : 0.3);
        }
      }
    }
    b.houses = out;
    return out;
  }

  /* --------------------------------------------------------------- place */

  /** a city's instances at a scale: every piece on the land as it is drawn now */
  private build(t: TownNow, layout: Layout, scale: number, open: boolean, share: number): Placed {
    const s = this.stage;
    const out: Placed = new Map();
    const kmLng = 111.32 * Math.cos((t.at[1] * Math.PI) / 180);
    const cam = s.lngLatOf(s.camera.position);
    const camE = (cam[0] - t.at[0]) * kmLng * 1000;
    const camN = (cam[1] - t.at[1]) * 111320;
    const clearings = [...s.clearings.values()];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const put = (pc: Piece, grow = 1) => {
      const lng = t.at[0] + (pc.e * scale) / 1000 / kmLng;
      const lat = t.at[1] + (pc.n * scale) / 111320;
      if (clearings.length && clearings.some((c) => s.kmBetween(c.at, [lng, lat]) < c.km)) return;
      let metres = s.metresAt(lng, lat);
      if (pc.water) metres = Math.max(metres, 0);
      else if ((metres < 0.5 && s.isSea(lng, lat)) || s.inLake(lng, lat)) return;
      s.toWorld(lng, lat, p);
      p.y = s.yOf(metres) - (pc.sink * scale) / 1000;
      q.setFromAxisAngle(up, pc.yaw);
      sc.set(pc.sx * scale * grow, pc.sy * scale, pc.sz * scale * grow);
      m.compose(p, q, sc);
      let slot = out.get(pc.kind);
      if (!slot) out.set(pc.kind, (slot = { m: [], c: [] }));
      for (let i = 0; i < 16; i++) slot.m.push(m.elements[i]);
      const c = pc.tint ?? [1, 1, 1];
      slot.c.push(c[0], c[1], c[2]);
    };
    for (const pc of layout.pieces) put(pc);
    const blockKind = BLOCK[t.style];
    const tint = TINT[t.style];
    // far off, a share of the blocks, each larger, so the town keeps its look for fewer pieces
    const grow = Math.min(2.2, 1 / Math.sqrt(share));
    for (const b of layout.blocks) {
      const opened = open && Math.hypot(b.e - camE, b.n - camN) < OPEN_KM * 1000;
      if (!opened && b.rank > share) continue;
      // none on a mountainside (the slope as drawn now, across the block)
      const lng = t.at[0] + (b.e * scale) / 1000 / kmLng;
      const lat = t.at[1] + (b.n * scale) / 111320;
      const d = 0.00025 * scale;
      const slope = Math.hypot(s.metresAt(lng + d / Math.cos((lat * Math.PI) / 180), lat) - s.metresAt(lng - d / Math.cos((lat * Math.PI) / 180), lat), s.metresAt(lng, lat + d) - s.metresAt(lng, lat - d)) / (2 * d * 111320);
      if (slope > 0.42) continue;
      if (opened) {
        for (const h of this.houses(t, b)) put(h);
        continue;
      }
      put({ kind: blockKind, e: b.e, n: b.n, yaw: b.yaw, sx: 1, sy: 1, sz: 1, sink: 1.5, tint: blockKind === "block_stone" ? undefined : tint }, grow);
    }
    return out;
  }

  private write(cities: City[]) {
    const counts = new Map<string, number>();
    for (const city of cities) {
      for (const [kind, slot] of city.placed) {
        const mesh = this.meshes.get(kind);
        if (!mesh) continue;
        const at = counts.get(kind) ?? 0;
        const n = Math.min(slot.c.length / 3, CAPACITY[kind] - at);
        if (n <= 0) continue;
        (mesh.matrix.array as Float32Array).set(n * 16 === slot.m.length ? slot.m : slot.m.slice(0, n * 16), at * 16);
        (mesh.color.array as Float32Array).set(n * 3 === slot.c.length ? slot.c : slot.c.slice(0, n * 3), at * 3);
        counts.set(kind, at + n);
      }
    }
    for (const [kind, mesh] of this.meshes) {
      const n = counts.get(kind) ?? 0;
      mesh.matrix.needsUpdate = true;
      mesh.color.needsUpdate = true;
      for (const part of mesh.parts) part.count = n;
    }
  }

  dispose() {
    for (const mesh of this.meshes.values()) {
      for (const part of mesh.parts) {
        part.geometry.dispose();
        (part.material as THREE.Material).dispose();
      }
    }
    this.group.removeFromParent();
  }
}

/* -------------------------------------------------------------- geometry */

/**
 * how much larger than life a city is drawn, seen from `km` away: true size
 * close up; further off, large enough to read, a village more so than a
 * great city
 */
function scaleFor(km: number, reachM: number) {
  const reach = Math.max(reachM, 150) / 1000;
  const most = Math.min(8, Math.max(1, 7 / reach));
  const s = Math.min(most, Math.max(1, (km * 0.075) / reach));
  // in steps of about 5%, so a city isn't placed again on every movement
  return s < 1.03 ? 1 : Math.exp(Math.round(Math.log(s) / 0.05) * 0.05);
}

/** the share of a city's blocks drawn from `km` away */
function blockShare(km: number) {
  return Math.min(1, Math.max(0.2, (140 / km) ** 2));
}

/** the edge of a round town at an angle, metres: it wanders, as a town follows its hill */
export function townEdge(t: { name: string; radius: number }, a: number) {
  const ph = (hash(t.name) % 628) / 100;
  return t.radius * (1 + 0.12 * Math.sin(a * 3 + ph) + 0.07 * Math.sin(a * 5 + ph * 2.1));
}

/** whether a point, metres [east, north] of a town's centre, is inside its edge by `margin` */
function inside(t: TownNow, e: number, n: number, margin: number) {
  if (t.rect) {
    const turn = ((t.rect.turn ?? 0) * Math.PI) / 180;
    const x = e * Math.cos(turn) - n * Math.sin(turn);
    const y = e * Math.sin(turn) + n * Math.cos(turn);
    return Math.abs(x) <= t.rect.w / 2 - margin && Math.abs(y) <= t.rect.h / 2 - margin;
  }
  return Math.hypot(e, n) < townEdge(t, Math.atan2(n, e)) - margin;
}

/** whether a place is inside a town (for the scatter: no trees there) */
export function inTownNow(t: TownNow, lng: number, lat: number) {
  if (t.houses === false || t.radius < 40) return false;
  const kmLng = 111.32 * Math.cos((t.at[1] * Math.PI) / 180);
  return inside(t, (lng - t.at[0]) * kmLng * 1000, (lat - t.at[1]) * 111320, -8);
}

/** the wall's corners, metres round the centre (a rectangle's corners marked, for its towers) */
function wallRing(t: TownNow): [number, number][] & { corner?: Set<number> } {
  if (t.rect) {
    const turn = ((t.rect.turn ?? 0) * Math.PI) / 180;
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const { w, h } = t.rect;
    const corners: [number, number][] = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    const out: [number, number][] & { corner?: Set<number> } = [];
    out.corner = new Set();
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = corners[i];
      const [x1, y1] = corners[(i + 1) % 4];
      const count = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 20));
      out.corner.add(out.length);
      for (let k = 0; k < count; k++) {
        const x = x0 + ((x1 - x0) * k) / count;
        const y = y0 + ((y1 - y0) * k) / count;
        out.push([x * c + y * s, -x * s + y * c]);
      }
    }
    return out;
  }
  const segs = Math.max(16, Math.round((Math.PI * 2 * t.radius) / 19));
  const out: [number, number][] = [];
  for (let k = 0; k < segs; k++) {
    const a = (k / segs) * Math.PI * 2;
    const r = townEdge(t, a);
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

/** where the gates go: spread round the wall (on a rectangle, one a side and more on a long one) */
function gateSet(segs: number, count: number, rand: () => number, ring: [number, number][] & { corner?: Set<number> }) {
  const out = new Set<number>();
  if (ring.corner) {
    const starts = [...ring.corner].sort((a, b) => a - b);
    for (let i = 0; i < starts.length; i++) {
      const a = starts[i];
      const b = i + 1 < starts.length ? starts[i + 1] : segs;
      const len = b - a;
      const n = Math.max(1, Math.round(len / 45));
      for (let k = 1; k <= n; k++) out.add(a + Math.round((len * k) / (n + 1)));
    }
    return out;
  }
  const off = Math.floor(rand() * segs);
  for (let k = 0; k < count; k++) out.add((off + Math.round((k * segs) / count)) % segs);
  return out;
}

function inFoot(ft: { e: number; n: number; c: number; s: number; f: [number, number, number, number] }, e: number, n: number, margin: number) {
  // into the landmark's own frame (it was turned clockwise by its turn)
  const de = e - ft.e;
  const dn = n - ft.n;
  const x = de * ft.c - dn * ft.s;
  const y = de * ft.s + dn * ft.c;
  return x > ft.f[0] - margin && x < ft.f[2] + margin && y > ft.f[1] - margin && y < ft.f[3] + margin;
}

function toSegment(x: number, y: number, x0: number, y0: number, x1: number, y1: number) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2));
  return Math.hypot(x - x0 - dx * t, y - y0 - dy * t);
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
  return geo;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
