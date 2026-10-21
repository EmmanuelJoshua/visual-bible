import * as THREE from "three";
import type { ArtifactId } from "@/data/artifacts";
import type { ArtifactMats } from "@/lib/artifacts/materials";
import { arkModel } from "@/lib/artifacts/build/ark";
import { box, cyl } from "@/lib/artifacts/build/engine";
import { assembleBuild, hasBuild, loadBuildModel, loadObjectModel } from "@/lib/artifacts/build";
import {
  bronzeAltar,
  horns,
  incenseAltar,
  showbreadTable,
} from "@/lib/artifacts/build/parts";

/** Ark: 2½ × 1½ × 1½ cubits, mercy seat, cherubim, poles (Ex 25:10–21). */
export function buildArk(m: ArtifactMats): THREE.Group {
  const g = arkModel(m);
  g.name = "ark";
  return g;
}

/** Noah: 300 × 50 × 30, three decks, side door, 1-cubit window (Gen 6:14–16). */
export function buildNoahsArk(m: ArtifactMats): THREE.Group {
  const g = assembleBuild("noahs-ark", m).root;
  g.name = "noahs-ark";
  return g;
}

/** Table of the Presence: 2 × 1 × 1½, gold, twelve cakes (Ex 25:23; Lev 24:5–6). */
export function buildShowbread(m: ArtifactMats): THREE.Group {
  const g = showbreadTable(m);
  g.name = "showbread";
  return g;
}

/** Incense altar: 1 × 1 × 2, gold, horns (Ex 30:1–3). */
export function buildIncenseAltar(m: ArtifactMats): THREE.Group {
  const g = incenseAltar(m);
  g.name = "incense-altar";
  return g;
}

/** Court altar: 5 × 5 × 3, bronze, horns, grating (Ex 27:1–4). */
export function buildBronzeAltar(m: ArtifactMats): THREE.Group {
  const g = bronzeAltar(m);
  g.name = "bronze-altar";
  return g;
}

/** Court + tent + furniture in the order of Exodus 40, south side cut away. */
export function buildTabernacle(m: ArtifactMats): THREE.Group {
  const g = assembleBuild("tabernacle", m).root;
  g.name = "tabernacle";
  return g;
}

/**
 * David's tent on Zion — size not given. Open-front ridge tent with the ark
 * at true cubit scale inside.
 */
export function buildDavidsTent(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "davids-tent";

  const L = 10;
  const W = 10;
  const H = 8;

  g.add(box(L, 0.08, W, m.floor, 0, 0.04, 0));
  g.add(box(L, H * 0.55, 0.2, m.linen, 0, H * 0.28, -W / 2));
  g.add(box(0.2, H * 0.55, W, m.linen, -L / 2, H * 0.28, 0));
  g.add(box(0.2, H * 0.55, W, m.linen, L / 2, H * 0.28, 0));

  const roof = (side: number) => {
    const slab = box(L + 0.4, 0.18, W * 0.62, m.scarlet, 0, H * 0.72, side * 2.1);
    slab.rotation.x = side * 0.55;
    return slab;
  };
  g.add(roof(-1));
  g.add(roof(1));

  const ark = arkModel(m);
  ark.position.set(0, 0, 0.4);
  g.add(ark);

  return g;
}

/** Solomon's house, court, pillars, sea and furnishings — south side cut away (1 Kings 6–8). */
export function buildTemple(m: ArtifactMats): THREE.Group {
  const g = assembleBuild("temple", m).root;
  g.name = "temple";
  return g;
}

/** Temple court altar: 20 × 20 × 10 (2 Chronicles 4:1). */
export function buildSolomonAltar(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "solomon-altar";
  g.add(box(20, 10, 20, m.bronze, 0, 5, 0));
  horns(g, 9.4, 10.5, m.bronze, 1.1);
  return g;
}

/** Pair of 10-cubit cherubim filling the 20-cubit inner house (1 Kings 6:23–28). */
export function buildTempleCherubim(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "temple-cherubim";

  g.add(box(20, 0.15, 12, m.floor, 0, 0.08, 0));
  // wall marks at ±10
  g.add(box(0.3, 12, 12, m.stone, -10, 6, 0));
  g.add(box(0.3, 12, 12, m.stone, 10, 6, 0));

  const figure = (side: number) => {
    const c = new THREE.Group();
    c.add(box(1.6, 10, 1.6, m.gold, 0, 5, 0));
    const inner = box(5, 0.45, 2.2, m.goldDark, side * -2.5, 8.2, 0);
    inner.rotation.z = side * 0.08;
    const outer = box(5, 0.45, 2.2, m.goldDark, side * 2.5, 8.2, 0);
    outer.rotation.z = side * -0.08;
    c.add(inner);
    c.add(outer);
    c.position.x = side * 5;
    return c;
  };
  g.add(figure(-1));
  g.add(figure(1));
  return g;
}

