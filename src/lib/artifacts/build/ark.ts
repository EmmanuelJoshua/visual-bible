import * as THREE from "three";
import { ARK_DIMS, ARK_STEPS, type ArkStepId } from "@/data/builds/ark";
import type { ArtifactMats } from "@/lib/artifacts/materials";
import { assemble, box, cyl, mesh, type StepFn } from "./engine";
import { glow } from "./parts";

const { L, W, H } = ARK_DIMS;
const t = 0.08;
const ringZ = W / 2 + 0.06;

let wingGeo: THREE.ExtrudeGeometry | null = null;

/** A swept wing silhouette with a feathered trailing edge, x forward, y up. */
function wing(): THREE.ExtrudeGeometry {
  if (wingGeo) return wingGeo;
  const s = new THREE.Shape();
  const l = 0.95;
  s.moveTo(0, 0);
  s.bezierCurveTo(l * 0.3, l * 0.3, l * 0.7, l * 0.42, l, l * 0.4);
  const trail: [number, number][] = [
    [0.86, 0.26],
    [0.9, 0.18],
    [0.72, 0.16],
    [0.74, 0.06],
    [0.55, 0.06],
    [0.55, -0.04],
    [0.36, -0.02],
    [0.3, -0.12],
    [0.12, -0.08],
    [0, -0.12],
  ];
  for (const [x, y] of trail) s.lineTo(x * l, y * l);
  s.closePath();
  wingGeo = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: false });
  wingGeo.translate(0, 0, -0.015);
  return wingGeo;
}

/** Kneeling cherub facing `dir` along x, wings up and forward (Ex 25:20). */
function cherub(m: ArtifactMats, dir: 1 | -1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.11, 0.2, 0.5, m.gold, 0, 0.25, 0, 16, false));
  g.add(mesh(new THREE.SphereGeometry(0.11, 16, 12), m.gold, 0.07, 0.58, 0));
  for (const s of [-1, 1]) {
    const w = mesh(wing(), m.gold, -0.04, 0.42, s * 0.16);
    w.rotation.set(s * 0.3, 0, 0.12);
    g.add(w);
  }
  g.scale.x = dir;
  g.position.set(-dir * (L / 2 - 0.35), H + 0.1, 0);
  return g;
}

export const ARK_GEOMETRY: Record<ArkStepId, StepFn> = {
  chest(k) {
    k.box("acacia", [L, t, W], [0, t / 2, 0], { tile: false });
    for (const s of [-1, 1]) {
      k.box("acacia", [L, H - t, t], [0, t + (H - t) / 2, s * (W / 2 - t / 2)], {
        tile: false,
      });
    }
    for (const s of [-1, 1]) {
      k.box("acacia", [t, H - t, W - 2 * t], [s * (L / 2 - t / 2), t + (H - t) / 2, 0], {
        tile: false,
      });
    }
  },
  overlay(k) {
    const grow = { anim: { kind: "grow" as const }, tile: false };
    for (const s of [-1, 1]) {
      k.box("gold", [L + 0.04, H, 0.02], [0, H / 2, s * (W / 2 + 0.01)], grow);
    }
    for (const s of [-1, 1]) {
      k.box("gold", [0.02, H, W], [s * (L / 2 + 0.01), H / 2, 0], grow);
    }
    const iy = t + (H - t) / 2;
    for (const s of [-1, 1]) {
      k.box("gold", [L - 2 * t, H - t, 0.02], [0, iy, s * (W / 2 - t - 0.01)], grow);
      k.box("gold", [0.02, H - t, W - 2 * t], [s * (L / 2 - t - 0.01), iy, 0], grow);
    }
    k.box("gold", [L - 2 * t, 0.02, W - 2 * t], [0, t + 0.01, 0], grow);
  },
  crown(k) {
    const y = H + 0.03;
    for (const s of [-1, 1]) {
      k.box("goldDark", [L + 0.12, 0.09, 0.06], [0, y, s * (W / 2 + 0.05)], { tile: false });
    }
    for (const s of [-1, 1]) {
      k.box("goldDark", [0.06, 0.09, W + 0.12], [s * (L / 2 + 0.05), y, 0], { tile: false });
    }
  },
  rings(k) {
    const geo = new THREE.TorusGeometry(0.1, 0.03, 12, 24);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const ring = mesh(geo, k.m.goldDark, sx * (L / 2 - 0.25), 0.35, sz * ringZ);
        ring.rotation.y = Math.PI / 2;
        k.add(ring, { anim: { kind: "pop" } });
      }
    }
  },
  staves(k) {
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 4, 16);
    for (const s of [-1, 1]) {
      const pole = mesh(geo, k.m.gold, 0, 0.35, s * ringZ);
      pole.rotation.z = Math.PI / 2;
      k.add(pole, { anim: { kind: "slide", from: [s * 3.5, 0, 0] } });
    }
  },
  testimony(k) {
    for (const s of [-1, 1]) {
      const tab = box(0.1, 0.72, 0.48, k.m.stone, s * 0.2, t + 0.36, 0, false);
      tab.rotation.y = s * 0.04;
      k.add(tab, { anim: { kind: "drop", h: 1.6 } });
    }
  },
  "mercy-seat"(k) {
    k.box("gold", [L, 0.1, W], [0, H + 0.05, 0], { anim: { kind: "drop", h: 1.2 }, tile: false });
  },
  "cherub-a"(k) {
    k.add(cherub(k.m, 1), { anim: { kind: "pop" } });
  },
  "cherub-b"(k) {
    k.add(cherub(k.m, -1), { anim: { kind: "pop" } });
  },
  meeting(k) {
    const g = glow(0xfff0c0, 1.8, 0.9);
    g.position.set(0, H + 0.75, 0);
    k.add(g, { anim: { kind: "fade" }, tally: null, frame: false });
    k.light(new THREE.PointLight(0xffd890, 4, 6, 2), [0, H + 0.8, 0]);
    k.anchor(0, H + 1.3, 0);
  },
};

/** The finished ark as a single object, for the tabernacle and temple. */
export function arkModel(m: ArtifactMats): THREE.Group {
  const ids = ARK_STEPS.map((s) => s.id).filter((id) => id !== "meeting");
  return assemble(ids, ARK_GEOMETRY, m).root;
}
