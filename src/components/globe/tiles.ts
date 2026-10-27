import * as THREE from "three";
import { DEG, R, ecef, tileLat, tileLng, tileXY } from "./geo";

/**
 * The streaming surface of the Earth: a quadtree of Web Mercator tiles, each
 * a mesh shaped by real elevation (AWS Terrarium) and dressed in Sentinel-2
 * cloudless imagery (EOX). Each frame the camera picks the coarsest tiles
 * whose imagery is about a texel per screen pixel; sharper tiles replace
 * their parent only once all four are in, so the surface never has holes.
 *
 * Meshes live in ECEF metres, each relative to its own centre so float32
 * vertices stay precise; the stage sets this group's ECEF → world matrix.
 */

/**
 * EOxCloudless: Sentinel-2 composited free of cloud, by EOX. The 2024 layer is
 * by far the truest and sharpest, but licensed CC BY-NC-SA 4.0 (non-commercial);
 * for commercial use switch to "s2cloudless-2017_3857" (CC BY 4.0) or a licence.
 */
export const IMAGERY_LAYER = "s2cloudless-2024_3857";
export const IMAGERY_CREDIT = "EOxCloudless 2024 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2024)";
const IMAGERY = (z: number, x: number, y: number) =>
  `https://tiles.maps.eox.at/wmts/1.0.0/${IMAGERY_LAYER}/default/g/${z}/${y}/${x}.jpg`;
const TERRAIN = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

const IMAGERY_MAX_Z = 14; // ~9 m a pixel: Sentinel-2's own resolution
const TERRAIN_MAX_Z = 12; // ~30 m: SRTM's
const MAX_Z = 15;
const ROOT_Z = 2;
const SEG = 32;
const MAX_LOADS = 12;
const KEEP_TILES = 420;
/** refine while a tile's imagery texel covers more than this many screen pixels */
const TEXEL_PX = 1.25;

type Load = "idle" | "loading" | "done" | "error";

export type Tile = {
  z: number;
  x: number;
  y: number;
  key: string;
  parent: Tile | null;
  children: Tile[] | null;
  west: number;
  east: number;
  north: number;
  south: number;
  center: THREE.Vector3;
  radius: number;
  widthM: number;
  image: THREE.Texture | null;
  imageLoad: Load;
  heights: Float32Array | null;
  /** surface normals from the heights, east/north/up packed in rgb: relief shading finer than the mesh */
  relief: THREE.DataTexture | null;
  /** the mesh's own vertex heights, (SEG+1)², so things can sit on the surface as drawn */
  grid: Float32Array | null;
  terrainLoad: Load;
  minH: number;
  maxH: number;
  mesh: THREE.Mesh | null;
  lastUsed: number;
  lastWanted: number;
  abort: AbortController | null;
};

/* --------------------------------------------------------------- water */

/** land / lake / sea from the baked masks (0 / 128 / 255) */
export class WaterMask {
  private world: Uint8Array | null = null;
  private region: Uint8Array | null = null;
  readonly ready: Promise<void>;

  constructor() {
    this.ready = Promise.all([decodeMask("/globe/water-world.png"), decodeMask("/globe/water-region.png")]).then(
      ([w, r]) => {
        this.world = w;
        this.region = r;
      },
    );
  }

  /** is there sea within a mask cell or so */
  nearSea(lng: number, lat: number, cells = 4): boolean {
    const cell = lng >= 10 && lng < 56 && lat > 22 && lat <= 44 ? 0.01 : 0.1;
    for (let r = 1; r <= cells; r++) {
      const d = cell * r * 1.2;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]])
        if (this.at(lng + dx * d, lat + dy * d) === 255) return true;
    }
    return false;
  }

  at(lng: number, lat: number): number {
    if (this.region && lng >= 10 && lng < 56 && lat > 22 && lat <= 44) {
      const x = Math.floor((lng - 10) / 0.01);
      const y = Math.floor((44 - lat) / 0.01);
      return this.region[y * 4600 + x];
    }
    if (!this.world) return 0;
    const x = Math.min(3599, Math.max(0, Math.floor((lng + 180) / 0.1)));
    const y = Math.min(1799, Math.max(0, Math.floor((90 - lat) / 0.1)));
    return this.world[y * 3600 + x];
  }
}

