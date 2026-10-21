import * as THREE from "three";
import { T, type TempleStepId } from "@/data/builds/temple";
import type { ArtifactMats } from "@/lib/artifacts/materials";
import { arkModel } from "./ark";
import { box, cyl, mesh, type StepFn } from "./engine";
import { fire, glow, incenseAltar, lampstand, ox, showbreadTable } from "./parts";

const { F, t, house, porch, court, sea, altar } = T;
const hz = house.z;
const H = house.h;
const grow = { kind: "grow" } as const;

/** Ten-cubit olive-wood cherub overlaid with gold, wings along z (1 Kings 6:23–27). */
function templeCherub(m: ArtifactMats, cz: number): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.8, 1.3, 7.5, m.gold, 0, 3.75, 0, 20));
  g.add(mesh(new THREE.SphereGeometry(0.8, 20, 14), m.gold, -0.3, 9.2, 0));
  for (const s of [-1, 1]) {
    const wing = box(0.5, 1.4, 5, m.goldDark, 0.2, 8.3, s * 2.5);
    wing.rotation.x = s * -0.05;
    g.add(wing);
  }
  g.position.set(20, F + 0.32, cz);
  return g;
}

/** Bronze pillar with capital, network and two rows of pomegranates (1 Kings 7:15–22). */
function pillar(m: ArtifactMats, z: number): THREE.Group {
  const g = new THREE.Group();
  const r = 12 / (2 * Math.PI);
  g.add(cyl(r, r, 18, m.bronze, 0, 9, 0, 32));
  g.add(cyl(2.35, r, 1.6, m.bronze, 0, 18.8, 0, 32));
  g.add(cyl(2.9, 2.1, 3, m.goldDark, 0, 21.5, 0, 32));
  const pom = new THREE.SphereGeometry(0.3, 10, 8);
  for (const [y, off] of [
    [18.6, 0],
    [19.5, 0.5],
  ] as const) {
    for (let i = 0; i < 24; i++) {
      const a = ((i + off) / 24) * Math.PI * 2;
      g.add(mesh(pom, m.bronze, Math.cos(a) * 2.35, y, Math.sin(a) * 2.35));
    }
  }
  g.position.set(T.pillarX, F, z);
  return g;
}

function laverCart(m: ArtifactMats, bowl: THREE.BufferGeometry): THREE.Group {
  const g = new THREE.Group();
  g.add(box(4, 3, 4, m.bronze, 0, 2.1, 0));
  g.add(box(4.2, 0.25, 4.2, m.goldDark, 0, 3.6, 0, false));
  const wheel = new THREE.CylinderGeometry(0.75, 0.75, 0.25, 20);
  for (const x of [-1.4, 1.4]) {
    for (const z of [-2.15, 2.15]) {
      const w = mesh(wheel, m.bronze, x, 0.75, z);
      w.rotation.x = Math.PI / 2;
      g.add(w);
    }
  }
  g.add(cyl(0.7, 0.9, 0.6, m.bronze, 0, 3.95, 0, 16, false));
  g.add(mesh(bowl, m.bronze, 0, 4.2, 0));
  return g;
}

const v2 = (pts: [number, number][]) => pts.map(([x, y]) => new THREE.Vector2(x, y));

/**
 * What a step needs beyond its solid parts — fire, light — kept in code when
 * the parts come from the Blender model.
 */
const LAMP_XS = [-24, -18, -12, -6, 0];

export const TEMPLE_FX: Partial<Record<TempleStepId, StepFn>> = {
  furnishings(k) {
    for (const x of LAMP_XS) {
      for (const z of [-7, 7]) {
        const halo = glow(0xffb050, 2.6, 0.55);
        halo.position.set(x, F + 3.4, z);
        k.add(halo, { anim: { kind: "fade" }, tally: null, frame: false });
      }
    }
    for (const z of [-7, 7]) k.light(new THREE.PointLight(0xffb45a, 140, 45, 2), [-12, F + 6, z * 0.8]);
  },
  altar(k) {
    const { x, z } = altar;
    const f = fire(k.m, 14, 14, 2.2);
    f.position.set(x, 10.1, z);
    k.add(f, { anim: { kind: "pop" }, tally: null });
    k.light(new THREE.PointLight(0xff8a3a, 260, 70, 2), [x, 14, z]);
  },
};

