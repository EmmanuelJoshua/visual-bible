import * as THREE from "three";
import type { ArtifactMats, MatKey } from "@/lib/artifacts/materials";
import { tileMaterial } from "@/lib/artifacts/materials";

/**
 * Step-tagged assembly. Each build step is a function that places parts
 * through a Kit; the assembler records which step every part belongs to so
 * the stage can drop them in one step at a time, and the static view can
 * simply show them all.
 */

export type V3 = readonly [number, number, number];

export type Anim =
  | { kind: "drop"; h?: number }
  | { kind: "slide"; from: V3 }
  | { kind: "grow"; axis?: "x" | "y" | "z" }
  | { kind: "pop" }
  | { kind: "fade" };

export type PartOpts = {
  anim?: Anim;
  /** the part the step's floating label pins to (default: the first) */
  hero?: boolean;
  /** material family to tally; null to leave out of the counters */
  tally?: MatKey | null;
  rot?: V3;
  /** clone + tile textures to cubit size (default: when the part is > 2 cubits) */
  tile?: boolean;
  /** leave out of camera framing — e.g. the flood's horizon-wide water */
  frame?: boolean;
};

export type StepFn = (k: Kit) => void;

export type Part = {
  obj: THREE.Object3D;
  step: number;
  order: number;
  anim: Anim;
  homePos: THREE.Vector3;
  homeScale: THREE.Vector3;
  box: THREE.Box3;
  lights: { light: THREE.Light; base: number }[];
  fades: { mat: THREE.Material; base: number }[];
  tally: MatKey | null;
  frame: boolean;
  t: number;
  start: number;
  delay: number;
  dur: number;
};

export type StepMeta = {
  parts: number;
  anchor: THREE.Vector3;
  focus: THREE.Box3;
  tally: Partial<Record<string, number>>;
};

export type Assembled = {
  root: THREE.Group;
  parts: Part[];
  steps: StepMeta[];
  bounds: THREE.Box3;
  span: number;
};

/** Material families shown in the counters. */
export const TALLY_FAMILY: Partial<Record<MatKey, string>> = {
  gold: "Gold",
  goldDark: "Gold",
  silver: "Silver",
  bronze: "Bronze",
  cedar: "Cedar",
  acacia: "Acacia",
  olive: "Olive wood",
  fir: "Fir",
  wood: "Gopher wood",
  pitch: "Pitch",
  stone: "Stone",
  stoneDark: "Stone",
  floor: "Stone",
  linen: "Linen",
  veil: "Linen",
  screen: "Linen",
  scarlet: "Linen",
  goatHair: "Goat hair",
  ramSkin: "Skins",
  tachash: "Skins",
  hideTan: "Creatures",
  hideGrey: "Creatures",
  hideBrown: "Creatures",
  hideWhite: "Creatures",
};

export function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.src = mat;
  return m;
}

/** Box with cubit-tiled textures for anything bigger than a hand-piece. */
export function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  tile = Math.max(w, h, d) > 2,
) {
  const m = mesh(
    new THREE.BoxGeometry(w, h, d),
    tile ? tileMaterial(mat, Math.max(w, h) / 2.2, Math.max(d, h) / 2.2) : mat,
    x,
    y,
    z,
  );
  m.userData.src = mat;
  return m;
}

export function cyl(
  rTop: number,
  rBot: number,
  h: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  segs = 24,
  tile = Math.max(rTop, rBot, h) > 2,
) {
  const m = mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, segs),
    tile
      ? tileMaterial(mat, (Math.PI * (rTop + rBot)) / 2.2, h / 2.2)
      : mat,
    x,
    y,
    z,
  );
  m.userData.src = mat;
  return m;
}

export class Kit {
  readonly placed: { obj: THREE.Object3D; opts: PartOpts }[] = [];
  readonly lights: { light: THREE.Light; partIndex: number }[] = [];
  anchorAt: THREE.Vector3 | null = null;

  constructor(readonly m: ArtifactMats) {}

