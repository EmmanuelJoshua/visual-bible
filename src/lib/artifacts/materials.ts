import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const BASE = "/textures";

export type ArtifactMats = {
  gold: THREE.MeshStandardMaterial;
  goldDark: THREE.MeshStandardMaterial;
  bronze: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  cedar: THREE.MeshStandardMaterial;
  linen: THREE.MeshStandardMaterial;
  scarlet: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  jasper: THREE.MeshStandardMaterial;
  bread: THREE.MeshStandardMaterial;
  acacia: THREE.MeshStandardMaterial;
  olive: THREE.MeshStandardMaterial;
  fir: THREE.MeshStandardMaterial;
  pitch: THREE.MeshStandardMaterial;
  silver: THREE.MeshStandardMaterial;
  goatHair: THREE.MeshStandardMaterial;
  ramSkin: THREE.MeshStandardMaterial;
  tachash: THREE.MeshStandardMaterial;
  /** blue, purple and scarlet bands with cherubim — the veil (Ex 26:31) */
  veil: THREE.MeshStandardMaterial;
  /** blue, purple and scarlet without cherubim — door and gate screens (Ex 26:36) */
  screen: THREE.MeshStandardMaterial;
  ground: THREE.MeshStandardMaterial;
  hideTan: THREE.MeshStandardMaterial;
  hideGrey: THREE.MeshStandardMaterial;
  hideBrown: THREE.MeshStandardMaterial;
  hideWhite: THREE.MeshStandardMaterial;
  flame: THREE.MeshBasicMaterial;
};

export type MatKey = {
  [K in keyof ArtifactMats]: ArtifactMats[K] extends THREE.MeshStandardMaterial
    ? K
    : never;
}[keyof ArtifactMats];