async function decodeMask(url: string): Promise<Uint8Array> {
  const bmp = await createImageBitmap(await (await fetch(url)).blob());
  const cv = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const out = new Uint8Array(bmp.width * bmp.height);
  for (let i = 0; i < out.length; i++) out[i] = px[i * 4];
  bmp.close();
  return out;
}

/* ------------------------------------------------------------ material */

/**
 * A tileable grain: two channels of soft noise, laid over the imagery close
 * up so ground the satellite sees only in ten-metre pixels still has texture.
 */
function detailTexture() {
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  const lattice = (seed: number, cells: number) => {
    const g = new Float32Array(cells * cells);
    let s = seed;
    for (let i = 0; i < g.length; i++) {
      s = (s * 16807) % 2147483647;
      g[i] = s / 2147483647;
    }
    return (x: number, y: number) => {
      const fx = (x / n) * cells;
      const fy = (y / n) * cells;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = smooth(fx - x0);
      const ty = smooth(fy - y0);
      const at = (i: number, j: number) => g[(((j % cells) + cells) % cells) * cells + (((i % cells) + cells) % cells)];
      const a = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
      const b = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
      return a * (1 - ty) + b * ty;
    };
  };
  const octaves = (seed: number) => [8, 16, 32, 64].map((c, i) => [lattice(seed + i * 101, c), 0.5 ** i] as const);
  const r = octaves(7);
  const gch = octaves(91);
  const sum = (o: typeof r, x: number, y: number) => o.reduce((acc, [f, w]) => acc + f(x, y) * w, 0) / 1.875;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      data[i] = Math.round(sum(r, x, y) * 255);
      data[i + 1] = Math.round(sum(gch, x, y) * 255);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
let DETAIL: THREE.DataTexture | null = null;

/** shared by every tile: the clock that moves the waves, and the sky the sea reflects */
export const GLOBE_UNIFORMS = {
  uTime: { value: 0 },
  uSkyRefl: { value: new THREE.Color(0.05, 0.075, 0.12) },
};

/** a flat normal, for the moment before any heights are in */
const FLAT = (() => {
  const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();

/** relief exaggerated a little, so hills read from height as they do to the eye on the ground */
const RELIEF = 1.35;

/** surface normals from a 256² height grid, in the tile's east / north / up frame */
function reliefTexture(h: Float32Array, pxM: number) {
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  const at = (x: number, y: number) => h[Math.min(n - 1, Math.max(0, y)) * n + Math.min(n - 1, Math.max(0, x))];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // rows run north to south
      const dE = ((at(x + 1, y) - at(x - 1, y)) / (2 * pxM)) * RELIEF;
      const dN = ((at(x, y - 1) - at(x, y + 1)) / (2 * pxM)) * RELIEF;
      const len = Math.hypot(dE, dN, 1);
      const i = (y * n + x) * 4;
      data[i] = Math.round((-dE / len) * 127.5 + 127.5);
      data[i + 1] = Math.round((-dN / len) * 127.5 + 127.5);
      data[i + 2] = Math.round((1 / len) * 127.5 + 127.5);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

/**
 * Lit like the models (sun and sky light). The land is shaded per pixel from
 * the elevation, finer than its mesh, and up close a grain sharpens the soft
 * satellite pixels. The sea moves: wind-blown ripples catch the sun in a
 * glitter path and reflect the sky, more so at a glancing look. The sky's light
 * fades on the night side.
 */
function tileMaterial(map: THREE.Texture, relief: THREE.Texture, centre: THREE.Vector3) {
  DETAIL ??= detailTexture();
  const m = new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0, envMapIntensity: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.detailMap = { value: DETAIL };
    shader.uniforms.reliefMap = { value: relief };
    shader.uniforms.tileCentre = { value: centre };
    Object.assign(shader.uniforms, GLOBE_UNIFORMS);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        attribute float water;
        attribute vec2 duv;
        attribute vec2 ruv;
        uniform vec3 tileCentre;
        varying float vWater;
        varying vec2 vDuv;
        varying vec2 vRuv;
        varying vec3 vUp;
        varying vec3 vEast;
        varying vec3 vNorth;`,
      )
      .replace(
        "#include <begin_vertex>",
        // the local frame here (the Earth's up, not the slope's) in view space
        `#include <begin_vertex>
        vWater = water;
        vDuv = duv;
        vRuv = ruv;
        vec3 pE = position + tileCentre;
        vec3 upE = normalize(pE);
        vec3 eastE = normalize(vec3(-pE.y, pE.x, 0.0));
        vUp = normalize(mat3(modelViewMatrix) * upE);
        vEast = normalize(mat3(modelViewMatrix) * eastE);
        vNorth = normalize(mat3(modelViewMatrix) * cross(upE, eastE));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D detailMap;
        uniform sampler2D reliefMap;
        uniform float uTime;
        uniform vec3 uSkyRefl;
        varying float vWater;
        varying vec2 vDuv;
        varying vec2 vRuv;
        varying vec3 vUp;
        varying vec3 vEast;
        varying vec3 vNorth;
        float waveH(vec2 p) {
          return texture2D(detailMap, p * 3.0 + vec2(uTime * 0.011, uTime * 0.004)).r * 0.6
            + texture2D(detailMap, p * 11.0 - vec2(uTime * 0.017, -uTime * 0.021)).g * 0.3
            + texture2D(detailMap, p * 37.0 + vec2(-uTime * 0.05, uTime * 0.035)).r * 0.1;
        }`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          float near = 1.0 - smoothstep(900.0, 5000.0, length(vViewPosition));
          float grain = texture2D(detailMap, vDuv).r * 0.6 + texture2D(detailMap, vDuv * 8.0 + 0.37).g * 0.4;
          diffuseColor.rgb *= mix(1.0, 0.72 + 0.56 * grain, near * (1.0 - vWater));
        }
        // the masks are coarse: water only where the satellite also sees water (dark), not dry shore
        float wet = vWater * (1.0 - smoothstep(0.05, 0.14, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11))));`,
      )
      .replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        // calm close by, a broader shimmer far off where the ripples are too small to see
        roughnessFactor = mix(roughnessFactor, mix(0.07, 0.16, smoothstep(2000.0, 400000.0, length(vViewPosition))), wet);`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        {
          vec3 tn = texture2D(reliefMap, vRuv).xyz * 2.0 - 1.0;
          if (wet > 0.0) {
            // ripples: the slope of a moving height field, fading out with distance; the seabed's
            // relief (the elevation data has it) gives way to them across the shoreline
            float e = 0.004;
            vec2 p = vDuv;
            float h0 = waveH(p);
            float gx = (waveH(p + vec2(e, 0.0)) - h0) / e;
            float gy = (waveH(p + vec2(0.0, e)) - h0) / e;
            float k = 0.012 * (1.0 - smoothstep(3000.0, 60000.0, length(vViewPosition)));
            tn = normalize(mix(tn, normalize(vec3(-gx * k, gy * k, 1.0)), smoothstep(0.0, 0.5, wet)));
          }
          normal = normalize(normalize(vEast) * tn.x + normalize(vNorth) * tn.y + normalize(vUp) * tn.z);
        }`,
      )
      .replace(
        "#include <lights_fragment_maps>",
        `#if NUM_DIR_LIGHTS > 0
          irradiance *= smoothstep(-0.25, 0.12, dot(normalize(vUp), directionalLights[0].direction));
        #endif
        #include <lights_fragment_maps>`,
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          // the sky in the water, stronger at a glancing look, by day
          float cosV = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float fresnel = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
          float day = 1.0;
          #if NUM_DIR_LIGHTS > 0
            day = smoothstep(-0.1, 0.2, dot(normalize(vUp), directionalLights[0].direction));
          #endif
          outgoingLight += wet * fresnel * uSkyRefl * day;
        }
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => "globe-tile-2";
  return m;
}

/* --------------------------------------------------------------- tiles */

export type Frame = {
  camera: THREE.PerspectiveCamera;
  /** camera position, ECEF */
  eye: THREE.Vector3;
  ecefToWorld: THREE.Matrix4;
  frustum: THREE.Frustum;
  /** screen pixels per radian of view */
  pxPerRad: number;
};

export class GlobeTiles {
  readonly group = new THREE.Group();
  readonly water = new WaterMask();
  private roots: Tile[] = [];
  private all = new Map<string, Tile>();
  private loading = 0;
  private queue = new Set<Tile>();
  private shown: THREE.Mesh[] = [];
  private lastPrune = 0;
  private anisotropy = 4;
  /** tiles wanted but not in yet, for the "sharpening" hint */
  pending = 0;
  /** bumps whenever finer terrain arrives, so things draped on the ground can re-drape */
  terrainGen = 0;
  /** bumps whenever a tile's mesh is built: the drawn surface may have sharpened */
  surfaceGen = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.anisotropy = renderer.capabilities.getMaxAnisotropy();
    this.group.matrixAutoUpdate = false;
    const n = 2 ** ROOT_Z;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) this.roots.push(this.tile(ROOT_Z, x, y, null));
  }

  /** the root tiles: what the globe needs before it can show */
  get rootsReady() {
    return this.roots.filter((t) => t.mesh).length / this.roots.length;
  }

  private tile(z: number, x: number, y: number, parent: Tile | null): Tile {
    const key = `${z}/${x}/${y}`;
    const hit = this.all.get(key);
    if (hit) return hit;
    const west = tileLng(x, z);
    const east = tileLng(x + 1, z);
    const north = tileLat(y, z);
    const south = tileLat(y + 1, z);
    const t: Tile = {
      z, x, y, key, parent, children: null, west, east, north, south,
      center: new THREE.Vector3(), radius: 0,
      widthM: (east - west) * DEG * R * Math.cos(((north + south) / 2) * DEG),
      image: null, imageLoad: "idle", heights: null, relief: null, grid: null, terrainLoad: "idle",
      minH: -500, maxH: 9000, mesh: null, lastUsed: 0, lastWanted: 0, abort: null,
    };
    this.bound(t);
    this.all.set(key, t);
    return t;
  }

  /** bounding sphere over the tile's corners, edges and height range */
  private bound(t: Tile) {
    const midLat = tileLat(t.y + 0.5, t.z);
    const midLng = (t.west + t.east) / 2;
    const midH = (t.minH + t.maxH) / 2;
    ecef(midLng, midLat, midH, t.center);
    let r = 0;
    const p = new THREE.Vector3();
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]]) {
      const lng = t.west + (t.east - t.west) * u;
      const lat = tileLat(t.y + v, t.z);
      for (const h of [t.minH, t.maxH]) r = Math.max(r, ecef(lng, lat, h, p).distanceTo(t.center));
    }
    t.radius = r;
  }

  /* ------------------------------------------------------------ select */

  update(f: Frame) {
    const now = performance.now();
    for (const m of this.shown) m.visible = false;
    this.shown.length = 0;
    this.pending = 0;
    // the roots are the fallback for everything, seen or not: always keep them
    for (const root of this.roots) if (!root.mesh) this.want(root, now);
    for (const root of this.roots) this.visit(root, f, now);
    this.pump(f);
    if (now - this.lastPrune > 2000) {
      this.lastPrune = now;
      this.prune(now);
    }
  }

  private visible(t: Tile, f: Frame) {
    const c = t.center.clone().applyMatrix4(f.ecefToWorld);
    if (!f.frustum.intersectsSphere(new THREE.Sphere(c, t.radius))) return false;
    // behind the horizon: a point X on the sphere is seen from E when X·E ≥ R²
    if (t.z >= 3) {
      const dir = t.center.clone().normalize().multiplyScalar(R);
      if (dir.dot(f.eye) < R * R - t.radius * f.eye.length()) return false;
    }
    return true;
  }

  private visit(t: Tile, f: Frame, now: number) {
    t.lastUsed = now;
    if (!this.visible(t, f)) return;
    if (!t.mesh) {
      this.want(t, now);
      this.pending++;
      return;
    }
    if (t.z < MAX_Z && this.refine(t, f)) {
      if (!t.children) t.children = [0, 1, 2, 3].map((i) => this.tile(t.z + 1, t.x * 2 + (i % 2), t.y * 2 + (i >> 1), t));
      const kids = t.children;
      for (const k of kids) if (!k.mesh) this.want(k, now);
      if (kids.every((k) => k.mesh)) {
        for (const k of kids) this.visit(k, f, now);
        return;
      }
      this.pending++;
    }
    this.show(t);
  }

  private refine(t: Tile, f: Frame) {
    // past the imagery's finest zoom only the shape can sharpen: go one level further at most
    if (t.z > IMAGERY_MAX_Z) return false;
    const dist = Math.max(1, f.eye.distanceTo(t.center) - t.radius);
    const texelM = t.widthM / 256;
    return (texelM / dist) * f.pxPerRad > TEXEL_PX;
  }

  private show(t: Tile) {
    t.mesh!.visible = true;
    this.shown.push(t.mesh!);
  }

  /* ------------------------------------------------------------ loading */

  private want(t: Tile, now: number) {
    t.lastWanted = now;
    this.queue.add(t);
  }

  /** start the most useful loads: coarse tiles first, then nearest */
  private pump(f: Frame) {
    const now = performance.now();
    const list = [...this.queue].filter((t) => now - t.lastWanted < 1500);
    this.queue = new Set(list);
    list.sort((a, b) => a.z - b.z || a.center.distanceToSquared(f.eye) - b.center.distanceToSquared(f.eye));
    for (const t of list) {
      if (this.loading >= MAX_LOADS) break;
      if (t.mesh) {
        this.queue.delete(t);
        continue;
      }
      this.start(t);
    }
  }

  private start(t: Tile) {
    // parents first: a tile builds from its ancestors' data where it has none of its own
    if (t.parent && !t.parent.mesh) return;
    const needImage = t.z <= IMAGERY_MAX_Z && t.imageLoad === "idle";
    const needTerrain = t.z <= TERRAIN_MAX_Z && t.terrainLoad === "idle";
    if (!needImage && !needTerrain) {
      if (this.settled(t)) this.build(t);
      return;
    }
    t.abort = new AbortController();
    const signal = t.abort.signal;
    if (needImage) {
      t.imageLoad = "loading";
      this.loading++;
      fetchBitmap(IMAGERY(t.z, t.x, t.y), signal, true)
        .then((bmp) => {
          const tex = new THREE.Texture(bmp);
          tex.flipY = false;
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = this.anisotropy;
          tex.needsUpdate = true;
          t.image = tex;
          t.imageLoad = "done";
        })
        .catch(() => {
          t.imageLoad = signal.aborted ? "idle" : "error";
        })
        .finally(() => {
          this.loading--;
          if (this.settled(t)) this.build(t);
        });
    }
    if (needTerrain) {
      t.terrainLoad = "loading";
      this.loading++;
      fetchBitmap(TERRAIN(t.z, t.x, t.y), signal, false)
        .then((bmp) => {
          t.heights = decodeTerrain(bmp);
          t.relief = reliefTexture(t.heights, t.widthM / 256);
          t.terrainLoad = "done";
          this.terrainGen++;
        })
        .catch(() => {
          t.terrainLoad = signal.aborted ? "idle" : "error";
        })
        .finally(() => {
          this.loading--;
          if (this.settled(t)) this.build(t);
        });
    }
  }

  private settled(t: Tile) {
    const img = t.z > IMAGERY_MAX_Z || t.imageLoad === "done" || t.imageLoad === "error";
    const ter = t.z > TERRAIN_MAX_Z || t.terrainLoad === "done" || t.terrainLoad === "error";
    return img && ter && !t.mesh;
  }

  /* -------------------------------------------------------------- build */

  /** the texture this tile shows, and where in it the tile falls */
  private imagery(t: Tile): { tex: THREE.Texture; tile: Tile; scale: number; ox: number; oy: number } | null {
    let a: Tile | null = t;
    while (a && !a.image) a = a.parent;
    if (!a) return null;
    const scale = 2 ** (t.z - a.z);
    return { tex: a.image!, tile: a, scale, ox: t.x - a.x * scale, oy: t.y - a.y * scale };
  }

  /** a tile's imagery as a small pixel grid (sRGB bytes), cached, for reading colours on the CPU */
  private pixelsOf(t: Tile, n = 128): Uint8ClampedArray | null {
    const bmp = t.image?.image as ImageBitmap | undefined;
    if (!bmp) return null;
    let px = this.pixels.get(t);
    if (!px) {
      const ctx = new OffscreenCanvas(n, n).getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0, n, n);
      px = ctx.getImageData(0, 0, n, n).data;
      this.pixels.set(t, px);
    }
    return px;
  }

  private heightSource(t: Tile) {
    let a: Tile | null = t;
    while (a && !a.heights) a = a.parent;
    if (!a) return null;
    const scale = 2 ** (t.z - a.z);
    return { h: a.heights!, relief: a.relief!, scale, ox: t.x - a.x * scale, oy: t.y - a.y * scale };
  }

  private build(t: Tile) {
    const img = this.imagery(t);
    if (!img) return;
    const hs = this.heightSource(t);
    const n = SEG + 1;
    const edge = 4 * SEG;
    const count = n * n + edge;
    const pos = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const water = new Float32Array(count);
    const duv = new Float32Array(count * 2);
    const ruv = new Float32Array(count * 2);
    // the grain repeats a whole number of times per tile at every zoom, so it runs on across tiles
    const reps = 2 ** Math.max(0, 18 - t.z);
    const p = new THREE.Vector3();
    let minH = Infinity;
    let maxH = -Infinity;
    const heightAt = (u: number, v: number) => {
      if (!hs) return 0;
      const fx = ((hs.ox + u) / hs.scale) * 256 - 0.5;
      const fy = ((hs.oy + v) / hs.scale) * 256 - 0.5;
      return sample(hs.h, fx, fy);
    };
    // centre first, so vertices are stored relative to it
    const lngs: number[] = [];
    const lats: number[] = [];
    for (let i = 0; i < n; i++) lngs.push(t.west + ((t.east - t.west) * i) / SEG);
    for (let j = 0; j < n; j++) lats.push(tileLat(t.y + j / SEG, t.z));
    const hs2 = new Float32Array(n * n);
    // what the satellite sees at a vertex: is it water-dark?
    const px = this.pixelsOf(img.tile);
    const darkAt = (i: number, j: number) => {
      if (!px) return null;
      const u = (img.ox + i / SEG) / img.scale;
      const v = (img.oy + j / SEG) / img.scale;
      // decoded flipped: the first row is the tile's south edge
      const x = Math.min(127, Math.floor(u * 128));
      const y = Math.min(127, Math.floor((1 - v) * 128));
      const k = (y * 128 + x) * 4;
      return px[k] * 0.3 + px[k + 1] * 0.59 + px[k + 2] * 0.11 < 34;
    };
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        let w = this.water.at(lngs[i], lats[j]);
        let h = heightAt(i / SEG, j / SEG);
        // the masks are a kilometre coarse; the imagery is ten metres. Near the coast, ground the
        // satellite sees as water is sea, and the rest stands no lower than the sea, or the mask's
        // steps stand up as ledges and walls. Mask water the satellite sees as dry is land.
        const dark = darkAt(i, j);
        if (w === 0 && this.water.nearSea(lngs[i], lats[j])) {
          const shore = this.water.nearSea(lngs[i], lats[j], 1);
          if (h <= 0.5 || (dark === true && shore && h < 4)) w = 255;
          else h = Math.max(h, 0);
        } else if (w !== 0 && dark === false && t.z >= 9) {
          // a dry shore; by the sea it stands above it (lake shores keep their height: the Dead Sea's)
          if (w === 255) h = Math.max(h, 0.5);
          w = 0;
        }
        if (w === 255) h = 0; // the sea, at sea level
        water[k] = w > 0 ? 1 : 0;
        hs2[k] = h;
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
      }
    }
    t.minH = minH;
    t.maxH = maxH;
    t.grid = hs2;
    this.surfaceGen++;
    this.bound(t);
    const c = t.center;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        ecef(lngs[i], lats[j], hs2[k], p).sub(c);
        pos.set([p.x, p.y, p.z], k * 3);
        uv.set([(img.ox + i / SEG) / img.scale, 1 - (img.oy + j / SEG) / img.scale], k * 2);
        duv.set([(i / SEG) * reps, (j / SEG) * reps], k * 2);
        if (hs) ruv.set([(hs.ox + i / SEG) / hs.scale, (hs.oy + j / SEG) / hs.scale], k * 2);
      }
    }
    // skirts: a curtain hanging from each edge hides cracks against coarser neighbours
    const skirt = Math.max(30, t.widthM * 0.015);
    const ring: number[] = [];
    for (let i = 0; i < SEG; i++) ring.push(i); // north edge, west → east
    for (let j = 0; j < SEG; j++) ring.push(j * n + SEG); // east edge
    for (let i = SEG; i > 0; i--) ring.push(SEG * n + i); // south edge
    for (let j = SEG; j > 0; j--) ring.push(j * n); // west edge
    ring.forEach((src, e) => {
      const k = n * n + e;
      const i = src % n;
      const j = Math.floor(src / n);
      ecef(lngs[i], lats[j], hs2[src] - skirt, p).sub(c);
      pos.set([p.x, p.y, p.z], k * 3);
      uv.set([uv[src * 2], uv[src * 2 + 1]], k * 2);
      duv.set([duv[src * 2], duv[src * 2 + 1]], k * 2);
      ruv.set([ruv[src * 2], ruv[src * 2 + 1]], k * 2);
      water[k] = water[src];
    });
    const grid: number[] = [];
    for (let j = 0; j < SEG; j++) {
      for (let i = 0; i < SEG; i++) {
        const a = j * n + i;
        grid.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setAttribute("water", new THREE.BufferAttribute(water, 1));
    geo.setAttribute("duv", new THREE.BufferAttribute(duv, 2));
    geo.setAttribute("ruv", new THREE.BufferAttribute(ruv, 2));
    // normals from the surface alone, then the skirts borrow their edge's
    geo.setIndex(grid);
    geo.computeVertexNormals();
    const nor = geo.attributes.normal as THREE.BufferAttribute;
    ring.forEach((src, e) => nor.setXYZ(n * n + e, nor.getX(src), nor.getY(src), nor.getZ(src)));
    const all = [...grid];
    for (let e = 0; e < ring.length; e++) {
      const a = ring[e];
      const b = ring[(e + 1) % ring.length];
      const sa = n * n + e;
      const sb = n * n + ((e + 1) % ring.length);
      all.push(a, sa, b, b, sa, sb);
    }
    geo.setIndex(all);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, tileMaterial(img.tex, hs?.relief ?? FLAT, c.clone()));
    mesh.position.copy(c);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.visible = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // culled by the quadtree
    this.group.add(mesh);
    t.mesh = mesh;
  }

  /* -------------------------------------------------------------- prune */

  /** let go of tiles out of view for a while, finest first, keeping memory bounded */
  private prune(now: number) {
    const live = [...this.all.values()].filter((t) => t.mesh);
    if (live.length <= KEEP_TILES) return;
    const stale = live
      .filter((t) => t.z > ROOT_Z && now - t.lastUsed > 4000)
      .sort((a, b) => b.z - a.z || a.lastUsed - b.lastUsed);
    let over = live.length - KEEP_TILES;
    for (const t of stale) {
      if (over <= 0) break;
      over -= this.drop(t);
    }
  }

  private drop(t: Tile): number {
    let n = 0;
    for (const k of t.children ?? []) n += this.drop(k);
    t.abort?.abort();
    if (t.mesh) {
      this.group.remove(t.mesh);
      t.mesh.geometry.dispose();
      (t.mesh.material as THREE.Material).dispose();
      t.mesh = null;
      n++;
    }
    t.image?.dispose();
    (t.image?.image as ImageBitmap | undefined)?.close?.();
    t.image = null;
    t.heights = null;
    t.relief?.dispose();
    t.relief = null;
    t.grid = null;
    t.imageLoad = "idle";
    t.terrainLoad = "idle";
    t.children = null;
    this.all.delete(t.key);
    this.queue.delete(t);
    return n;
  }

  /* ------------------------------------------------------------ queries */

  /** the height of the surface as drawn (the finest tile with a mesh, its own triangles), or null */
  surfaceAt(lng: number, lat: number): number | null {
    return this.surfaceFrom(lng, lat, true) ?? this.surfaceFrom(lng, lat, false);
  }

  /** from the tile on screen here (shown), or the finest built at all */
  private surfaceFrom(lng: number, lat: number, shown: boolean): number | null {
    const n = SEG + 1;
    for (let z = MAX_Z; z >= ROOT_Z; z--) {
      const { x, y } = tileXY(lng, lat, z);
      const t = this.all.get(`${z}/${Math.floor(x)}/${Math.floor(y)}`);
      if (!t?.mesh || !t.grid || (shown && !t.mesh.visible)) continue;
      const gx = (x % 1) * SEG;
      const gy = (y % 1) * SEG;
      const i = Math.min(SEG - 1, Math.floor(gx));
      const j = Math.min(SEG - 1, Math.floor(gy));
      const fx = gx - i;
      const fy = gy - j;
      const g = t.grid;
      const h00 = g[j * n + i];
      const h01 = g[j * n + i + 1];
      const h10 = g[(j + 1) * n + i];
      const h11 = g[(j + 1) * n + i + 1];
      // the cell's two triangles split along the a+1 / a+n diagonal
      return fx + fy <= 1 ? h00 + (h01 - h00) * fx + (h10 - h00) * fy : h11 + (h10 - h11) * (1 - fx) + (h01 - h11) * (1 - fy);
    }
    return null;
  }

  /** ground height in metres: the sea at 0, else the finest terrain loaded here */
  heightAt(lng: number, lat: number): number {
    if (this.water.at(lng, lat) === 255) return 0;
    for (let z = TERRAIN_MAX_Z; z >= ROOT_Z; z--) {
      const { x, y } = tileXY(lng, lat, z);
      const t = this.all.get(`${z}/${Math.floor(x)}/${Math.floor(y)}`);
      if (t?.heights) return sample(t.heights, (x % 1) * 256 - 0.5, (y % 1) * 256 - 0.5);
    }
    return 0;
  }

  private pixels = new WeakMap<Tile, Uint8ClampedArray>();

  /** the imagery's colour at a place (sRGB, 0..1) and the zoom it came from, from the finest tile in */
  colourAt(lng: number, lat: number): { rgb: [number, number, number]; z: number } | null {
    const n = 128;
    for (let z = IMAGERY_MAX_Z; z >= ROOT_Z; z--) {
      const { x, y } = tileXY(lng, lat, z);
      const t = this.all.get(`${z}/${Math.floor(x)}/${Math.floor(y)}`);
      const px = t && this.pixelsOf(t);
      if (!px) continue;
      // decoded flipped: the bitmap's first row is the tile's south edge
      const i = Math.min(n - 1, Math.floor((x % 1) * n));
      const j = Math.min(n - 1, Math.floor((1 - (y % 1)) * n));
      const k = (j * n + i) * 4;
      return { rgb: [px[k] / 255, px[k + 1] / 255, px[k + 2] / 255], z };
    }
    return null;
  }

  dispose() {
    for (const r of this.roots) this.drop(r);
  }
}

/* -------------------------------------------------------------- helpers */

async function fetchBitmap(url: string, signal: AbortSignal, flip: boolean) {
  const res = await fetch(url, { signal, mode: "cors" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return createImageBitmap(await res.blob(), flip ? { imageOrientation: "flipY" } : undefined);
}

function decodeTerrain(bmp: ImageBitmap): Float32Array {
  const cv = new OffscreenCanvas(256, 256);
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const px = ctx.getImageData(0, 0, 256, 256).data;
  const h = new Float32Array(256 * 256);
  for (let i = 0; i < h.length; i++) h[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
  return h;
}

/** bilinear sample of a 256² height grid at fractional pixel (fx, fy) */
function sample(h: Float32Array, fx: number, fy: number) {
  const x0 = Math.max(0, Math.min(254, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(254, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - x0));
  const ty = Math.max(0, Math.min(1, fy - y0));
  const i = y0 * 256 + x0;
  const a = h[i] * (1 - tx) + h[i + 1] * tx;
  const b = h[i + 256] * (1 - tx) + h[i + 257] * tx;
  return a * (1 - ty) + b * ty;
}