  /** Place any object (mesh or sub-assembly group) as one part. */
  add(obj: THREE.Object3D, opts: PartOpts = {}) {
    if (opts.rot) obj.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
    this.placed.push({ obj, opts });
    return obj;
  }

  box(key: MatKey, size: V3, pos: V3, opts: PartOpts = {}) {
    const [w, h, d] = size;
    const tile = opts.tile ?? Math.max(w, h, d) > 2;
    return this.add(
      box(w, h, d, this.m[key], pos[0], pos[1], pos[2], tile),
      opts,
    );
  }

  cyl(
    key: MatKey,
    r: readonly [number, number],
    h: number,
    pos: V3,
    opts: PartOpts & { segs?: number } = {},
  ) {
    const tile = opts.tile ?? Math.max(r[0], r[1], h) > 2;
    return this.add(
      cyl(r[0], r[1], h, this.m[key], pos[0], pos[1], pos[2], opts.segs ?? 24, tile),
      opts,
    );
  }

  /** A light that brightens with the most recently placed part. */
  light(light: THREE.Light, at: V3) {
    light.position.set(at[0], at[1], at[2]);
    this.lights.push({ light, partIndex: this.placed.length - 1 });
    return light;
  }

  anchor(x: number, y: number, z: number) {
    this.anchorAt = new THREE.Vector3(x, y, z);
  }
}

function srcKey(
  obj: THREE.Object3D,
  reverse: Map<THREE.Material, MatKey>,
): MatKey | null {
  let found: MatKey | null = null;
  obj.traverse((o) => {
    if (found || !(o instanceof THREE.Mesh)) return;
    const src = (o.userData.src as THREE.Material | undefined) ?? o.material;
    found = reverse.get(src as THREE.Material) ?? null;
  });
  return found;
}

function collectFades(obj: THREE.Object3D) {
  const out: { mat: THREE.Material; base: number }[] = [];
  obj.traverse((o) => {
    const mat = (o as THREE.Mesh | THREE.Sprite).material as
      | THREE.Material
      | undefined;
    if (mat && mat.transparent) out.push({ mat, base: mat.opacity });
  });
  return out;
}

