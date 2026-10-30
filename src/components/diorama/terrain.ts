import * as THREE from "three";

/**
 * The land itself, built as the camera nears: a tree of tiles over the
 * map's 32 chunks, each a mesh of 48 x 48 cells on real elevation (AWS
 * Terrain Tiles, streamed), split into four sharper tiles where its cells
 * would show on screen. From afar a tile wears Blender's render of the
 * model; close up the same land is lit live, its painted colour given the
 * grain of the ground — rock on the slopes, stony scrub on the hills, sand,
 * meadow, dry plain.
 *
 * Heights stay in metres on the GPU, so how much the land is exaggerated can
 * ease as the camera comes down: a model from above, the land as it is up
 * close. World units are km: x east, y up, z south.
 */

export type ModelParams = { vertical: number; seaVertical: number; seaFloor: number; peakEase: number };

export type ChunkInfo = { id: string; col: number; row: number; west: number; east: number; south: number; north: number };

const SEG = 48;
const MAX_LEVEL = 8;
const MAX_LOADS = 10;
const KEEP_TILES = 700;
/** a tile splits when its cells would cover more than this many pixels */
const CELL_PX = 5;
const SKIRT_KM = 1.2;
const TERRARIUM = (z: number, x: number, y: number) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

/* -------------------------------------------------------------- heights */

/** metres to model km, as the shader does it */
export function modelY(h: number, sea: boolean, e: number, p: ModelParams) {
  const k = e / p.vertical;
  if (sea) return -(Math.min(Math.max(-h, 3), -p.seaFloor) * p.seaVertical * k) / 1000 - 0.02 * k;
  const eased = h > 0 ? p.peakEase * Math.asinh(h / p.peakEase) : Math.max(h, -450);
  return (eased * e) / 1000;
}

export const MODEL_GLSL = /* glsl */ `
  uniform float uE;
  uniform vec4 uModel; // vertical, seaVertical, seaFloor, peakEase
  float asinhf(float x) { return log(x + sqrt(x * x + 1.0)); }
  float modelY(float h, float sea) {
    float k = uE / uModel.x;
    if (sea > 0.5) return -(min(max(-h, 3.0), -uModel.z) * uModel.y * k) / 1000.0 - 0.02 * k;
    float eased = h > 0.0 ? uModel.w * asinhf(h / uModel.w) : max(h, -450.0);
    return eased * uE / 1000.0;
  }
  float modelSlope(float h, float sea) {
    // d(model y)/d(h), km per metre
    if (sea > 0.5) return uModel.y * (uE / uModel.x) / 1000.0;
    return (h > 0.0 ? 1.0 / sqrt(1.0 + (h / uModel.w) * (h / uModel.w)) : 1.0) * uE / 1000.0;
  }
`;

/** one AWS Terrarium tile, decoded to metres */
class HeightSource {
  private tiles = new Map<string, { at: number; p: Promise<Float32Array | null> }>();

  get(z: number, x: number, y: number) {
    const key = `${z}/${x}/${y}`;
    const hit = this.tiles.get(key);
    if (hit) {
      hit.at = performance.now();
      return hit.p;
    }
    const p = fetch(TERRARIUM(z, x, y), { mode: "cors" })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => createImageBitmap(b))
      .then((bmp) => {
        const cv = new OffscreenCanvas(256, 256);
        const ctx = cv.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(bmp, 0, 0);
        bmp.close();
        const px = ctx.getImageData(0, 0, 256, 256).data;
        const h = new Float32Array(256 * 256);
        for (let i = 0; i < h.length; i++) h[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
        return h;
      })
      .catch(() => null);
    this.tiles.set(key, { at: performance.now(), p });
    if (this.tiles.size > 500) {
      const old = [...this.tiles.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100);
      for (const [k] of old) this.tiles.delete(k);
    }
    return p;
  }

