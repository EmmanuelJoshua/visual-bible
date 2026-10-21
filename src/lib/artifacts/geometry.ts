import * as THREE from "three";
import type { ArtifactId } from "@/data/artifacts";
import type { ArtifactMats } from "@/lib/artifacts/materials";
import { tileMaterial } from "@/lib/artifacts/materials";

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    tileMaterial(mat, w / 2.2, d / 2.2),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(
  rTop: number,
  rBot: number,
  h: number,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  segs = 32,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, segs),
    tileMaterial(mat, (Math.PI * (rTop + rBot)) / 2.2, h / 2.2),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function horns(
  g: THREE.Group,
  half: number,
  y: number,
  mat: THREE.Material,
  size = 0.22,
) {
  for (const x of [-half, half]) {
    for (const z of [-half, half]) {
      g.add(box(size, size * 1.4, size, mat, x, y, z));
    }
  }
}

/** Ark: 2½ × 1½ × 1½ cubits, mercy seat, cherubim, poles (Ex 25:10–21). */
export function buildArk(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "ark";

  const L = 2.5;
  const W = 1.5;
  const H = 1.5;

  g.add(box(L, H, W, m.gold, 0, H / 2, 0));
  // crown / molding around the top rim
  g.add(box(L + 0.12, 0.08, W + 0.12, m.goldDark, 0, H + 0.02, 0));
  // mercy seat
  g.add(box(L, 0.08, W, m.gold, 0, H + 0.08, 0));

  const cherub = (side: number) => {
    const c = new THREE.Group();
    c.add(box(0.28, 0.7, 0.28, m.gold, 0, 0.35, 0));
    const wing = (dir: number) => {
      const w = box(0.08, 0.9, 1.05, m.gold, dir * 0.42, 0.55, 0.15);
      w.rotation.z = dir * -0.55;
      w.rotation.x = -0.35;
      return w;
    };
    c.add(wing(-1));
    c.add(wing(1));
    c.position.set(side * (L / 2 - 0.28), H + 0.12, 0);
    c.rotation.y = side * 0.15;
    return c;
  };
  g.add(cherub(-1));
  g.add(cherub(1));

  // four rings, two per long side
  const ringGeo = new THREE.TorusGeometry(0.1, 0.03, 12, 24);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const ring = new THREE.Mesh(ringGeo, m.goldDark);
      ring.position.set(sx * (L / 2 - 0.25), 0.35, sz * (W / 2 + 0.08));
      ring.rotation.y = Math.PI / 2;
      g.add(ring);
    }
  }

  // poles — length not given; ≈4 cubits, interpretive
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 4, 20);
  for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(poleGeo, m.gold);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, 0.35, sz * (W / 2 + 0.08));
    g.add(pole);
  }

  return g;
}

/** Noah: 300 × 50 × 30, three decks, side door, 1-cubit window (Gen 6:14–16). */
export function buildNoahsArk(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "noahs-ark";

  const L = 300;
  const W = 50;
  const H = 30;
  const t = 1.2;

  g.add(box(L, t, W, m.wood, 0, t / 2, 0));
  g.add(box(L, H, t, m.wood, 0, H / 2, -W / 2));
  g.add(box(t, H, W, m.wood, -L / 2, H / 2, 0));
  g.add(box(t, H, W, m.wood, L / 2, H / 2, 0));
  // roof, leaving a 1-cubit window slot along the ridge
  g.add(box(L, t, W / 2 - 0.6, m.cedar, 0, H, -W / 4));
  g.add(box(L, t, W / 2 - 0.6, m.cedar, 0, H, W / 4));

  for (const y of [10, 20]) {
    g.add(box(L - t * 2, 0.4, W - t, m.cedar, 0, y, -0.4));
  }

  // door in the side (Gen 6:16), set in the remaining long wall
  g.add(box(8, 12, 0.5, m.goldDark, -L / 4, 7, -W / 2));

  return g;
}