/** Bronze sea: Ø10 × 5, circumference 30, twelve oxen (1 Kings 7:23–25). */
export function buildBronzeSea(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "bronze-sea";

  const oxH = 1.6;
  const seaH = 5;
  const r = 5;

  g.add(box(14, 0.08, 14, m.floor, 0, 0.04, 0));

  const ox = (x: number, z: number, rot: number) => {
    const o = new THREE.Group();
    o.add(box(1.8, 0.9, 0.9, m.bronze, 0, 0.65, 0));
    o.add(box(0.55, 0.5, 0.55, m.bronze, 0.95, 1.05, 0));
    o.position.set(x, 0, z);
    o.rotation.y = rot;
    g.add(o);
  };
  const dirs: [number, number, number][] = [
    [0, -1, 0],
    [0, 1, Math.PI],
    [1, 0, -Math.PI / 2],
    [-1, 0, Math.PI / 2],
  ];
  for (const [dx, dz, rot] of dirs) {
    for (const off of [-1.7, 0, 1.7]) {
      const px = dx * (r + 0.15) + (dx === 0 ? off : 0);
      const pz = dz * (r + 0.15) + (dz === 0 ? off : 0);
      ox(px, pz, rot);
    }
  }

  g.add(cyl(r, r, seaH, m.bronze, 0, oxH + seaH / 2, 0, 32));
  g.add(cyl(r - 0.18, r - 0.18, 0.2, m.water, 0, oxH + seaH - 0.25, 0, 32));
  g.add(cyl(r + 0.35, r, 0.45, m.bronze, 0, oxH + seaH + 0.1, 0, 32));
  return g;
}

/** House of the Forest of Lebanon: 100 × 50 × 30, 45 pillars (1 Kings 7:2–3). */
export function buildForestHouse(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "forest-house";

  const L = 100;
  const W = 50;
  const H = 30;

  g.add(box(L, 0.3, W, m.floor, 0, 0.15, 0));
  g.add(box(L, H, 0.6, m.cedar, 0, H / 2, -W / 2));
  g.add(box(0.6, H, W, m.cedar, -L / 2, H / 2, 0));
  g.add(box(0.6, H, W, m.cedar, L / 2, H / 2, 0));
  g.add(box(L, 0.5, W, m.cedar, 0, H, 0));

  // 3 rows × 15 — 1 Kings 7:3; four rows in 7:2 is noted as interpretive
  const rows = [-W / 4, 0, W / 4];
  for (const z of rows) {
    for (let i = 0; i < 15; i++) {
      const x = -L / 2 + 6 + i * ((L - 12) / 14);
      g.add(cyl(0.7, 0.8, H - 1, m.cedar, x, (H - 1) / 2, z, 10));
    }
  }
  return g;
}

/** Ezekiel 43:13–17 — stepped altar, 12-cubit hearth, east steps. */
export function buildEzekielAltar(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "ezekiel-altar";

  // long cubit treated as 1 unit (interpretive vs the short cubit elsewhere)
  g.add(box(18, 1, 18, m.stoneDark, 0, 0.5, 0));
  g.add(box(16, 2, 16, m.stone, 0, 2, 0));
  g.add(box(14, 4, 14, m.stoneDark, 0, 5, 0));
  g.add(box(12, 4, 12, m.bronze, 0, 9, 0));
  horns(g, 5.6, 11.15, m.bronze, 0.5);
  // steps on the east (−X)
  for (let i = 0; i < 6; i++) {
    g.add(box(1.2, 0.35, 4, m.stone, -7 - i * 1.1, 0.4 + i * 0.7, 0));
  }
  return g;
}

/** Schematic cube — not cubit scale. 12 gates, 3 per side (Rev 21:12–16). */
export function buildNewJerusalem(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "new-jerusalem";

  const S = 12;
  const t = 0.35;
  g.add(box(S, t, S, m.jasper, 0, t / 2, 0));
  g.add(box(S, t, S, m.gold, 0, S, 0));
  g.add(box(S, S, t, m.jasper, 0, S / 2, -S / 2));
  g.add(box(S, S, t, m.jasper, 0, S / 2, S / 2));
  g.add(box(t, S, S, m.jasper, -S / 2, S / 2, 0));
  g.add(box(t, S, S, m.jasper, S / 2, S / 2, 0));

  const gate = (x: number, z: number, rot: number) => {
    const frame = box(1.2, 1.8, 0.4, m.gold, x, 0.95, z);
    frame.rotation.y = rot;
    g.add(frame);
  };
  for (const z of [-3, 0, 3]) {
    gate(S / 2, z, 0);
    gate(-S / 2, z, 0);
  }
  for (const x of [-3, 0, 3]) {
    gate(x, S / 2, Math.PI / 2);
    gate(x, -S / 2, Math.PI / 2);
  }
  return g;
}

export function buildArtifact(id: ArtifactId, m: ArtifactMats): THREE.Group {
  switch (id) {
    case "noahs-ark":
      return buildNoahsArk(m);
    case "ark":
      return buildArk(m);
    case "showbread":
      return buildShowbread(m);
    case "incense-altar":
      return buildIncenseAltar(m);
    case "bronze-altar":
      return buildBronzeAltar(m);
    case "tabernacle":
      return buildTabernacle(m);
    case "davids-tent":
      return buildDavidsTent(m);
    case "temple":
      return buildTemple(m);
    case "solomon-altar":
      return buildSolomonAltar(m);
    case "temple-cherubim":
      return buildTempleCherubim(m);
    case "bronze-sea":
      return buildBronzeSea(m);
    case "forest-house":
      return buildForestHouse(m);
    case "ezekiel-altar":
      return buildEzekielAltar(m);
    case "new-jerusalem":
      return buildNewJerusalem(m);
  }
}

/**
 * The finished piece for the desk view: its Blender model when there is one
 * (for the four builds, the build model with every step in place), else the
 * code-built version.
 */
export async function loadArtifactObject(id: ArtifactId, m: ArtifactMats): Promise<THREE.Group> {
  if (hasBuild(id)) {
    const model = await loadBuildModel(id);
    if (model) {
      const g = assembleBuild(id, m, model).root;
      g.name = id;
      return g;
    }
  } else {
    const g = await loadObjectModel(id, m);
    if (g) return g;
  }
  return buildArtifact(id, m);
}

export function disposeGroup(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const mat = obj.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
  });
}