/** Woven bands for the veil and screens — procedural, no download. */
function wovenTexture(cherubim: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const bands = ["#1f3f8a", "#5a2a6e", "#a8231a", "#efe6d2"];
  for (let i = 0; i < 16; i++) {
    g.fillStyle = bands[i % bands.length];
    g.fillRect(0, i * 16, 256, 16);
  }
  // weave grain
  g.globalAlpha = 0.12;
  for (let x = 0; x < 256; x += 2) {
    g.fillStyle = x % 4 ? "#000" : "#fff";
    g.fillRect(x, 0, 1, 256);
  }
  g.globalAlpha = 1;
  if (cherubim) {
    // stylised winged figures in gold thread
    g.strokeStyle = "#e6c46a";
    g.lineWidth = 3;
    for (const [cx, cy] of [
      [64, 80],
      [192, 80],
      [64, 200],
      [192, 200],
    ]) {
      g.beginPath();
      g.moveTo(cx, cy + 26);
      g.lineTo(cx, cy - 6);
      g.moveTo(cx, cy - 4);
      g.quadraticCurveTo(cx - 34, cy - 30, cx - 44, cy + 6);
      g.moveTo(cx, cy - 4);
      g.quadraticCurveTo(cx + 34, cy - 30, cx + 44, cy + 6);
      g.stroke();
      g.beginPath();
      g.arc(cx, cy - 14, 7, 0, Math.PI * 2);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

let glowTex: THREE.CanvasTexture | null = null;

/** Soft radial sprite for lamp glow, the shekinah, and the cloud (Ex 40:34). */
export function glowTexture(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

type Maps = {
  diff?: THREE.Texture;
  nor?: THREE.Texture;
  rough?: THREE.Texture;
  metal?: THREE.Texture;
};

function loadJpg(loader: THREE.TextureLoader, path: string, color = false) {
  const t = loader.load(path);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/**
 * A scanned material's maps. `colour: false` leaves its colour map out (the
 * weave or the grain is wanted, the scan's own hue is not: the linen is a
 * blue cloth, the copper too red for bronze). `tile` is how many of the
 * model's texture units (2.2 cubits, a metre) one repeat spans: dressed stone
 * laid at a metre a tile would be bricks.
 */
function loadSet(loader: THREE.TextureLoader, name: string, { metal = false, colour = true, tile = 1 } = {}): Maps {
  const maps: Maps = {
    nor: loadJpg(loader, `${BASE}/${name}/nor.jpg`),
    rough: loadJpg(loader, `${BASE}/${name}/rough.jpg`),
  };
  if (colour) maps.diff = loadJpg(loader, `${BASE}/${name}/diff.jpg`, true);
  if (metal) maps.metal = loadJpg(loader, `${BASE}/${name}/metal.jpg`);
  if (tile !== 1) for (const t of Object.values(maps)) t?.repeat.setScalar(1 / tile);
  return maps;
}

/** a colour in linear light, which may be brighter than white: it lifts a scan that is darker than the thing */
const lin = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);

function pbr(
  maps: Maps,
  opts: {
    color?: number | THREE.Color;
    metalness?: number;
    roughness?: number;
    env?: number;
  } = {},
) {
  return new THREE.MeshStandardMaterial({
    map: maps.diff,
    normalMap: maps.nor,
    roughnessMap: maps.rough,
    metalnessMap: maps.metal,
    color: opts.color ?? 0xffffff,
    metalness: opts.metalness ?? (maps.metal ? 1 : 0),
    roughness: opts.roughness ?? 1,
    envMapIntensity: opts.env ?? 1,
  });
}

let hdrPromise: Promise<THREE.DataTexture> | null = null;
let matsPromise: Promise<ArtifactMats> | null = null;

function loadHdr(): Promise<THREE.DataTexture> {
  if (!hdrPromise) {
    hdrPromise = new Promise((resolve, reject) => {
      new RGBELoader().load(
        `${BASE}/env/studio_small_03_1k.hdr`,
        (hdr) => resolve(hdr),
        undefined,
        reject,
      );
    });
  }
  return hdrPromise;
}

/** PMREM is GPU-bound to this renderer — do not reuse across canvases. */
export async function loadStudioEnv(
  renderer: THREE.WebGLRenderer,
): Promise<THREE.Texture> {
  const hdr = await loadHdr();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(hdr).texture;
  pmrem.dispose();
  return env;
}

/** Photoscanned CC0 maps — Poly Haven + ambientCG. Cached across stages. */
export function loadArtifactMaterials(): Promise<ArtifactMats> {
  if (!matsPromise) {
    matsPromise = new Promise((resolve, reject) => {
      const manager = new THREE.LoadingManager();
      const loader = new THREE.TextureLoader(manager);
      const gold = loadSet(loader, "gold", { metal: true });
      const bronze = loadSet(loader, "bronze", { metal: true, colour: false });
      const wood = loadSet(loader, "wood");
      const linen = loadSet(loader, "linen", { colour: false });
      const scarlet = loadSet(loader, "scarlet");
      // courses a cubit and a half high: "great stones, costly stones, and hewed stones" (1 Kings 5:17)
      const stone = loadSet(loader, "stone", { tile: 3 });
      const mats: ArtifactMats = {
        gold: pbr(gold, { color: 0xffd98a, metalness: 0.95, roughness: 0.24, env: 1.5 }),
        goldDark: pbr(gold, {
          color: 0xe2b35a,
          metalness: 0.93,
          roughness: 0.36,
          env: 1.3,
        }),
        // bronze as cast and worked: a brown gold, not copper's red
        bronze: pbr(bronze, { color: 0xcfa268, metalness: 0.9, roughness: 0.4, env: 1.3 }),
        // the plank scan is a weathered grey-brown: each wood's own colour is laid over it
        wood: pbr(wood, { color: lin(0.52, 0.37, 0.26), roughness: 0.85, env: 0.35 }),
        cedar: pbr(wood, { color: lin(0.74, 0.4, 0.24), roughness: 0.8, env: 0.3 }),
        linen: pbr(linen, { color: 0xf1ece0, roughness: 0.9, env: 0.2 }),
        scarlet: pbr(scarlet, { color: 0xb4261a, roughness: 0.75, env: 0.45 }),
        // Jerusalem's pale limestone
        stone: pbr(stone, { color: lin(1.16, 1.22, 1.3), roughness: 0.95, env: 0.25 }),
        // a shade or two off, as blocks from one quarry are
        stoneDark: pbr(stone, { color: lin(0.96, 1.0, 1.06), roughness: 0.97, env: 0.2 }),
        floor: pbr(stone, { color: lin(0.9, 0.93, 0.98), roughness: 0.98, env: 0.15 }),
        water: new THREE.MeshStandardMaterial({
          color: 0x3d6b7a,
          metalness: 0.15,
          roughness: 0.08,
          envMapIntensity: 1.5,
        }),
        jasper: pbr(gold, {
          color: 0xf4e6c4,
          metalness: 0.55,
          roughness: 0.4,
          env: 1.1,
        }),
        bread: pbr(wood, { color: 0xd4b07a, roughness: 0.92, env: 0.2 }),
        acacia: pbr(wood, { color: lin(0.86, 0.56, 0.32), roughness: 0.82, env: 0.3 }),
        olive: pbr(wood, { color: lin(0.8, 0.64, 0.4), roughness: 0.78, env: 0.3 }),
        fir: pbr(wood, { color: lin(1.15, 0.94, 0.66), roughness: 0.85, env: 0.25 }),
        pitch: pbr(wood, { color: 0x1c1611, roughness: 0.5, env: 0.5 }),
        silver: pbr(gold, {
          color: 0xdfe4ea,
          metalness: 0.9,
          roughness: 0.3,
          env: 1.7,
        }),
        goatHair: pbr(linen, { color: 0x3b332c, roughness: 0.95, env: 0.15 }),
        ramSkin: pbr(scarlet, { color: 0x8a2a1c, roughness: 0.7, env: 0.3 }),
        tachash: pbr(linen, { color: 0x3a4650, roughness: 0.8, env: 0.25 }),
        veil: new THREE.MeshStandardMaterial({
          map: wovenTexture(true),
          normalMap: linen.nor,
          roughness: 0.85,
          envMapIntensity: 0.4,
          side: THREE.DoubleSide,
        }),
        screen: new THREE.MeshStandardMaterial({
          map: wovenTexture(false),
          normalMap: linen.nor,
          roughness: 0.85,
          envMapIntensity: 0.4,
          side: THREE.DoubleSide,
        }),
        ground: pbr(stone, { color: lin(1.1, 1.1, 1.12), roughness: 1, env: 0.1 }),
        hideTan: new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.9 }),
        hideGrey: new THREE.MeshStandardMaterial({ color: 0x8a8580, roughness: 0.9 }),
        hideBrown: new THREE.MeshStandardMaterial({ color: 0x5e4030, roughness: 0.9 }),
        hideWhite: new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.95 }),
        flame: new THREE.MeshBasicMaterial({ color: 0xffb648 }),
      };
      manager.onLoad = () => resolve(mats);
      manager.onError = (url) => reject(new Error(`texture failed: ${url}`));
    });
  }
  return matsPromise;
}

