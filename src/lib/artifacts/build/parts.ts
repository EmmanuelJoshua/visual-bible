import * as THREE from "three";
import type { ArtifactMats } from "@/lib/artifacts/materials";
import { glowTexture } from "@/lib/artifacts/materials";
import { box, cyl, mesh } from "./engine";

/** Sub-assemblies shared between builds and the static models. */

export function horns(
  g: THREE.Group,
  half: number,
  y: number,
  mat: THREE.Material,
  size = 0.22,
) {
  for (const x of [-half, half]) {
    for (const z of [-half, half]) {
      g.add(box(size, size * 1.4, size, mat, x, y, z, false));
    }
  }
}

function poles(
  g: THREE.Group,
  m: ArtifactMats,
  len: number,
  y: number,
  z: number,
  r = 0.04,
) {
  const geo = new THREE.CylinderGeometry(r, r, len, 10);
  for (const s of [-1, 1]) {
    const pole = mesh(geo, m.gold, 0, y, s * z);
    pole.rotation.z = Math.PI / 2;
    g.add(pole);
  }
}

/** Table of the Presence: 2 × 1 × 1½, twelve cakes (Ex 25:23; Lev 24:5–6). */
export function showbreadTable(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  const L = 2;
  const W = 1;
  const H = 1.5;
  g.add(box(L, 0.12, W, m.gold, 0, H, 0, false));
  g.add(box(L + 0.1, 0.06, W + 0.1, m.goldDark, 0, H + 0.08, 0, false));
  for (const x of [-L / 2 + 0.12, L / 2 - 0.12]) {
    for (const z of [-W / 2 + 0.12, W / 2 - 0.12]) {
      g.add(cyl(0.07, 0.09, H, m.gold, x, H / 2, z, 8, false));
    }
  }
  poles(g, m, 3.2, 0.35, W / 2 + 0.08);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 6; i++) {
      g.add(
        box(0.22, 0.08, 0.28, m.bread, -0.7 + i * 0.28, H + 0.16, row ? 0.22 : -0.22, false),
      );
    }
  }
  return g;
}

/** Altar of incense: 1 × 1 × 2, horns (Ex 30:1–3). */
export function incenseAltar(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1, 2, 1, m.gold, 0, 1, 0, false));
  g.add(box(1.12, 0.08, 1.12, m.goldDark, 0, 2.02, 0, false));
  horns(g, 0.48, 2.18, m.goldDark, 0.16);
  poles(g, m, 2.4, 0.7, 0.58);
  return g;
}

/** Wilderness court altar: 5 × 5 × 3, bronze, grating (Ex 27:1–4). */
export function bronzeAltar(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.add(box(5, 3, 0.25, m.bronze, 0, 1.5, -2.4));
  g.add(box(5, 3, 0.25, m.bronze, 0, 1.5, 2.4));
  g.add(box(0.25, 3, 5, m.bronze, -2.4, 1.5, 0));
  g.add(box(0.25, 3, 5, m.bronze, 2.4, 1.5, 0));
  g.add(box(4.6, 0.15, 4.6, m.bronze, 0, 1.5, 0));
  for (let i = -2; i <= 2; i++) {
    g.add(box(0.08, 0.08, 4.4, m.goldDark, i * 0.7, 1.58, 0, false));
    g.add(box(4.4, 0.08, 0.08, m.goldDark, 0, 1.58, i * 0.7, false));
  }
  horns(g, 2.35, 3.2, m.bronze, 0.35);
  return g;
}

/**
 * Lampstand of beaten gold — six branches out of the sides, three and three
 * (Ex 25:31–37). The text gives no height; ≈3 cubits is interpretive.
 */
export function lampstand(m: ArtifactMats, h = 3): THREE.Group {
  const g = new THREE.Group();
  const k = h / 3;
  g.add(cyl(0.35 * k, 0.5 * k, 0.25 * k, m.gold, 0, 0.12 * k, 0, 16, false));
  g.add(cyl(0.07 * k, 0.09 * k, 2.75 * k, m.gold, 0, 1.6 * k, 0, 10, false));
  const top = 2.95 * k;
  const radii = [0.38, 0.72, 1.05].map((r) => r * k);
  for (const r of radii) {
    const arc = mesh(
      new THREE.TorusGeometry(r, 0.055 * k, 8, 24, Math.PI),
      m.gold,
      0,
      top,
      0,
    );
    arc.rotation.z = Math.PI;
    g.add(arc);
  }
  const lampGeo = new THREE.CylinderGeometry(0.12 * k, 0.06 * k, 0.14 * k, 10);
  const flameGeo = new THREE.ConeGeometry(0.05 * k, 0.2 * k, 8);
  for (const x of [0, ...radii, ...radii.map((r) => -r)]) {
    g.add(mesh(lampGeo, m.goldDark, x, top + 0.06 * k, 0));
    const f = mesh(flameGeo, m.flame, x, top + 0.24 * k, 0);
    f.castShadow = false;
    g.add(f);
  }
  return g;
}

/** One of the twelve oxen under the Sea (1 Kings 7:25), facing +X. */
export function ox(m: ArtifactMats, s = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.4 * s, 1.1 * s, 1.1 * s, m.bronze, 0, 1.45 * s, 0, false));
  g.add(box(0.8 * s, 0.7 * s, 0.7 * s, m.bronze, 1.45 * s, 1.75 * s, 0, false));
  g.add(box(0.12 * s, 0.4 * s, 0.12 * s, m.bronze, 1.5 * s, 2.2 * s, 0.3 * s, false));
  g.add(box(0.12 * s, 0.4 * s, 0.12 * s, m.bronze, 1.5 * s, 2.2 * s, -0.3 * s, false));
  for (const x of [-0.9, 0.9]) {
    for (const z of [-0.38, 0.38]) {
      g.add(box(0.28 * s, 0.95 * s, 0.28 * s, m.bronze, x * s, 0.47 * s, z * s, false));
    }
  }
  return g;
}

/** Soft additive glow — lamp light, the cloud, the shekinah. */
export function glow(
  color: number,
  size: number,
  opacity = 0.8,
  additive = true,
): THREE.Sprite {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }),
  );
  s.scale.set(size, size, 1);
  return s;
}

/** A few flickerless tongues of fire on an altar hearth, with glow. */
export function fire(m: ArtifactMats, w: number, d: number, h = 1): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.ConeGeometry(0.35 * h, 1.4 * h, 7);
  const n = Math.max(3, Math.round((w * d) / 6));
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996;
    const r = Math.sqrt(i / n) * Math.min(w, d) * 0.4;
    const f = mesh(geo, m.flame, Math.cos(a) * r, 0.7 * h, Math.sin(a) * r);
    f.scale.setScalar(0.7 + ((i * 37) % 10) / 20);
    f.castShadow = false;
    g.add(f);
  }
  const halo = glow(0xff9a3a, Math.max(w, d) * 1.2, 0.55);
  halo.position.y = h;
  g.add(halo);
  return g;
}