  /** heights at a grid of places, sampled from the tiles of zoom z that cover them */
  async sample(z: number, lngs: Float64Array, lats: Float64Array, out: Float32Array, fallback: (lng: number, lat: number) => number) {
    const n = 2 ** z;
    const gx = new Float64Array(lngs.length);
    const gy = new Float64Array(lats.length);
    for (let i = 0; i < lngs.length; i++) gx[i] = ((lngs[i] + 180) / 360) * n * 256 - 0.5;
    for (let j = 0; j < lats.length; j++) {
      const la = (Math.max(-85, Math.min(85, lats[j])) * Math.PI) / 180;
      gy[j] = ((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n * 256 - 0.5;
    }
    const x0 = Math.floor(Math.min(...gx) / 256);
    const x1 = Math.floor((Math.max(...gx) + 1) / 256);
    const y0 = Math.floor(Math.min(...gy) / 256);
    const y1 = Math.floor((Math.max(...gy) + 1) / 256);
    const tiles = new Map<string, Float32Array | null>();
    await Promise.all(
      [...range(x0, x1)].flatMap((x) => [...range(y0, y1)].map(async (y) => tiles.set(`${x},${y}`, await this.get(z, x, y)))),
    );
    const at = (px: number, py: number) => {
      const tx = Math.floor(px / 256);
      const ty = Math.floor(py / 256);
      const t = tiles.get(`${tx},${ty}`);
      if (!t) return NaN;
      return t[(py - ty * 256) * 256 + (px - tx * 256)];
    };
    for (let j = 0; j < lats.length; j++) {
      for (let i = 0; i < lngs.length; i++) {
        const fx = gx[i];
        const fy = gy[j];
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = fx - ix;
        const ty = fy - iy;
        const a = at(ix, iy);
        const b = at(ix + 1, iy);
        const c = at(ix, iy + 1);
        const d = at(ix + 1, iy + 1);
        let h = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
        if (!Number.isFinite(h)) h = fallback(lngs[i], lats[j]);
        out[j * lngs.length + i] = h;
      }
    }
  }
}

function* range(a: number, b: number) {
  for (let i = a; i <= b; i++) yield i;
}

/* ---------------------------------------------------------------- tiles */

type Tile = {
  chunk: ChunkInfo;
  level: number;
  ix: number;
  iy: number;
  key: string;
  west: number;
  east: number;
  south: number;
  north: number;
  parent: Tile | null;
  children: Tile[] | null;
  mesh: THREE.Mesh | null;
  /** heights (metres) on the (SEG+3)^2 grid: the tile's own vertices plus a border for slopes */
  grid: Float32Array | null;
  minH: number;
  maxH: number;
  state: "idle" | "loading" | "ready";
  used: number;
  wanted: number;
};

export type Frame = { camera: THREE.PerspectiveCamera; frustum: THREE.Frustum; pxPerRad: number; e: number };

export type ChunkMaps = {
  render: THREE.Texture;
  renderXform: THREE.Vector4; // scale.xy, offset.xy within the texture
  albedo: THREE.Texture | null;
  albedoXform: THREE.Vector4;
};

/**
 * the tree of tiles. `toWorld(lng, lat)` gives x and z; `fallback(lng, lat)`
 * metres until the live heights come; `isSea` where the sea's floor is.
 */
export class Terrain {
  readonly group = new THREE.Group();
  readonly uniforms = {
    uE: { value: 7 },
    uModel: { value: new THREE.Vector4() },
    uNear: { value: new THREE.Vector2(140, 420) },
    uGroundA: { value: null as THREE.Texture | null },
    uGroundB: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    /** distance haze: colour, and the camera's distance to what it looks at */
    uHaze: { value: new THREE.Color(0.72, 0.66, 0.58) },
    uCamDist: { value: 1000 },
    /** world km to degrees: km per degree of longitude and latitude, and the map's centre */
    uLL: { value: new THREE.Vector4(93.4, 111.32, 33, 33) },
  };
  /** bumps when finer heights come in: draped things may re-drape */
  gen = 0;
  pending = 0;
  private roots: Tile[] = [];
  private all = new Map<string, Tile>();
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private depthMaterial: THREE.MeshDepthMaterial | null = null;
  private maps = new Map<string, ChunkMaps>();
  private heights = new HeightSource();
  private loading = 0;
  private queue = new Set<Tile>();
  private shown: THREE.Mesh[] = [];
  private lastPrune = 0;

  constructor(
    chunks: ChunkInfo[],
    readonly params: ModelParams,
    private toWorld: (lng: number, lat: number) => { x: number; z: number },
    private fallback: (lng: number, lat: number) => number,
    private isSea: (lng: number, lat: number) => boolean,
  ) {
    this.uniforms.uModel.value.set(params.vertical, params.seaVertical, params.seaFloor, params.peakEase);
    for (const c of chunks) {
      const t = this.tile(c, 0, 0, 0, null);
      this.roots.push(t);
    }
  }

  get ready() {
    return this.roots.every((t) => t.state === "ready");
  }

  private tile(chunk: ChunkInfo, level: number, ix: number, iy: number, parent: Tile | null): Tile {
    const key = `${chunk.id}/${level}/${ix}/${iy}`;
    const hit = this.all.get(key);
    if (hit) return hit;
    const n = 2 ** level;
    const w = (chunk.east - chunk.west) / n;
    const h = (chunk.north - chunk.south) / n;
    const t: Tile = {
      chunk, level, ix, iy, key,
      west: chunk.west + ix * w, east: chunk.west + (ix + 1) * w,
      north: chunk.north - iy * h, south: chunk.north - (iy + 1) * h,
      parent, children: null, mesh: null, grid: null, minH: -500, maxH: 5800,
      state: "idle", used: 0, wanted: 0,
    };
    this.all.set(key, t);
    return t;
  }

  /** the textures a chunk's tiles wear; swapped as sharper ones load */
  setMaps(chunkId: string, maps: ChunkMaps) {
    this.maps.set(chunkId, maps);
    const m = this.materials.get(chunkId);
    if (m) this.applyMaps(m, maps);
  }

  private applyMaps(m: THREE.MeshStandardMaterial, maps: ChunkMaps) {
    const u = m.userData.uniforms as Record<string, THREE.IUniform> | undefined;
    m.userData.maps = maps;
    if (!u) return;
    u.uRender.value = maps.render;
    u.uRenderX.value = maps.renderXform;
    u.uAlbedo.value = maps.albedo ?? maps.render;
    u.uAlbedoX.value = maps.albedo ? maps.albedoXform : maps.renderXform;
  }

  /* ---------------------------------------------------------- selection */

  update(f: Frame) {
    const now = performance.now();
    this.uniforms.uE.value = f.e;
    for (const m of this.shown) m.visible = false;
    this.shown.length = 0;
    this.pending = 0;
    for (const r of this.roots) {
      if (r.state !== "ready") this.want(r, now);
      this.visit(r, f, now);
    }
    this.pump(f.camera.position);
    if (now - this.lastPrune > 3000) {
      this.lastPrune = now;
      this.prune(now);
    }
  }

  private box(t: Tile, e: number) {
    const a = this.toWorld(t.west, t.north);
    const b = this.toWorld(t.east, t.south);
    const lo = modelY(t.minH, false, e, this.params) - (t.minH < 0 ? 8 : 0.2);
    const hi = modelY(t.maxH, false, e, this.params) + 0.2;
    return new THREE.Box3(new THREE.Vector3(a.x, lo, a.z), new THREE.Vector3(b.x, hi, b.z));
  }

  private visit(t: Tile, f: Frame, now: number) {
    t.used = now;
    const box = this.box(t, f.e);
    if (!f.frustum.intersectsBox(box)) return;
    if (!t.mesh) {
      this.want(t, now);
      this.pending++;
      return;
    }
    const dist = Math.max(0.05, box.distanceToPoint(f.camera.position));
    const cellKm = (box.max.x - box.min.x) / SEG;
    if (t.level < MAX_LEVEL && (cellKm / dist) * f.pxPerRad > CELL_PX) {
      if (!t.children) t.children = [0, 1, 2, 3].map((i) => this.tile(t.chunk, t.level + 1, t.ix * 2 + (i % 2), t.iy * 2 + (i >> 1), t));
      const kids = t.children;
      for (const k of kids) if (!k.mesh) this.want(k, now);
      if (kids.every((k) => k.mesh)) {
        for (const k of kids) this.visit(k, f, now);
        return;
      }
      this.pending++;
    }
    t.mesh.visible = true;
    this.shown.push(t.mesh);
  }

  private want(t: Tile, now: number) {
    t.wanted = now;
    if (t.state === "idle") this.queue.add(t);
  }

  private pump(eye: THREE.Vector3) {
    const now = performance.now();
    const list = [...this.queue].filter((t) => t.state === "idle" && now - t.wanted < 1500);
    this.queue = new Set(list);
    const centre = (t: Tile) => {
      const p = this.toWorld((t.west + t.east) / 2, (t.south + t.north) / 2);
      return (p.x - eye.x) ** 2 + (p.z - eye.z) ** 2;
    };
    list.sort((a, b) => a.level - b.level || centre(a) - centre(b));
    for (const t of list) {
      if (this.loading >= MAX_LOADS) break;
      if (t.parent && !t.parent.mesh) continue;
      this.queue.delete(t);
      void this.load(t);
    }
  }

  /* -------------------------------------------------------------- build */

  private async load(t: Tile) {
    t.state = "loading";
    this.loading++;
    try {
      const n = SEG + 3; // one cell of border all round, for slopes
      const dLng = (t.east - t.west) / SEG;
      const dLat = (t.north - t.south) / SEG;
      const lngs = new Float64Array(n);
      const lats = new Float64Array(n);
      for (let i = 0; i < n; i++) lngs[i] = t.west + (i - 1) * dLng;
      for (let j = 0; j < n; j++) lats[j] = t.north - (j - 1) * dLat;
      const spacingKm = ((t.east - t.west) * 111.32 * Math.cos((((t.north + t.south) / 2) * Math.PI) / 180)) / SEG;
      const lat = (t.north + t.south) / 2;
      const z = Math.max(3, Math.min(12, Math.ceil(Math.log2((40075 * Math.cos((lat * Math.PI) / 180)) / (256 * spacingKm)))));
      const grid = new Float32Array(n * n);
      await this.heights.sample(z, lngs, lats, grid, this.fallback);
      t.grid = grid;
      this.build(t);
      t.state = "ready";
      this.gen++;
    } catch {
      t.state = "idle";
    } finally {
      this.loading--;
    }
  }

  private build(t: Tile) {
    const g = t.grid!;
    const n = SEG + 3;
    const v = SEG + 1;
    const ring = 4 * SEG;
    const count = v * v + ring;
    const pos = new Float32Array(count * 3);
    const hm = new Float32Array(count);
    const sea = new Float32Array(count);
    const grad = new Float32Array(count * 2);
    const skirt = new Float32Array(count);
    const uv = new Float32Array(count * 2);
    const c = t.chunk;
    const dLng = (t.east - t.west) / SEG;
    const dLat = (t.north - t.south) / SEG;
    const a = this.toWorld(t.west, t.north);
    const b = this.toWorld(t.east, t.south);
    const dxKm = (b.x - a.x) / SEG;
    const dzKm = (b.z - a.z) / SEG;
    let minH = Infinity;
    let maxH = -Infinity;
    for (let j = 0; j < v; j++) {
      for (let i = 0; i < v; i++) {
        const k = j * v + i;
        const gi = (j + 1) * n + (i + 1);
        const h = g[gi];
        const lng = t.west + i * dLng;
        const lat = t.north - j * dLat;
        const w = this.toWorld(lng, lat);
        pos[k * 3] = w.x;
        pos[k * 3 + 2] = w.z;
        const s = h < 1 && this.isSea(lng, lat) ? 1 : 0;
        hm[k] = h;
        sea[k] = s;
        // slopes in metres per km of the map, east and south
        grad[k * 2] = (g[gi + 1] - g[gi - 1]) / (2 * dxKm);
        grad[k * 2 + 1] = (g[gi + n] - g[gi - n]) / (2 * dzKm);
        uv[k * 2] = (lng - c.west) / (c.east - c.west);
        uv[k * 2 + 1] = (c.north - lat) / (c.north - c.south);
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
      }
    }
    t.minH = minH;
    t.maxH = maxH;
    // skirts: a curtain from each edge, hiding cracks against coarser neighbours
    const edge: number[] = [];
    for (let i = 0; i < SEG; i++) edge.push(i);
    for (let j = 0; j < SEG; j++) edge.push(j * v + SEG);
    for (let i = SEG; i > 0; i--) edge.push(SEG * v + i);
    for (let j = SEG; j > 0; j--) edge.push(j * v);
    edge.forEach((src, e) => {
      const k = v * v + e;
      pos.set([pos[src * 3], 0, pos[src * 3 + 2]], k * 3);
      hm[k] = hm[src];
      sea[k] = sea[src];
      grad.set([grad[src * 2], grad[src * 2 + 1]], k * 2);
      uv.set([uv[src * 2], uv[src * 2 + 1]], k * 2);
      skirt[k] = 1;
    });
    const idx: number[] = [];
    for (let j = 0; j < SEG; j++) {
      for (let i = 0; i < SEG; i++) {
        const p = j * v + i;
        idx.push(p, p + v, p + 1, p + 1, p + v, p + v + 1);
      }
    }
    for (let e = 0; e < ring; e++) {
      const p = edge[e];
      const q = edge[(e + 1) % ring];
      const sp = v * v + e;
      const sq = v * v + ((e + 1) % ring);
      idx.push(p, sp, q, q, sp, sq);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("hm", new THREE.BufferAttribute(hm, 1));
    geo.setAttribute("sea", new THREE.BufferAttribute(sea, 1));
    geo.setAttribute("grad", new THREE.BufferAttribute(grad, 2));
    geo.setAttribute("skirt", new THREE.BufferAttribute(skirt, 1));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    // three needs a normal attribute to light it; the shader writes the real one
    geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(count * 3).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const mesh = new THREE.Mesh(geo, this.material(c.id));
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.castShadow = t.level >= 4;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = this.depth();
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    t.mesh = mesh;
  }

  /* ----------------------------------------------------------- material */

  private material(chunkId: string) {
    const hit = this.materials.get(chunkId);
    if (hit) return hit;
    const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, envMapIntensity: 0.15 });
    const shared = this.uniforms;
    m.onBeforeCompile = (shader) => {
      const own = {
        uRender: { value: null as THREE.Texture | null },
        uRenderX: { value: new THREE.Vector4(1, 1, 0, 0) },
        uAlbedo: { value: null as THREE.Texture | null },
        uAlbedoX: { value: new THREE.Vector4(1, 1, 0, 0) },
      };
      Object.assign(shader.uniforms, shared, own);
      m.userData.uniforms = shader.uniforms;
      const maps = m.userData.maps as ChunkMaps | undefined;
      if (maps) this.applyMaps(m, maps);
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
          ${MODEL_GLSL}
          attribute float hm;
          attribute float sea;
          attribute vec2 grad;
          attribute float skirt;
          varying vec2 vUvC;
          varying vec3 vWorld;
          varying float vH;
          varying float vSea;`,
        )
        .replace(
          "#include <beginnormal_vertex>",
          `float ky = modelSlope(hm, sea);
          vec3 objectNormal = normalize(vec3(-grad.x * ky, 1.0, -grad.y * ky));`,
        )
        .replace(
          "#include <begin_vertex>",
          `vec3 transformed = vec3(position.x, modelY(hm, sea) - skirt * ${SKIRT_KM.toFixed(2)}, position.z);
          vUvC = uv;
          vH = hm;
          vSea = sea;
          vWorld = transformed;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          uniform sampler2D uRender;
          uniform vec4 uRenderX;
          uniform sampler2D uAlbedo;
          uniform vec4 uAlbedoX;
          uniform sampler2D uGroundA;
          uniform sampler2D uGroundB;
          uniform vec2 uNear;
          uniform float uE;
          uniform vec3 uHaze;
          uniform float uCamDist;
          uniform vec4 uLL;
          varying vec2 vUvC;
          varying vec3 vWorld;
          varying float vH;
          varying float vSea;
          // the scatter's noise (scatter.ts), the same lattice and hash, so the ground darkens under its groves
          float h2(vec2 c) {
            uvec2 u = uvec2(ivec2(c));
            uint h = u.x * 374761393u + u.y * 668265263u;
            h = (h ^ (h >> 13u)) * 1274126177u;
            h ^= h >> 16u;
            return float(h) / 4294967296.0;
          }
          float vnoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = p - i;
            vec2 w = f * f * (3.0 - 2.0 * f);
            return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), w.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), w.x), w.y);
          }
          vec4 groundA(vec2 p) {
            // two scales, the second turned, so the repeat never lines up
            vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p * 0.31 + 0.17;
            return mix(texture2D(uGroundA, p), texture2D(uGroundA, q), 0.45);
          }
          float groundB(vec2 p) {
            vec2 q = mat2(0.8, -0.6, 0.6, 0.8) * p * 0.31 + 0.53;
            return mix(texture2D(uGroundB, p).r, texture2D(uGroundB, q).r, 0.45);
          }`,
        )
        .replace(
          "#include <map_fragment>",
          `vec3 albedo = texture2D(uAlbedo, vUvC * uAlbedoX.xy + uAlbedoX.zw).rgb;
          float viewKm = length(vViewPosition);
          float near = 1.0 - smoothstep(uNear.x, uNear.y, viewKm);
          {
            // the ground's grain, by what the land is: cliff, stony hill, meadow, sand, plain
            vec3 nW = normalize(vNormal);
            float slope = 1.0 - clamp(abs(dot(normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz), nW)), 0.0, 1.0);
            float lum = dot(albedo, vec3(0.3, 0.59, 0.11));
            // as the scatter reads the painting (in its stored, sRGB, values): watered ground is as green
            // as it is red, and dark; the paler the rest, the barer
            vec3 srgb = pow(albedo, vec3(1.0 / 2.2));
            float sLum = dot(srgb, vec3(0.3, 0.59, 0.11));
            float green = smoothstep(-0.04, 0.0, srgb.g - srgb.r) * (1.0 - smoothstep(0.46, 0.56, sLum));
            float veg = clamp((0.68 - sLum) / 0.25, 0.0, 1.0);
            // sand only where it is flat, bright and yellow: open desert, dunes, beaches
            float sandy = smoothstep(0.05, 0.14, 0.5 * (albedo.r + albedo.g) - albedo.b) * smoothstep(0.32, 0.5, lum) * (1.0 - smoothstep(0.015, 0.05, slope));
            float rock = smoothstep(0.16, 0.38, slope);
            float hill = smoothstep(0.03, 0.12, slope) * (1.0 - rock);
            float rest = max(0.0, 1.0 - rock - hill);
            float wGreen = rest * green;
            float wSand = rest * (1.0 - green) * sandy;
            float wPlain = max(0.0, rest - wGreen - wSand);
            // repeats every ~300 m and, finer, every ~40 m
            vec2 p1 = vWorld.xz / 0.3;
            vec2 p2 = vWorld.xz / 0.04;
            vec4 a = groundA(p1) * 0.6 + groundA(p2) * 0.4;
            float b = groundB(p1) * 0.6 + groundB(p2) * 0.4;
            float grain = rock * a.r + hill * a.g + wGreen * a.b + wSand * a.a + wPlain * b - 0.5;
            // the finer the view, the more the grain shows
            float show = smoothstep(uNear.y, uNear.x * 0.15, viewKm);
            // close up the painting's colours give way to the land's own: quieter, limestone-pale on the hills
            float close = 1.0 - smoothstep(4.0, 60.0, viewKm);
            vec3 grey = vec3(dot(albedo, vec3(0.33)));
            vec3 land = mix(albedo, grey * vec3(1.06, 1.0, 0.9), 0.32 * close);
            land = mix(land, land * 1.12 + 0.03, (hill + rock) * 0.35 * close);
            vec3 col = land * (1.0 + grain * 0.75 * show);
            // patches of scrub and bare ground across the hills, and shade and leaf litter under the groves
            vec2 ll = vec2(vWorld.x / uLL.x + uLL.z, -vWorld.z / uLL.y + uLL.w);
            float grove = smoothstep(0.36, 0.72, 0.6 * vnoise(ll * 620.0) + 0.4 * vnoise(ll * 1900.0 + vec2(17.0, 5.0)));
            float patches = vnoise(ll * 90.0) * 0.6 + vnoise(ll * 300.0 + 7.0) * 0.4;
            // ~40 m and ~15 m
            float fine = vnoise(ll * 2600.0) * 0.6 + vnoise(ll * 7000.0 + 3.0) * 0.4;
            float lush = max(veg, green);
            // the land's own colours: red soil, dark maquis, pale limestone breaking through
            float own = close * (1.0 - wSand);
            col = mix(col, vec3(0.28, 0.17, 0.1) * (0.8 + 0.4 * patches), smoothstep(0.45, 0.8, patches) * veg * 0.3 * own);
            col = mix(col, vec3(0.13, 0.15, 0.07) * (0.8 + 0.5 * fine), smoothstep(0.4, 0.8, fine * 0.6 + grove * 0.6) * lush * 0.65 * own);
            col = mix(col, vec3(0.42, 0.39, 0.34) * (0.85 + 0.3 * fine), smoothstep(0.66, 0.86, fine + (1.0 - veg) * 0.12) * (0.2 + hill + rock) * 0.3 * own);
            col *= 1.0 + (patches - 0.5) * 0.3 * close;
            col = mix(col, col * vec3(0.66, 0.72, 0.6), grove * lush * 0.6 * close * (1.0 - rock));
            {
              // terraces on the farmed hills: a step every few metres of height, its stone riser in shade;
              // gone where they would crowd to under a few pixels
              float tz = vH / 3.2 + vnoise(ll * 1500.0) * 0.6;
              float aa = fwidth(tz);
              float f = fract(tz);
              float riser = smoothstep(0.0, aa * 1.5 + 0.02, f) * (1.0 - smoothstep(0.16, 0.18 + aa * 1.5, f));
              float where = smoothstep(0.004, 0.015, slope) * (1.0 - smoothstep(0.1, 0.2, slope))
                * smoothstep(0.15, 0.4, veg) * smoothstep(0.35, 0.6, vnoise(ll * 160.0 + 11.0))
                * (1.0 - smoothstep(900.0, 1100.0, vH)) * (1.0 - smoothstep(0.3, 0.6, aa));
              col = mix(col, col * 0.7, riser * where * close);
            }
            // bare rock greys a little where it is steep
            col = mix(col, vec3(dot(col, vec3(0.33))) * vec3(1.02, 0.98, 0.93), rock * 0.25 * show);
            diffuseColor.rgb = col;
          }`,
        )
        .replace(
          "#include <opaque_fragment>",
          `{
            // far off, the model as Blender rendered it; near, the land lit as it is now
            vec3 baked = texture2D(uRender, vUvC * uRenderX.xy + uRenderX.zw).rgb;
            // the far land hazes, as it does across real distance (only once the camera is down among it)
            float haze = smoothstep(uCamDist * 1.6, uCamDist * 14.0 + 20.0, viewKm) * (1.0 - smoothstep(60.0, 400.0, uCamDist)) * 0.6;
            outgoingLight = mix(outgoingLight, uHaze * 0.9, haze);
            outgoingLight = mix(baked * 1.02, outgoingLight, near);
          }
          #include <opaque_fragment>`,
        );
    };
    m.customProgramCacheKey = () => "diorama-terrain";
    const maps = this.maps.get(chunkId);
    if (maps) m.userData.maps = maps;
    this.materials.set(chunkId, m);
    return m;
  }

  /** the shadow pass sees the land as drawn, displaced the same way */
  private depth() {
    if (this.depthMaterial) return this.depthMaterial;
    const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    const shared = this.uniforms;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, shared);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${MODEL_GLSL}\nattribute float hm;\nattribute float sea;\nattribute float skirt;`)
        .replace(
          "#include <begin_vertex>",
          `vec3 transformed = vec3(position.x, modelY(hm, sea) - skirt * ${SKIRT_KM.toFixed(2)}, position.z);`,
        );
    };
    m.customProgramCacheKey = () => "diorama-terrain-depth";
    this.depthMaterial = m;
    return m;
  }

  /* -------------------------------------------------------------- query */

  /** metres at a place: from the finest tile loaded there, else the fallback */
  metresAt(lng: number, lat: number): number {
    let best: Tile | null = null;
    for (const r of this.roots) {
      if (lng < r.west || lng > r.east || lat < r.south || lat > r.north) continue;
      let t: Tile | null = r;
      while (t) {
        if (t.grid) best = t;
        const kids: Tile[] | null = t.children;
        if (!kids) break;
        t = kids.find((k) => lng >= k.west && lng <= k.east && lat >= k.south && lat <= k.north) ?? null;
      }
    }
    if (!best?.grid) return this.fallback(lng, lat);
    const n = SEG + 3;
    const fx = ((lng - best.west) / (best.east - best.west)) * SEG + 1;
    const fy = ((best.north - lat) / (best.north - best.south)) * SEG + 1;
    const ix = Math.max(0, Math.min(n - 2, Math.floor(fx)));
    const iy = Math.max(0, Math.min(n - 2, Math.floor(fy)));
    const tx = fx - ix;
    const ty = fy - iy;
    const g = best.grid;
    const a = g[iy * n + ix] * (1 - tx) + g[iy * n + ix + 1] * tx;
    const b = g[(iy + 1) * n + ix] * (1 - tx) + g[(iy + 1) * n + ix + 1] * tx;
    return a * (1 - ty) + b * ty;
  }

  /* -------------------------------------------------------------- prune */

  private prune(now: number) {
    const live = [...this.all.values()].filter((t) => t.mesh);
    if (live.length <= KEEP_TILES) return;
    const stale = live.filter((t) => t.level > 0 && now - t.used > 5000).sort((a, b) => b.level - a.level || a.used - b.used);
    let over = live.length - KEEP_TILES;
    for (const t of stale) {
      if (over <= 0) break;
      over -= this.drop(t);
    }
  }

  private drop(t: Tile): number {
    let n = 0;
    for (const k of t.children ?? []) n += this.drop(k);
    if (t.mesh) {
      this.group.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh = null;
      n++;
    }
    t.grid = null;
    t.children = null;
    t.state = "idle";
    this.all.delete(t.key);
    this.queue.delete(t);
    return n;
  }

  dispose() {
    for (const r of this.roots) this.drop(r);
    for (const m of this.materials.values()) m.dispose();
    this.depthMaterial?.dispose();
  }
}
