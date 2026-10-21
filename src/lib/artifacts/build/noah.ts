import * as THREE from "three";
import { N, type NoahStepId } from "@/data/builds/noah";
import { box, mesh, type StepFn } from "./engine";

const { L, W, decks, cutX, door } = N;
const halfW = W / 2;
const post = halfW - 0.6; // frame post centre line
const inner = post - 0.6; // inside face of the frames
const grow = { kind: "grow" } as const;
/** first transverse room wall and spacing */
const ROOM0 = -140;
const ROOM = 20;

type Beast = {
  l: number;
  h: number;
  w: number;
  leg: number;
  head: number;
  neck?: number;
  trunk?: boolean;
  hump?: boolean;
};

const BEASTS: Record<string, Beast> = {
  elephant: { l: 4, h: 2.6, w: 2.4, leg: 1.5, head: 1.5, trunk: true },
  hippo: { l: 3.4, h: 1.8, w: 2, leg: 0.7, head: 1.2 },
  ox: { l: 2.4, h: 1.3, w: 1.1, leg: 1, head: 0.7 },
  horse: { l: 2.3, h: 1.1, w: 0.8, leg: 1.4, head: 0.6, neck: 1 },
  camel: { l: 2.2, h: 1.1, w: 0.9, leg: 1.8, head: 0.55, neck: 1.3, hump: true },
  giraffe: { l: 2.2, h: 1.2, w: 0.9, leg: 2, head: 0.5, neck: 2.8 },
  sheep: { l: 1.2, h: 0.8, w: 0.8, leg: 0.5, head: 0.4 },
  lion: { l: 2, h: 1, w: 0.9, leg: 0.9, head: 0.8 },
};

/** Blocky quadruped facing +x — a hint of the creatures, not a zoo. */
function beast(mat: THREE.Material, b: Beast): THREE.Group {
  const g = new THREE.Group();
  const top = b.leg + b.h;
  g.add(box(b.l, b.h, b.w, mat, 0, b.leg + b.h / 2, 0, false));
  for (const x of [-b.l / 2 + 0.25, b.l / 2 - 0.25]) {
    for (const z of [-b.w / 2 + 0.2, b.w / 2 - 0.2]) {
      g.add(box(0.28 * Math.max(1, b.h), b.leg, 0.28 * Math.max(1, b.h), mat, x, b.leg / 2, z, false));
    }
  }
  let hx = b.l / 2 + b.head / 2;
  let hy = top - b.head / 3;
  if (b.neck) {
    const n = box(0.35, b.neck, 0.35, mat, b.l / 2 - 0.1, top + b.neck / 2 - 0.2, 0, false);
    n.rotation.z = -0.3;
    g.add(n);
    hx = b.l / 2 + 0.25 + b.head / 2;
    hy = top + b.neck - 0.3;
  }
  g.add(box(b.head, b.head * 0.8, b.head * 0.8, mat, hx, hy, 0, false));
  if (b.trunk) g.add(box(0.35, 1.5, 0.35, mat, hx + b.head / 2, hy - 0.9, 0, false));
  if (b.hump) g.add(box(0.8, 0.5, 0.6, mat, -0.1, top + 0.2, 0, false));
  return g;
}