export const TEMPLE_GEOMETRY: Record<TempleStepId, StepFn> = {
  foundation(k) {
    const x0 = -49;
    const z0 = -22;
    const bx = 13;
    const bz = 22;
    for (let course = 0; course < 2; course++) {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 2; j++) {
          k.box(
            course ? "stone" : "stoneDark",
            [bx - 0.15, 0.98, bz - 0.15],
            [x0 + bx * i + bx / 2, course + 0.5, z0 + bz * j + bz / 2],
          );
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const h = F - 0.5 * i;
      k.box("stone", [1.5, h, 16], [x0 - 1.5 * i - 0.75, h / 2, 0]);
    }
    k.anchor(-3, F, 0);
  },
  walls(k) {
    const y = F + H / 2;
    const o = { anim: grow };
    k.box("stone", [63, H, t], [0, y, hz + t / 2], o);
    k.box("stone", [t, H, 2 * hz], [house.x1 + t / 2, y, 0], o);
    k.box("stone", [63, 3, t], [0, F + 1.5, -hz - t / 2], o);
    for (const s of [-1, 1]) {
      k.box("stone", [t, H, 5], [house.x0 - t / 2, y, s * 7.5], o);
    }
    k.box("stone", [t, 15, 10], [house.x0 - t / 2, F + 22.5, 0]);
  },
  porch(k) {
    const len = porch.x1 - porch.x0 + t;
    const cx = (porch.x0 - t + porch.x1) / 2;
    k.box("stone", [len, H, t], [cx, F + H / 2, hz + t / 2], { anim: grow });
    k.box("stone", [len, 3, t], [cx, F + 1.5, -hz - t / 2], { anim: grow });
    for (const s of [-1, 1]) {
      k.box("stone", [t, H, 5.5], [porch.x0 - t / 2, F + H / 2, s * 8.75], { anim: grow });
    }
    k.box("stone", [t, 10, 12], [porch.x0 - t / 2, F + 25, 0], { hero: true });
    k.box("cedar", [len, 0.8, hz + t], [cx, F + H + 0.4, (hz + t) / 2]);
  },
  chambers(k) {
    const d = 8;
    for (let s = 0; s < 3; s++) {
      const y = F + 5 * s + 2.5;
      k.box("stoneDark", [63, 5, d], [0, y, hz + t + d / 2]);
      k.box("stoneDark", [d, 5, 2 * (hz + t) + d], [house.x1 + t + d / 2, y, d / 2]);
      k.box("cedar", [63.2, 0.4, d + 0.2], [0, y + 2.7, hz + t + d / 2]);
      k.box("cedar", [d + 0.2, 0.4, 2 * (hz + t) + d + 0.2], [house.x1 + t + d / 2, y + 2.7, d / 2]);
    }
  },
  cedar(k) {
    k.box("fir", [60, 0.2, 2 * hz], [0, F + 0.1, 0], { anim: { kind: "grow", axis: "x" } });
    k.box("cedar", [60, H, 0.25], [0, F + H / 2, hz - 0.125], { anim: grow, hero: true });
    for (const s of [-1, 1]) {
      k.box("cedar", [0.25, H, 5], [house.x0 + 0.125, F + H / 2, s * 7.5], { anim: grow });
    }
    for (let i = 0; i < 16; i++) {
      k.box("cedar", [0.8, 1, 2 * (hz + t)], [house.x0 + 4 * i, F + H + 0.5, 0]);
    }
    k.box("cedar", [63, 0.4, hz + t], [0, F + H + 1.2, (hz + t) / 2]);
  },
  debir(k) {
    const x = T.debirX;
    k.box("cedar", [1, H, 7.5], [x, F + H / 2, 6.25], { anim: grow });
    k.box("cedar", [1, H, 7.5], [x, F + H / 2, -6.25], { anim: grow });
    k.box("cedar", [1, H - 8, 5], [x, F + 8 + (H - 8) / 2, 0]);
    const dx = (house.x1 + x + 0.5) / 2;
    const dl = house.x1 - x - 0.5;
    k.box("gold", [dl, 0.12, 2 * hz], [dx, F + 0.26, 0], { anim: { kind: "grow", axis: "x" } });
    k.box("gold", [dl, 20, 0.15], [dx, F + 10, hz - 0.33], { anim: grow });
    k.box("gold", [0.15, 20, 2 * hz], [house.x1 - 0.08, F + 10, 0], { anim: grow });
    k.box("gold", [dl, 0.3, hz], [dx, F + 20.15, hz / 2]);
    for (const y of [F + 8.6, F + 9.2]) {
      k.box("gold", [0.12, 0.12, 2 * hz], [x - 0.7, y, 0], { tile: false });
    }
    k.anchor(dx, F + 20.4, 0);
  },
  cherubim(k) {
    k.add(templeCherub(k.m, 5), { anim: grow });
    k.add(templeCherub(k.m, -5), { anim: grow });
  },
  veil(k) {
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      const leaf = box(0.2, 8, 2.5, k.m.olive, 0, 0, -s * 1.25);
      hinge.add(leaf);
      hinge.add(box(0.05, 7.6, 2.3, k.m.goldDark, -0.13, 0, -s * 1.25, false));
      hinge.position.set(T.debirX - 0.6, F + 4, s * 2.5);
      hinge.rotation.y = s * 1.0;
      k.add(hinge, { anim: { kind: "pop" } });
    }
    k.box("veil", [0.08, 20, 2 * hz], [T.debirX + 0.9, F + 10, 0], {
      anim: grow,
      hero: true,
      tile: false,
    });
  },
  court(k) {
    const len = court.x1 - court.x0;
    const cx = (court.x0 + court.x1) / 2;
    k.box("floor", [len, 0.1, 2 * court.z], [cx, 0.05, 0], { anim: { kind: "grow", axis: "x" } });
    const eastLen = court.z + 2 - court.gate;
    for (let row = 0; row < 4; row++) {
      const cedar = row === 3;
      const h = cedar ? 0.6 : 1;
      const y = row + h / 2;
      const key = cedar ? "cedar" : row % 2 ? "stone" : "stoneDark";
      k.box(key, [len + 4, h, 2], [cx, y, court.z + 1]);
      k.box(key, [len + 4, h, 2], [cx, y, -court.z - 1]);
      k.box(key, [2, h, 2 * court.z], [court.x1 + 1, y, 0]);
      for (const s of [-1, 1]) {
        k.box(key, [2, h, eastLen], [court.x0 - 1, y, s * (court.gate + eastLen / 2)]);
      }
    }
    k.anchor(court.x0 - 1, 4, -court.gate - 4);
  },
  jachin(k) {
    k.add(pillar(k.m, -6), { anim: grow });
  },
  boaz(k) {
    k.add(pillar(k.m, 6), { anim: grow });
  },
  sea(k) {
    const dirs: [number, number][] = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    for (const [dx, dz] of dirs) {
      for (const off of [-2.6, 0, 2.6]) {
        const o = ox(k.m);
        o.position.set(sea.x + dx * 3 + dz * off, 0.1, sea.z + dz * 3 + dx * off);
        o.rotation.y = Math.atan2(-dz, dx);
        k.add(o, { anim: { kind: "drop", h: 6 } });
      }
    }
    const basin = new THREE.Group();
    const profile = v2([
      [0, 0],
      [3.4, 0],
      [4.3, 0.6],
      [4.8, 1.8],
      [5.0, 3.4],
      [5.05, 4.6],
      [5.5, 5.0],
      [5.3, 5.06],
      [4.8, 4.6],
      [4.7, 3.4],
      [4.4, 1.8],
      [3.3, 0.6],
      [0, 0.45],
    ]);
    basin.add(mesh(new THREE.LatheGeometry(profile, 64), k.m.bronze));
    basin.add(cyl(4.6, 4.6, 0.1, k.m.water, 0, 4.25, 0, 48, false));
    basin.position.set(sea.x, 2.2, sea.z);
    k.add(basin, { anim: { kind: "drop", h: 10 }, hero: true });
  },
  lavers(k) {
    const bowl = new THREE.LatheGeometry(
      v2([
        [0, 0],
        [1.2, 0.05],
        [1.85, 0.5],
        [2.05, 1.3],
        [1.95, 1.32],
        [1.75, 0.55],
        [1.1, 0.18],
        [0, 0.15],
      ]),
      40,
    );
    for (const x of T.laverXs) {
      for (const s of [-1, 1]) {
        const c = laverCart(k.m, bowl);
        c.position.set(x, 0.1, s * T.laverZ);
        k.add(c);
      }
    }
  },
  altar(k) {
    const { x, z } = altar;
    k.box("bronze", [20, 9, 20], [x, 4.6, z], { anim: grow });
    k.box("bronze", [20.6, 1, 20.6], [x, 9.6, z]);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        k.box("bronze", [1.4, 1.6, 1.4], [x + sx * 9.3, 10.9, z + sz * 9.3], {
          anim: { kind: "pop" },
          tile: false,
        });
      }
    }
    TEMPLE_FX.altar!(k);
  },
  furnishings(k) {
    for (const x of LAMP_XS) {
      for (const z of [-7, 7]) {
        const l = lampstand(k.m, 3);
        l.position.set(x, F + 0.2, z);
        k.add(l, { anim: { kind: "pop" } });
      }
    }
    TEMPLE_FX.furnishings!(k);
    const tb = showbreadTable(k.m);
    tb.position.set(-12, F + 0.2, 0);
    k.add(tb, { anim: { kind: "pop" } });
    const ia = incenseAltar(k.m);
    ia.position.set(6, F + 0.2, 0);
    k.add(ia, { anim: { kind: "pop" } });
  },
  ark(k) {
    const a = arkModel(k.m);
    a.position.set(20, F + 0.32, 0);
    k.add(a, { anim: { kind: "slide", from: [-14, 0, 0] } });
  },
  glory(k) {
    const g = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const s = glow(0xfff2d8, 12 + ((i * 7) % 9), 0.5, false);
      s.position.set(-26 + ((i * 37) % 54), F + 6 + ((i * 13) % 18), -6 + ((i * 5) % 12));
      g.add(s);
    }
    const core = glow(0xffe7a8, 22, 0.75);
    core.position.set(20, F + 8, 0);
    g.add(core);
    k.add(g, { anim: { kind: "fade" }, tally: null, frame: false });
    k.light(new THREE.PointLight(0xfff0d0, 420, 90, 2), [0, F + 16, 0]);
    k.anchor(20, F + 21, 0);
  },
};
