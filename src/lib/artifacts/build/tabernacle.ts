import * as THREE from "three";
import { COURT_PILLARS, TB, type TabernacleStepId } from "@/data/builds/tabernacle";
import type { MatKey } from "@/lib/artifacts/materials";
import { arkModel } from "./ark";
import { box, cyl, mesh, type Kit, type StepFn } from "./engine";
import {
  bronzeAltar,
  fire,
  glow,
  incenseAltar,
  lampstand,
  showbreadTable,
} from "./parts";

const { court, tent, veilX, bt, sock, boardH } = TB;
const tz = tent.z;
const top = sock + boardH; // 10.75
/** south boards are drawn as stubs — the section cut */
const STUB = 2.5;
const VEIL_Z = [-3.75, -1.25, 1.25, 3.75];
const DOOR_Z = [-4, -2, 0, 2, 4];
const WEST_N = 8;
const westW = (2 * (tz + bt)) / WEST_N;

type Board = { x: number; z: number; along: "x" | "z"; w: number; h: number };

function boards(): Board[] {
  const out: Board[] = [];
  for (let i = 0; i < 20; i++) {
    const x = tent.x0 + 1.5 * i + 0.75;
    out.push({ x, z: tz + bt / 2, along: "x", w: 1.5, h: boardH });
    out.push({ x, z: -tz - bt / 2, along: "x", w: 1.5, h: STUB });
  }
  for (let i = 0; i < WEST_N; i++) {
    out.push({
      x: tent.x1 + bt / 2,
      z: -tz - bt + westW * (i + 0.5),
      along: "z",
      w: westW,
      h: boardH,
    });
  }
  return out;
}

/** One fabric layer: north half of the roof, the north side, the west end. */
function layer(k: Kit, key: MatKey, o: number, bottom: number) {
  const x1 = tent.x1 + bt + o;
  const len = x1 - tent.x0 + 0.1;
  const cx = tent.x0 - 0.1 + len / 2;
  const zEdge = tz + bt + o;
  const y = top + o;
  const h = y - bottom;
  const drop = { anim: { kind: "drop", h: 6 } } as const;
  k.box(key, [len, 0.06, zEdge], [cx, y, zEdge / 2], { ...drop, hero: true });
  k.box(key, [len, h, 0.06], [cx, bottom + h / 2, zEdge], drop);
  k.box(key, [0.06, h, 2 * zEdge], [x1, bottom + h / 2, 0], drop);
}