/** Table of the Presence: 2 × 1 × 1½, gold, twelve cakes (Ex 25:23; Lev 24:5–6). */
export function buildShowbread(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "showbread";

  const L = 2;
  const W = 1;
  const H = 1.5;

  g.add(box(L, 0.12, W, m.gold, 0, H, 0));
  g.add(box(L + 0.1, 0.06, W + 0.1, m.goldDark, 0, H + 0.08, 0));
  for (const x of [-L / 2 + 0.12, L / 2 - 0.12]) {
    for (const z of [-W / 2 + 0.12, W / 2 - 0.12]) {
      g.add(cyl(0.07, 0.09, H, m.gold, x, H / 2, z, 8));
    }
  }

  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8);
  for (const z of [-1, 1]) {
    const pole = new THREE.Mesh(poleGeo, m.gold);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, 0.35, z * (W / 2 + 0.08));
    g.add(pole);
  }

  // two rows of six — arrangement from Lev 24:6, loaf size interpretive
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 6; i++) {
      g.add(
        box(
          0.22,
          0.08,
          0.28,
          m.bread,
          -0.7 + i * 0.28,
          H + 0.16,
          row === 0 ? -0.22 : 0.22,
        ),
      );
    }
  }

  return g;
}

/** Incense altar: 1 × 1 × 2, gold, horns (Ex 30:1–3). */
export function buildIncenseAltar(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "incense-altar";

  g.add(box(1, 2, 1, m.gold, 0, 1, 0));
  g.add(box(1.12, 0.08, 1.12, m.goldDark, 0, 2.02, 0));
  horns(g, 0.48, 2.18, m.goldDark, 0.16);
  const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8);
  for (const z of [-1, 1]) {
    const pole = new THREE.Mesh(poleGeo, m.gold);
    pole.rotation.z = Math.PI / 2;
    pole.position.set(0, 0.7, z * 0.58);
    g.add(pole);
  }
  return g;
}

/** Court altar: 5 × 5 × 3, bronze, horns, grating (Ex 27:1–4). */
export function buildBronzeAltar(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "bronze-altar";

  g.add(box(5, 3, 0.25, m.bronze, 0, 1.5, -2.4));
  g.add(box(5, 3, 0.25, m.bronze, 0, 1.5, 2.4));
  g.add(box(0.25, 3, 5, m.bronze, -2.4, 1.5, 0));
  g.add(box(0.25, 3, 5, m.bronze, 2.4, 1.5, 0));
  g.add(box(4.6, 0.15, 4.6, m.bronze, 0, 1.5, 0));
  for (let i = -2; i <= 2; i++) {
    g.add(box(0.08, 0.08, 4.4, m.goldDark, i * 0.7, 1.58, 0));
    g.add(box(4.4, 0.08, 0.08, m.goldDark, 0, 1.58, i * 0.7));
  }
  horns(g, 2.35, 3.2, m.bronze, 0.35);
  return g;
}

/** Court + tent + altar, cutaway on the near long wall (Ex 26–27). */
export function buildTabernacle(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "tabernacle";

  const courtL = 100;
  const courtW = 50;
  const wallH = 5;
  const t = 0.25;

  g.add(box(courtL, 0.08, courtW, m.floor, 0, 0.04, 0));
  // hangings — skip +Z wall for the cutaway
  g.add(box(courtL, wallH, t, m.linen, 0, wallH / 2, -courtW / 2));
  g.add(box(t, wallH, courtW, m.linen, -courtL / 2, wallH / 2, 0));
  g.add(box(t, wallH, courtW, m.linen, courtL / 2, wallH / 2, 0));

  // tent: 30 × 10 × 10, in the western third (toward +X)
  const tentL = 30;
  const tentW = 10;
  const tentH = 10;
  const tentX = courtL / 2 - 10 - tentL / 2;
  const boards = m.goldDark;
  g.add(box(tentL, tentH, t, boards, tentX, tentH / 2, -tentW / 2));
  g.add(box(t, tentH, tentW, boards, tentX - tentL / 2, tentH / 2, 0));
  g.add(box(t, tentH, tentW, boards, tentX + tentL / 2, tentH / 2, 0));
  g.add(box(tentL, t, tentW, m.gold, tentX, tentH, 0));

  // veil at 10 cubits from the west (most holy = 10 cube)
  const veilX = tentX + tentL / 2 - 10;
  g.add(box(t, tentH - 0.2, tentW - 0.2, m.scarlet, veilX, tentH / 2, 0));

  const ark = buildArk(m);
  ark.position.set(tentX + tentL / 2 - 5, 0, 0);
  g.add(ark);

  // bronze altar in the court, east of the tent
  const altarX = tentX - tentL / 2 - 12;
  g.add(box(5, 3, 5, m.bronze, altarX, 1.5, 0));

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

  const ark = buildArk(m);
  ark.position.set(0, 0, 0.4);
  g.add(ark);

  return g;
}

