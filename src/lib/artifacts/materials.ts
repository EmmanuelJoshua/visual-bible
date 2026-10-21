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

function loadSet(loader: THREE.TextureLoader, name: string, hasMetal = false): Maps {
  const maps: Maps = {
    diff: loadJpg(loader, `${BASE}/${name}/diff.jpg`, true),
    nor: loadJpg(loader, `${BASE}/${name}/nor.jpg`),
    rough: loadJpg(loader, `${BASE}/${name}/rough.jpg`),
  };
  if (hasMetal) maps.metal = loadJpg(loader, `${BASE}/${name}/metal.jpg`);
  return maps;
}

function pbr(
  maps: Maps,
  opts: {
    color?: number;
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
      const gold = loadSet(loader, "gold", true);
      const bronze = loadSet(loader, "bronze", true);
      const wood = loadSet(loader, "wood");
      const linen = loadSet(loader, "linen");
      const scarlet = loadSet(loader, "scarlet");
      const stone = loadSet(loader, "stone");
      const mats: ArtifactMats = {
        gold: pbr(gold, { color: 0xffe7b0, metalness: 0.88, roughness: 0.28, env: 1.8 }),
        goldDark: pbr(gold, {
          color: 0xe0c070,
          metalness: 0.85,
          roughness: 0.4,
          env: 1.5,
        }),
        bronze: pbr(bronze, { color: 0xffc090, metalness: 0.85, roughness: 0.38, env: 1.55 }),
        wood: pbr(wood, { color: 0xb08a5e, roughness: 0.85, env: 0.35 }),
        cedar: pbr(wood, { color: 0xb07a48, roughness: 0.8, env: 0.3 }),
        linen: pbr(linen, { color: 0xf2ead8, roughness: 0.9, env: 0.2 }),
        scarlet: pbr(scarlet, { color: 0xb4261a, roughness: 0.75, env: 0.45 }),
        stone: pbr(stone, { roughness: 0.95, env: 0.25 }),
        stoneDark: pbr(stone, { color: 0x8a7d6e, roughness: 0.97, env: 0.2 }),
        floor: pbr(stone, { color: 0xc4b49a, roughness: 0.98, env: 0.15 }),
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
        acacia: pbr(wood, { color: 0xc89060, roughness: 0.82, env: 0.3 }),
        olive: pbr(wood, { color: 0xb8a070, roughness: 0.78, env: 0.3 }),
        fir: pbr(wood, { color: 0xe0c49a, roughness: 0.85, env: 0.25 }),
        pitch: pbr(wood, { color: 0x2a2018, roughness: 0.45, env: 0.6 }),
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
        ground: pbr(stone, { color: 0xb8a58a, roughness: 1, env: 0.1 }),
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
    t.repeat.set(ru, rv);
    t.needsUpdate = true;
    c[key] = t;
  }
  return c;
}