export function assemble(
  stepIds: readonly string[],
  geo: Record<string, StepFn>,
  m: ArtifactMats,
): Assembled {
  const root = new THREE.Group();
  const reverse = new Map<THREE.Material, MatKey>();
  for (const [k, v] of Object.entries(m)) reverse.set(v, k as MatKey);

  const parts: Part[] = [];
  const kits: Kit[] = [];
  stepIds.forEach((id, step) => {
    const fn = geo[id];
    if (!fn) throw new Error(`no geometry for build step "${id}"`);
    const kit = new Kit(m);
    fn(kit);
    kits.push(kit);
    kit.placed.forEach(({ obj, opts }, order) => {
      root.add(obj);
      parts.push({
        obj,
        step,
        order,
        anim: opts.anim ?? { kind: "drop" },
        homePos: obj.position.clone(),
        homeScale: obj.scale.clone(),
        box: new THREE.Box3(),
        lights: [],
        fades: collectFades(obj),
        tally: opts.tally === undefined ? srcKey(obj, reverse) : opts.tally,
        frame: opts.frame ?? true,
        t: 1,
        start: -1,
        delay: 0,
        dur: 0.75,
      });
    });
  });

  root.updateMatrixWorld(true);
  for (const p of parts) p.box.setFromObject(p.obj);
  const bounds = new THREE.Box3();
  for (const p of parts) if (p.frame) bounds.union(p.box);
  const size = bounds.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z);

  // lights live on the root so toggling a part never changes the light count
  let offset = 0;
  kits.forEach((kit) => {
    for (const { light, partIndex } of kit.lights) {
      root.add(light);
      const p = parts[offset + Math.max(0, partIndex)];
      p.lights.push({ light, base: light.intensity });
    }
    offset += kit.placed.length;
  });

  const steps: StepMeta[] = [];
  offset = 0;
  kits.forEach((kit) => {
    const mine = parts.slice(offset, offset + kit.placed.length);
    offset += kit.placed.length;
    const focus = new THREE.Box3();
    for (const p of mine) if (p.frame) focus.union(p.box);
    const heroIdx = kit.placed.findIndex((x) => x.opts.hero);
    const hero = mine[heroIdx >= 0 ? heroIdx : 0];
    let anchor = kit.anchorAt;
    if (!anchor && hero) {
      const c = hero.box.getCenter(new THREE.Vector3());
      anchor = new THREE.Vector3(c.x, hero.box.max.y, c.z);
    }
    const tally: Partial<Record<string, number>> = {};
    for (const p of mine) {
      const fam = p.tally ? TALLY_FAMILY[p.tally] : undefined;
      if (fam) tally[fam] = (tally[fam] ?? 0) + 1;
    }
    const n = mine.length;
    const gap = Math.min(0.09, 1.3 / Math.max(1, n));
    for (const p of mine) {
      p.delay = p.order * gap;
      p.dur = p.anim.kind === "grow" ? 0.95 : p.anim.kind === "fade" ? 1.4 : 0.75;
    }
    steps.push({
      parts: n,
      anchor: anchor ?? focus.getCenter(new THREE.Vector3()),
      focus,
      tally,
    });
  });

  return { root, parts, steps, bounds, span };
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function apply(p: Part, t: number, span: number) {
  p.t = t;
  const o = p.obj;
  const shown = t > 0;
  o.visible = shown;
  for (const l of p.lights) l.light.intensity = l.base * t;
  for (const f of p.fades) f.mat.opacity = f.base * (p.anim.kind === "fade" ? t : 1);
  o.position.copy(p.homePos);
  o.scale.copy(p.homeScale);
  if (!shown || t >= 1) return;

  switch (p.anim.kind) {
    case "drop": {
      const e = easeOutCubic(t);
      const h = p.anim.h ?? span * 0.07 + (p.box.max.y - p.box.min.y) * 0.4;
      o.position.y += (1 - e) * h;
      break;
    }
    case "slide": {
      const e = easeOutCubic(t);
      const [dx, dy, dz] = p.anim.from;
      o.position.x += (1 - e) * dx;
      o.position.y += (1 - e) * dy;
      o.position.z += (1 - e) * dz;
      break;
    }
    case "grow": {
      const e = Math.max(0.002, easeOutCubic(t));
      const axis = p.anim.axis ?? "y";
      const min = p.box.min[axis];
      o.position[axis] = min + e * (p.homePos[axis] - min);
      o.scale[axis] = p.homeScale[axis] * e;
      break;
    }
    case "pop": {
      const e = Math.max(0.002, easeOutBack(t));
      o.scale.multiplyScalar(e);
      break;
    }
    case "fade":
      break;
  }
}

/** Jump to `step`. Earlier steps snap in, the current step animates, later ones hide. */
export function showStep(
  a: Assembled,
  step: number,
  now: number,
  animate: boolean,
) {
  for (const p of a.parts) {
    if (p.step < step || (p.step === step && !animate)) {
      p.start = -1;
      apply(p, 1, a.span);
    } else if (p.step === step) {
      p.start = now;
      apply(p, 0, a.span);
    } else {
      p.start = -1;
      apply(p, 0, a.span);
    }
  }
}

/** Advance running animations; returns true while anything is moving. */
export function tickParts(a: Assembled, now: number): boolean {
  let busy = false;
  for (const p of a.parts) {
    if (p.start < 0) continue;
    const t = (now - p.start) / 1000 - p.delay;
    if (t <= 0) {
      busy = true;
      continue;
    }
    const k = Math.min(1, t / p.dur);
    apply(p, k, a.span);
    if (k >= 1) p.start = -1;
    else busy = true;
  }
  return busy;
}

export function showAll(a: Assembled) {
  for (const p of a.parts) apply(p, 1, a.span);
}