/**
 * The materials lit by a stage's own surroundings. A scene's environment is
 * applied to every material at one strength (three ignores a material's own
 * `envMapIntensity` there), which leaves gold as dull as wood: here each
 * material carries the environment itself, at its own strength times `gain`,
 * so metal mirrors the room and cloth and stone barely do. A stage makes its
 * set once (the environment belongs to its renderer).
 */
export function withEnvironment(m: ArtifactMats, env: THREE.Texture, gain = 1): ArtifactMats {
  const out = { ...m } as Record<string, THREE.Material>;
  for (const [key, mat] of Object.entries(m)) {
    if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
    const c = mat.clone();
    c.name = mat.name;
    c.envMap = env;
    c.envMapIntensity = mat.envMapIntensity * gain;
    out[key] = c;
  }
  return out as unknown as ArtifactMats;
}

/** Tile a material to cubit size so a 300-cubit hull is not one stretched jpeg. */
export function tileMaterial(
  mat: THREE.Material,
  u: number,
  v: number,
): THREE.Material {
  if (!(mat instanceof THREE.MeshStandardMaterial)) return mat;
  const c = mat.clone();
  const ru = Math.max(0.4, u);
  const rv = Math.max(0.4, v);
  for (const key of [
    "map",
    "normalMap",
    "roughnessMap",
    "metalnessMap",
  ] as const) {
    const src = c[key];
    if (!src) continue;
    const t = src.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    // times the scan's own scale (dressed stone repeats every few cubits, not every one)
    t.repeat.set(ru * src.repeat.x, rv * src.repeat.y);
    t.needsUpdate = true;
    c[key] = t;
  }
  return c;
}