/** Solomon's house, cutaway, porch + pillars (1 Kings 6–7). */
export function buildTemple(m: ArtifactMats): THREE.Group {
  const g = new THREE.Group();
  g.name = "temple";

  const houseL = 60;
  const houseW = 20;
  const houseH = 30;
  const porchL = 10;
  const inner = 20;

  // floor of house + porch
  g.add(
    box(houseL + porchL, 0.2, houseW + 14, m.floor, porchL / 2, 0.1, 0),
  );

  const houseX = porchL / 2;
  // back, far side, roof — omit -Z wall (cutaway)
  g.add(
    box(0.6, houseH, houseW, m.stone, houseX + houseL / 2, houseH / 2, 0),
  );
  g.add(
    box(houseL, houseH, 0.6, m.stone, houseX, houseH / 2, houseW / 2),
  );
  g.add(box(houseL, 0.5, houseW, m.stoneDark, houseX, houseH, 0));

  // inner sanctuary cube at the west end
  const innerX = houseX + houseL / 2 - inner / 2;
  g.add(box(0.35, inner, inner - 0.4, m.gold, innerX - inner / 2, inner / 2, 0));
  g.add(
    box(inner, inner, 0.35, m.goldDark, innerX, inner / 2, houseW / 2 - 0.3),
  );
  g.add(box(inner, 0.35, inner, m.gold, innerX, inner, 0));

  const ark = buildArk(m);
  ark.position.set(innerX, 0.2, 0);
  g.add(ark);

  // porch
  const porchX = -houseL / 2 + houseX - porchL / 2;
  g.add(box(porchL, 22, 0.5, m.stone, porchX, 11, houseW / 2));
  g.add(box(porchL, 0.5, houseW, m.stoneDark, porchX, 22, 0));
  g.add(box(0.5, 22, houseW, m.stone, porchX - porchL / 2, 11, 0));

  // side chambers, three stories (1 Kings 6:6) — near side omitted for cutaway
  const stories = [
    { w: 5, y: 2.5 },
    { w: 6, y: 7.5 },
    { w: 7, y: 13 },
  ];
  for (const s of stories) {
    g.add(
      box(houseL - 2, 5, s.w, m.stoneDark, houseX, s.y, houseW / 2 + s.w / 2),
    );
  }

  // Jachin & Boaz — 18 cubits high, 12 cubits circumference
  const r = 12 / (2 * Math.PI);
  const colGeo = new THREE.CylinderGeometry(r, r, 18, 16);
  const capGeo = new THREE.CylinderGeometry(r * 1.25, r * 1.25, 5, 16);
  for (const z of [-6, 6]) {
    const col = new THREE.Mesh(colGeo, m.bronze);
    col.position.set(porchX - porchL / 2 - 1.2, 9, z);
    col.castShadow = true;
    g.add(col);
    const cap = new THREE.Mesh(capGeo, m.bronze);
    cap.position.set(porchX - porchL / 2 - 1.2, 20.5, z);
    g.add(cap);
  }

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

export function disposeGroup(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.geometry.dispose();
    const mat = obj.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat.dispose();
  });
}