export const NOAH_GEOMETRY: Record<NoahStepId, StepFn> = {
  keel(k) {
    for (let i = 0; i < 7; i++) {
      k.box("cedar", [3, 0.8, 30], [-135 + 45 * i, 0.4, 0]);
    }
    k.box("wood", [L, 1.2, 3], [0, 1.4, 0], { anim: { kind: "grow", axis: "x" }, hero: true });
    for (const z of [-20, -10, 0, 10, 20]) {
      k.box("wood", [L, 0.8, 9.9], [0, 2.4, z]);
    }
  },
  frames(k) {
    const h = 29 - decks[0];
    for (let i = 0; i <= 20; i++) {
      const x = -L / 2 + 15 * i;
      const f = new THREE.Group();
      for (const s of [-1, 1]) f.add(box(1, h, 1.2, k.m.wood, 0, decks[0] + h / 2, s * post));
      f.add(box(1, 0.8, W - 1.2, k.m.wood, 0, 28.6, 0));
      f.position.x = x;
      k.add(f, { anim: grow });
    }
  },
  planking(k) {
    const z = halfW + 0.3;
    for (let j = 0; j < 6; j++) {
      const y = 2 + 4.5 * j + 2.25;
      k.box("wood", [L, 4.5, 0.6], [0, y, z]);
      if (j === 0) k.box("wood", [L, 4.5, 0.6], [0, y, -z]);
      else {
        const len = cutX + L / 2;
        k.box("wood", [len, 4.5, 0.6], [-L / 2 + len / 2, y, -z]);
      }
    }
    for (const s of [-1, 1]) k.box("wood", [0.6, 27, W + 1.2], [s * (L / 2 + 0.3), 15.5, 0]);
  },
  pitch(k) {
    const z = halfW + 0.68;
    const o = { anim: grow };
    k.box("pitch", [L + 0.6, 27, 0.15], [0, 15.5, z], o);
    k.box("pitch", [L + 0.6, 4.5, 0.15], [0, 4.25, -z], o);
    const len = cutX + L / 2 + 0.3;
    k.box("pitch", [len, 22.5, 0.15], [-L / 2 - 0.3 + len / 2, 17.75, -z], o);
    for (const s of [-1, 1]) k.box("pitch", [0.15, 27, W + 1.5], [s * (L / 2 + 0.68), 15.5, 0], o);
    k.box("pitch", [L, 27, 0.1], [0, 15.5, halfW - 0.06], o);
  },
  decks(k) {
    for (const y of [decks[1], decks[2]]) {
      k.box("cedar", [L - 1.2, 0.6, 2 * inner], [0, y - 0.3, 0], {
        anim: { kind: "grow", axis: "x" },
      });
    }
  },
  rooms(k) {
    for (const y of decks) {
      for (const s of [-1, 1]) {
        k.box("wood", [280, 5, 0.4], [0, y + 2.5, s * 8]);
      }
      for (let i = 0; i < 15; i++) {
        for (const s of [-1, 1]) {
          k.box("wood", [0.4, 5, inner - 8], [ROOM0 + ROOM * i, y + 2.5, s * (8 + (inner - 8) / 2)], {
            tile: false,
          });
        }
      }
    }
  },
  roof(k) {
    const pz = halfW + 0.3;
    for (let x = -L / 2; x <= L / 2; x += 10) {
      k.box("wood", [0.6, 1, 0.6], [x, 29.5, pz], { tile: false });
      if (x <= cutX) k.box("wood", [0.6, 1, 0.6], [x, 29.5, -pz], { tile: false });
    }
    const slope = Math.atan2(2, halfW + 1);
    const len = Math.hypot(2, halfW + 1);
    const north = box(L + 2, 0.6, len, k.m.cedar, 0, 31, (halfW + 1) / 2);
    north.rotation.x = slope;
    k.add(north, { hero: true });
    const sl = cutX + L / 2 + 1;
    const south = box(sl, 0.6, len, k.m.cedar, -L / 2 - 1 + sl / 2, 31, -(halfW + 1) / 2);
    south.rotation.x = -slope;
    k.add(south);
    k.box("cedar", [L + 2, 0.6, 0.8], [0, 32.1, 0]);
    k.anchor(60, 30, -halfW);
  },
  door(k) {
    const z = -halfW - 0.85;
    const w = 8;
    const h = door.y1 - door.y0;
    k.box("pitch", [w, h, 0.3], [door.x, door.y0 + h / 2, z], { hero: true, tile: false });
    k.box("cedar", [w + 1.2, 0.6, 0.5], [door.x, door.y1 + 0.3, z]);
    for (const s of [-1, 1]) {
      k.box("cedar", [0.6, h + 0.6, 0.5], [door.x + s * (w / 2 + 0.3), door.y0 + h / 2, z]);
    }
    const run = Math.sqrt(20.2 ** 2 - door.y0 ** 2);
    const ramp = box(w, 0.6, 20.2, k.m.cedar, door.x, door.y0 / 2, z - run / 2);
    ramp.rotation.x = -Math.atan2(door.y0, run);
    k.add(ramp, { anim: { kind: "slide", from: [0, 0, -12] } });
  },
  provisions(k) {
    const geo = new THREE.CylinderGeometry(0.9, 0.9, 2, 14);
    for (let i = 0; i < 8; i++) {
      for (const z of [12, 18]) {
        const x = -10 + ROOM * i + (z === 12 ? -3 : 3);
        const b = mesh(geo, k.m.cedar, x, decks[2] + 1, z);
        k.add(b, { tally: null });
      }
    }
    for (let i = 0; i < 8; i++) {
      const sack = box(2.2, 1.2, 1.6, k.m.linen, -10 + ROOM * i, decks[1] + 0.6, 15, false);
      k.add(sack, { tally: null });
    }
  },
  animals(k) {
    const m = k.m;
    const plan: [Beast, THREE.Material][][] = [
      [
        [BEASTS.elephant, m.hideGrey],
        [BEASTS.hippo, m.hideBrown],
        [BEASTS.ox, m.hideBrown],
        [BEASTS.elephant, m.hideGrey],
      ],
      [
        [BEASTS.camel, m.hideTan],
        [BEASTS.horse, m.hideBrown],
        [BEASTS.ox, m.hideWhite],
        [BEASTS.lion, m.hideTan],
      ],
      [
        [BEASTS.giraffe, m.hideTan],
        [BEASTS.sheep, m.hideWhite],
        [BEASTS.lion, m.hideTan],
        [BEASTS.sheep, m.hideWhite],
      ],
    ];
    decks.forEach((y, d) => {
      for (let i = 0; i < 8; i++) {
        const [b, mat] = plan[d][i % 4];
        const pair = new THREE.Group();
        for (const [dz, face] of [
          [-12.5, 1],
          [-19.5, -1],
        ] as const) {
          const a = beast(mat, b);
          a.position.set(face * 0.6, 0, dz);
          a.rotation.y = face > 0 ? 0 : Math.PI;
          pair.add(a);
        }
        pair.position.set(-10 + ROOM * i, y, 0);
        k.add(pair, { anim: { kind: "pop" }, hero: d === 0 && i === 0 });
      }
    });
  },
  flood(k) {
    const R = L * 12;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, R, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    const hx = L / 2 + 1;
    const hz2 = halfW + 1.1;
    hole.moveTo(-hx, -hz2);
    hole.lineTo(-hx, hz2);
    hole.lineTo(hx, hz2);
    hole.lineTo(hx, -hz2);
    hole.lineTo(-hx, -hz2);
    shape.holes.push(hole);
    const sea = new THREE.MeshStandardMaterial({
      color: 0x2c4650,
      roughness: 0.3,
      metalness: 0.05,
      envMapIntensity: 0.25,
    });
    const water = mesh(new THREE.ShapeGeometry(shape, 64), sea, 0, N.water, 0);
    water.rotation.x = -Math.PI / 2;
    water.castShadow = false;
    k.add(water, {
      anim: { kind: "slide", from: [0, -N.water - 1, 0] },
      tally: null,
      frame: false,
    });
    k.anchor(0, N.water + 1, -halfW - 14);
  },
};