export const TABERNACLE_GEOMETRY: Record<TabernacleStepId, StepFn> = {
  sockets(k) {
    const geo = new THREE.BoxGeometry(0.7, sock, 0.7);
    const place = (x: number, z: number) =>
      k.add(mesh(geo, k.m.silver, x, sock / 2, z), { anim: { kind: "drop", h: 3 } });
    for (const b of boards()) {
      for (const s of [-1, 1]) {
        const d = (s * b.w) / 4;
        if (b.along === "x") place(b.x + d, b.z);
        else place(b.x, b.z + d);
      }
    }
    for (const z of VEIL_Z) place(veilX, z);
    k.anchor(tent.x1, 1, -tz);
  },
  boards(k) {
    for (const b of boards()) {
      const size = b.along === "x" ? [b.w - 0.04, b.h, bt] : [bt, b.h, b.w - 0.04];
      k.box("gold", size as [number, number, number], [b.x, sock + b.h / 2, b.z], {
        tally: "acacia",
        tile: false,
        hero: b.z > 0 && b.x > 24 && b.x < 26,
      });
    }
  },
  bars(k) {
    const geo = (len: number) => new THREE.CylinderGeometry(0.12, 0.12, len, 10);
    const xBar = (x0: number, x1: number, y: number, z: number) => {
      const b = mesh(geo(x1 - x0), k.m.gold, (x0 + x1) / 2, y, z);
      b.rotation.z = Math.PI / 2;
      k.add(b, { anim: { kind: "slide", from: [-14, 0, 0] } });
    };
    const zBar = (z0: number, z1: number, y: number) => {
      const b = mesh(geo(z1 - z0), k.m.gold, tent.x1 + bt + 0.15, y, (z0 + z1) / 2);
      b.rotation.x = Math.PI / 2;
      k.add(b, { anim: { kind: "slide", from: [0, 0, 8] } });
    };
    const zN = tz + bt + 0.15;
    const xm = (tent.x0 + tent.x1 + bt) / 2;
    const xEnd = tent.x1 + bt;
    xBar(tent.x0, xEnd, 5.75, zN);
    for (const y of [9.75, 1.75]) {
      xBar(tent.x0, xm, y, zN);
      xBar(xm, xEnd, y, zN);
    }
    xBar(tent.x0, xm, 1.75, -zN);
    xBar(xm, xEnd, 1.75, -zN);
    const ze = tz + bt;
    zBar(-ze, ze, 5.75);
    for (const y of [9.75, 1.75]) {
      zBar(-ze, 0, y);
      zBar(0, ze, y);
    }
  },
  pillars(k) {
    for (const z of VEIL_Z) {
      k.add(cyl(0.25, 0.25, boardH, k.m.gold, veilX, sock + boardH / 2, z, 16, false), {
        tally: "acacia",
      });
    }
    for (const z of DOOR_Z) {
      const g = new THREE.Group();
      g.add(box(0.7, sock, 0.7, k.m.bronze, 0, sock / 2, 0, false));
      g.add(cyl(0.25, 0.25, boardH, k.m.gold, 0, sock + boardH / 2, 0, 16, false));
      g.position.set(tent.x0, 0, z);
      k.add(g, { tally: "acacia" });
    }
  },
  linen(k) {
    layer(k, "veil", 0.15, top - 9);
    const zEdge = tz + bt + 0.15;
    const geo = new THREE.SphereGeometry(0.1, 8, 6);
    for (let i = 0; i < 25; i++) {
      const p =
        i < 7
          ? new THREE.Vector3(veilX, top + 0.25, (zEdge * (i + 0.5)) / 7)
          : new THREE.Vector3(veilX, top + 0.15 - ((i - 7) / 18) * 8.6, zEdge + 0.08);
      k.add(mesh(geo, k.m.gold, p.x, p.y, p.z), { anim: { kind: "pop" } });
    }
  },
  goathair(k) {
    layer(k, "goatHair", 0.35, 0.4);
  },
  coverings(k) {
    layer(k, "ramSkin", 0.55, 0.3);
    layer(k, "tachash", 0.75, 0.2);
  },
  ark(k) {
    const a = arkModel(k.m);
    a.position.set(35, 0, 0);
    k.add(a, { anim: { kind: "slide", from: [-18, 0, 0] }, hero: true });
    k.box("veil", [0.08, boardH, 2 * tz], [veilX, sock + boardH / 2, 0], {
      anim: { kind: "grow" },
    });
  },
  table(k) {
    const t = showbreadTable(k.m);
    t.position.set(20, 0, 2.5);
    k.add(t, { anim: { kind: "pop" } });
  },
  lampstand(k) {
    const l = lampstand(k.m, 3);
    const halo = glow(0xffb050, 2.6, 0.6);
    halo.position.y = 3.2;
    l.add(halo);
    l.position.set(20, 0, -2.5);
    k.add(l, { anim: { kind: "pop" } });
    k.light(new THREE.PointLight(0xffb45a, 40, 24, 2), [20, 3.6, -2.5]);
  },
  incense(k) {
    const a = incenseAltar(k.m);
    a.position.set(28, 0, 0);
    k.add(a, { anim: { kind: "pop" } });
    const smoke = glow(0xf4efe6, 1.8, 0.45, false);
    smoke.position.set(28, 2.9, 0);
    k.add(smoke, { anim: { kind: "fade" }, tally: null });
  },
  door(k) {
    k.box("screen", [0.08, boardH, 2 * tz], [tent.x0 - 0.3, sock + boardH / 2, 0], {
      anim: { kind: "grow" },
    });
  },
  altar(k) {
    const a = bronzeAltar(k.m);
    a.position.set(TB.altarX, 0, 0);
    k.add(a);
    const f = fire(k.m, 3.4, 3.4, 0.8);
    f.position.set(TB.altarX, 1.6, 0);
    k.add(f, { anim: { kind: "pop" }, tally: null });
    k.light(new THREE.PointLight(0xff8a3a, 45, 30, 2), [TB.altarX, 4.5, 0]);
  },
  laver(k) {
    const g = new THREE.Group();
    g.add(cyl(0.35, 0.8, 1.3, k.m.bronze, 0, 0.65, 0, 20, false));
    const pts = [
      [0, 0],
      [0.8, 0.05],
      [1.15, 0.35],
      [1.3, 0.8],
      [1.2, 0.82],
      [1.05, 0.4],
      [0.7, 0.14],
      [0, 0.12],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(mesh(new THREE.LatheGeometry(pts, 32), k.m.bronze, 0, 1.3, 0));
    g.add(cyl(1.12, 1.12, 0.05, k.m.water, 0, 1.95, 0, 32, false));
    g.position.set(TB.laverX, 0, 0);
    k.add(g, { anim: { kind: "drop", h: 5 } });
  },
  court(k) {
    const sockGeo = new THREE.BoxGeometry(0.7, 0.6, 0.7);
    const shaftGeo = new THREE.CylinderGeometry(0.18, 0.18, 4.6, 10);
    const capGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.3, 10);
    for (const [x, z] of COURT_PILLARS) {
      const g = new THREE.Group();
      g.add(mesh(sockGeo, k.m.bronze, 0, 0.3, 0));
      g.add(mesh(shaftGeo, k.m.acacia, 0, 2.9, 0));
      g.add(mesh(capGeo, k.m.silver, 0, 5.3, 0));
      g.position.set(x, 0, z);
      k.add(g, { anim: { kind: "drop", h: 4 } });
    }
    const len = court.x1 - court.x0;
    const y = 2.7;
    const h = 4.8;
    const hang = { anim: { kind: "grow" } } as const;
    k.box("linen", [len, h, 0.06], [0, y, -court.z], hang);
    k.box("linen", [len, h, 0.06], [0, y, court.z], { ...hang, hero: true });
    k.box("linen", [0.06, h, 2 * court.z], [court.x1, y, 0], hang);
    const e = court.z - court.gate;
    for (const s of [-1, 1]) {
      k.box("linen", [0.06, h, e], [court.x0, y, s * (court.gate + e / 2)], hang);
    }
  },
  gate(k) {
    k.box("screen", [0.06, 4.8, 2 * court.gate], [court.x0 - 0.25, 2.7, 0], {
      anim: { kind: "grow" },
    });
  },
  cloud(k) {
    const g = new THREE.Group();
    for (let i = 0; i < 26; i++) {
      const s = glow(i % 3 ? 0xeeeae2 : 0xd6d0c4, 9 + ((i * 5) % 7), 0.62, false);
      const col = i > 15;
      s.position.set(
        col ? 24 + ((i * 3) % 6) - 3 : 12 + ((i * 11) % 28),
        col ? 18 + (i - 15) * 3.2 : 13 + ((i * 7) % 6),
        col ? ((i * 5) % 6) - 3 : -5 + ((i * 3) % 10),
      );
      g.add(s);
    }
    const inner = glow(0xffe7a8, 12, 0.7);
    inner.position.set(28, 6, 0);
    g.add(inner);
    k.add(g, { anim: { kind: "fade" }, tally: null, frame: false });
    k.light(new THREE.PointLight(0xfff0d0, 120, 50, 2), [26, 8, 0]);
    k.anchor(25, 30, 0);
  },
};
