import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  BrightnessContrastEffect,
  ChromaticAberrationEffect,
  HueSaturationEffect,
  DepthOfFieldEffect,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
  BlendFunction,
} from "postprocessing";
import type { LngLat } from "@/data/journeys";
import { DioramaCache } from "./cache";
import { backdrop, dust, lightShafts, plinth, slabSides } from "./studio";

/**
 * The diorama: a relief model of the biblical world, from the Nile to the
 * Caspian and Italy to Arabia, sculpted and lit in Blender
 * (`blender/diorama.py`, built by `scripts/build-diorama.py`) and set out
 * here like a museum piece: on a plinth, under a warm studio light, its seas
 * cast in clear resin, dust turning in the light over it.
 *
 * The land carries Blender's render as its texture — shading, cast shadows
 * and colour baked in, as a painted model's are — so it is drawn unlit; the
 * key light that lit the render lights the structures standing on it, so
 * they match. Each chunk's texture sharpens as the camera nears.
 *
 * World units are kilometres from the map's centre: x east, y up, z south.
 * It offers what the explorer needs from a map: projected DOM markers, draped
 * route lines and a camera that flies between MapLibre-style poses.
 */

export type Padding = { top: number; bottom: number; left: number; right: number };
export type Pose = { center: LngLat; zoom: number; pitch: number; bearing: number };
export type Anchor = "center" | "top" | "bottom" | "left" | "right";
export type LoadProgress = { fraction: number; phase: "map" | "ready"; sharpening: number };
type LineStyle = { color: string | number; width: number; opacity?: number; dashed?: boolean; dash?: [number, number] };

type ChunkMeta = { id: string; col: number; row: number; west: number; south: number; east: number; north: number; mesh: string; l1: string; l2?: string };
type Meta = {
  version: number;
  west: number;
  south: number;
  east: number;
  north: number;
  grid: [number, number];
  refLat: number;
  vertical: number;
  sun: { azimuth: number; elevation: number };
  preview: string;
  height: { path: string; offset: number; scale: number };
  sea: string;
  chunks: ChunkMeta[];
};

type Chunk = {
  meta: ChunkMeta;
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  previewMap: THREE.Texture;
  box: THREE.Box3;
  level: number;
  loading: number;
  textures: [null, THREE.Texture | null, THREE.Texture | null];
  wanted: [number, number, number];
};

const FOV = 32;
/** as close as the camera comes: where the finest textures still give a texel a pixel */
export const MIN_DISTANCE = 170;
export const MAX_DISTANCE = 5200;
/** the zoom (MapLibre sense) to camera distance: kept from the earlier maps so journey framing carries over */
const ZOOM_K = 72000;
const LINE_LIFT = 0.35;
/** the cut sides go down to here, km: a block, not a board */
const BOTTOM = -110;

const ANCHORS: Record<Anchor, string> = {
  center: "translate(-50%, -50%)",
  top: "translate(-50%, 0)",
  bottom: "translate(-50%, -100%)",
  left: "translate(0, -50%)",
  right: "translate(-100%, -50%)",
};

/** a DOM element pinned to a place on the model */
export class DioramaMarker {
  readonly wrap: HTMLDivElement;
  lngLat: LngLat = [0, 0];
  readonly world = new THREE.Vector3();
  private stage: DioramaStage | null = null;

  constructor(
    readonly element: HTMLElement,
    readonly opts: { anchor?: Anchor; offset?: [number, number]; lift?: number; interactive?: boolean } = {},
  ) {
    this.wrap = document.createElement("div");
    this.wrap.style.cssText = "position:absolute;left:0;top:0;will-change:transform;pointer-events:none;";
    if (opts.interactive !== false) element.style.pointerEvents = "auto";
    this.wrap.appendChild(element);
  }

  setLngLat(ll: LngLat) {
    this.lngLat = ll;
    this.stage?.place(this);
    return this;
  }

  addTo(stage: DioramaStage) {
    this.stage = stage;
    stage.addMarker(this);
    return this;
  }

  remove() {
    this.stage?.removeMarker(this);
    this.stage = null;
  }

  position(x: number, y: number, depth: number, visible: boolean) {
    const [ox, oy] = this.opts.offset ?? [0, 0];
    this.wrap.style.transform = `translate(${(x + ox).toFixed(1)}px, ${(y + oy).toFixed(1)}px) ${ANCHORS[this.opts.anchor ?? "center"]}`;
    this.wrap.style.visibility = visible ? "visible" : "hidden";
    this.wrap.style.zIndex = String(Math.round(100000 - depth));
  }
}

type Orbit = { target: THREE.Vector3; dist: number; polar: number; azim: number };
type Flight = { from: Orbit; to: Orbit; peak: number; start: number; dur: number; onEnd?: () => void };

export class DioramaStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly overlay: HTMLDivElement;
  readonly key: THREE.DirectionalLight;
  readonly ready: Promise<void>;
  /** the map's frame, once meta.json is in */
  bounds = { west: 10, south: 22, east: 56, north: 44 };
  refLat = 33;
  vertical = 7;

  private composer: EffectComposer;
  private dof: DepthOfFieldEffect;
  private meta: Meta | null = null;
  private cache: DioramaCache | null = null;
  private chunks: Chunk[] = [];
  private preview: THREE.Texture | null = null;
  private heights: Float32Array | null = null;
  private hw = 0;
  private hh = 0;
  /** 1 where the sea (and its resin) is, rows north to south */
  private seaMask: Uint8Array | null = null;
  private sw = 0;
  private sh = 0;
  private markers = new Set<DioramaMarker>();
  private lines = new Map<string, { lines: Line2[]; coords: LngLat[][]; style: LineStyle; visible: boolean }>();
  private lineMats = new Set<LineMaterial>();
  private flight: Flight | null = null;
  private frameFns = new Set<() => void>();
  private userMoveFns = new Set<() => void>();
  private progressFns = new Set<(p: LoadProgress) => void>();
  private progress: LoadProgress = { fraction: 0, phase: "map", sharpening: 0 };
  private padding: Padding = { top: 0, bottom: 0, left: 0, right: 0 };
  private studio: { backdrop: THREE.Mesh; shafts: THREE.Mesh; dust: THREE.Points | null } ;
  private bodyGroup = new THREE.Group();
  private resizeObs: ResizeObserver;
  private raf = 0;
  private disposed = false;
  private lastStream = 0;
  private frustum = new THREE.Frustum();
  private start = performance.now();

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", stencil: false });
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;";
    container.appendChild(this.renderer.domElement);

    this.overlay = document.createElement("div");
    this.overlay.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;isolation:isolate;z-index:0;";
    container.appendChild(this.overlay);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 2, 40000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = MIN_DISTANCE;
    c.maxDistance = MAX_DISTANCE;
    c.minPolarAngle = 0.05;
    c.maxPolarAngle = 1.32;
    c.screenSpacePanning = false;
    c.zoomSpeed = 0.9;
    c.rotateSpeed = 0.6;
    c.addEventListener("start", () => {
      this.flight = null;
      for (const fn of this.userMoveFns) fn();
    });

    // the studio: a warm key light from the north-west (where the render's sun was), a soft fill,
    // and a room for glossy things to reflect
    this.key = new THREE.DirectionalLight(0xfff1dc, 3.0);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0005;
    this.key.shadow.normalBias = 0.6;
    this.scene.add(this.key, this.key.target);
    this.scene.add(new THREE.HemisphereLight(0xf2e6d4, 0x3a2c20, 0.9));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pmrem.dispose();

    const back = backdrop();
    const shafts = lightShafts();
    this.scene.add(back, shafts);
    this.studio = { backdrop: back, shafts, dust: null };
    this.scene.add(this.bodyGroup);

    // the lens: shallow focus on what you look at, a vignette, a little grain and fringing
    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType, multisampling: dpr > 1.25 ? 2 : 4 });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.dof = new DepthOfFieldEffect(this.camera, { focusDistance: 500, focusRange: 400, bokehScale: 0.65, resolutionScale: 0.5 });
    this.dof.target = this.controls.target;
    const noise = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
    noise.blendMode.opacity.value = 0.09;
    const grade = new EffectPass(
      this.camera,
      this.dof,
      new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0004), radialModulation: true, modulationOffset: 0.3 }),
      // a painted model's colours, a little quieter than the satellite's
      new HueSaturationEffect({ saturation: -0.16 }),
      new BrightnessContrastEffect({ contrast: 0.06 }),
      new VignetteEffect({ offset: 0.32, darkness: 0.62 }),
      noise,
      new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    );
    this.composer.addPass(grade);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    // the whole model on its plinth, seen from the front
    this.jumpTo({ center: [33, 33.4], zoom: 3.85, pitch: 54, bearing: -10 });
    this.ready = this.load();
    this.loop();
  }

  /* -------------------------------------------------------------- loading */

  onProgress(fn: (p: LoadProgress) => void) {
    this.progressFns.add(fn);
    fn(this.progress);
    return () => void this.progressFns.delete(fn);
  }

  private report(p: Partial<LoadProgress>) {
    const next = { ...this.progress, ...p };
    if (next.fraction === this.progress.fraction && next.phase === this.progress.phase && next.sharpening === this.progress.sharpening) return;
    this.progress = next;
    for (const fn of this.progressFns) fn(next);
  }

  private async load() {
    const meta: Meta = await fetch("/diorama/meta.json", { cache: "no-cache" }).then((r) => r.json());
    if (this.disposed) return;
    this.meta = meta;
    this.bounds = { west: meta.west, south: meta.south, east: meta.east, north: meta.north };
    this.refLat = meta.refLat;
    this.vertical = meta.vertical;
    this.cache = new DioramaCache(meta.version);
    this.aimKey(meta.sun.azimuth, meta.sun.elevation);

    // the first load: heights, the whole-map preview and every chunk's mesh
    const parts = new Map<string, [number, number]>();
    const tell = (k: string) => (l: number, t: number) => {
      parts.set(k, [l, t]);
      let a = 0;
      let b = 0;
      for (const [x, y] of parts.values()) {
        a += x;
        b += y;
      }
      this.report({ fraction: b ? Math.min(0.99, a / b) : 0, phase: "map" });
    };
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const big = this.renderer.capabilities.maxTextureSize >= 8192;
    const [heightBmp, previewBmp, seaBmp, meshes] = await Promise.all([
      this.cache.bitmap(meta.height.path, undefined, tell("h")),
      this.cache.bitmap(big ? meta.preview : meta.preview.replace(".webp", "-2k.webp"), undefined, tell("p")),
      this.cache.bitmap(meta.sea, { imageOrientation: "flipY" }, tell("s")),
      Promise.all(
        meta.chunks.map(async (c) => {
          const blob = await this.cache!.blob(c.mesh, tell(c.id));
          const gltf = await loader.parseAsync(await blob.arrayBuffer(), "");
          let mesh: THREE.Mesh | null = null;
          gltf.scene.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
          });
          return mesh! as THREE.Mesh;
        }),
      ),
    ]);
    if (this.disposed) return;
    this.decodeHeights(heightBmp, meta.height.offset, meta.height.scale);
    this.preview = this.texture(previewBmp);
    meta.chunks.forEach((c, i) => this.addChunk(c, meshes[i]));
    this.decodeSea(seaBmp);
    this.buildSea(seaBmp);
    this.buildBody();
    for (const m of this.markers) this.place(m);
    for (const [id, set] of this.lines) this.setLines(id, set.coords, set.style);
    this.report({ fraction: 1, phase: "ready" });
    setTimeout(() => void this.prefetch(), 5000);
  }

  private texture(img: ImageBitmap, flip = false) {
    const t = new THREE.Texture(img);
    t.flipY = flip;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    t.needsUpdate = true;
    return t;
  }

  private decodeHeights(img: ImageBitmap, offset: number, scale: number) {
    const cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, img.width, img.height).data;
    const h = new Float32Array(img.width * img.height);
    for (let i = 0; i < h.length; i++) h[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / scale - offset;
    this.heights = h;
    this.hw = img.width;
    this.hh = img.height;
    img.close();
  }

  /** the mask was decoded flipped for its texture: read its rows back the other way */
  private decodeSea(img: ImageBitmap) {
    const cv = document.createElement("canvas");
    cv.width = img.width;
    cv.height = img.height;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, img.width, img.height).data;
    const m = new Uint8Array(img.width * img.height);
    for (let y = 0; y < img.height; y++) {
      const src = (img.height - 1 - y) * img.width;
      for (let x = 0; x < img.width; x++) m[y * img.width + x] = px[(src + x) * 4] > 127 ? 1 : 0;
    }
    this.seaMask = m;
    this.sw = img.width;
    this.sh = img.height;
  }

  isSea(lng: number, lat: number) {
    if (!this.seaMask) return false;
    const { west, south, east, north } = this.bounds;
    const x = Math.min(this.sw - 1, Math.max(0, Math.floor(((lng - west) / (east - west)) * this.sw)));
    const y = Math.min(this.sh - 1, Math.max(0, Math.floor(((north - lat) / (north - south)) * this.sh)));
    return this.seaMask[y * this.sw + x] === 1;
  }

  private addChunk(c: ChunkMeta, mesh: THREE.Mesh) {
    const meta = this.meta!;
    const cols = Math.max(...meta.chunks.map((k) => k.col)) + 1;
    const rows = Math.max(...meta.chunks.map((k) => k.row)) + 1;
    const map = this.preview!.clone();
    map.repeat.set(1 / cols, 1 / rows);
    map.offset.set(c.col / cols, c.row / rows);
    map.needsUpdate = true;
    // the land is the render: drawn as it was lit
    const material = new THREE.MeshBasicMaterial({ map });
    mesh.material = material;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.geometry.computeBoundingBox();
    this.scene.add(mesh);
    this.chunks.push({
      meta: c,
      mesh,
      material,
      previewMap: map,
      box: mesh.geometry.boundingBox!.clone(),
      level: 0,
      loading: 0,
      textures: [null, null, null],
      wanted: [0, 0, 0],
    });
  }

  /** the seas, cast in clear resin over the painted sea floor */
  private buildSea(mask: ImageBitmap) {
    const { width, height } = this.size();
    // decoded flipped, so its first row is the south edge, where the plane's v starts
    const alpha = new THREE.Texture(mask);
    alpha.flipY = false;
    alpha.needsUpdate = true;
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x0f3b4a,
      transparent: true,
      opacity: 0.38,
      alphaMap: alpha,
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.4,
      depthWrite: false,
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 1, 1), mat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = 0.0;
    sea.renderOrder = 2;
    this.bodyGroup.add(sea);
  }

  /** the model's cut sides, its plinth, and the dust in the air over it */
  private buildBody() {
    const { west, south, east, north } = this.bounds;
    const edge: { x: number; z: number; ground: number }[] = [];
    const steps = 360;
    const at = (lng: number, lat: number) => {
      const p = this.world([lng, lat]);
      edge.push({ x: p.x, z: p.z, ground: this.groundAt(lng, lat) });
    };
    // clockwise seen from above: along the north edge east, down the east, back west, up the west
    for (let i = 0; i <= steps; i++) at(west + ((east - west) * i) / steps, north);
    for (let i = 1; i <= steps / 2; i++) at(east, north - ((north - south) * i) / (steps / 2));
    for (let i = 1; i <= steps; i++) at(east - ((east - west) * i) / steps, south);
    for (let i = 1; i <= steps / 2; i++) at(west, south + ((north - south) * i) / (steps / 2));
    const sides = slabSides(edge, BOTTOM);
    (sides.material as THREE.Material).side = THREE.DoubleSide;
    this.bodyGroup.add(sides);
    const { width, height } = this.size();
    this.bodyGroup.add(plinth(width, height, BOTTOM));
    const box = new THREE.Box3(new THREE.Vector3(-width * 0.7, 30, -height * 0.8), new THREE.Vector3(width * 0.7, 1600, height * 0.8));
    this.studio.dust = dust(box);
    this.scene.add(this.studio.dust);
  }

  /** after the first view, the sharper textures into the cache, one at a time */
  private async prefetch() {
    if (!this.cache || !this.meta) return;
    for (const c of this.meta.chunks) {
      for (const p of [c.l1, c.l2]) {
        if (this.disposed) return;
        if (p) await this.cache.warm(p);
      }
    }
  }

  /* ------------------------------------------------------------ geography */

  private size() {
    const { west, south, east, north } = this.bounds;
    const kmLng = 111.32 * Math.cos((this.refLat * Math.PI) / 180);
    return { width: (east - west) * kmLng, height: (north - south) * 111.32, kmLng, kmLat: 111.32 };
  }

  private centre() {
    const { west, south, east, north } = this.bounds;
    return { lng: (west + east) / 2, lat: (south + north) / 2 };
  }

  /** the model's surface at a place, km (the land exaggerated; sea floors below 0) */
  groundAt(lng: number, lat: number): number {
    if (!this.heights) return 0;
    const { west, south, east, north } = this.bounds;
    const fx = ((lng - west) / (east - west)) * this.hw - 0.5;
    const fy = ((north - lat) / (north - south)) * this.hh - 0.5;
    const x0 = Math.max(0, Math.min(this.hw - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(this.hh - 2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - x0));
    const ty = Math.min(1, Math.max(0, fy - y0));
    const h = this.heights;
    const i = y0 * this.hw + x0;
    const a = h[i] * (1 - tx) + h[i + 1] * tx;
    const b = h[i + this.hw] * (1 - tx) + h[i + this.hw + 1] * tx;
    return a * (1 - ty) + b * ty;
  }

  /** where things stand: the ground (down in a basin too), or the sea's surface over the sea floor */
  heightAt(lng: number, lat: number) {
    const g = this.groundAt(lng, lat);
    return this.isSea(lng, lat) ? Math.max(g, 0) : g;
  }

  world(ll: LngLat, liftKm = 0, out = new THREE.Vector3()) {
    const { kmLng, kmLat } = this.size();
    const c = this.centre();
    return out.set((ll[0] - c.lng) * kmLng, this.heightAt(ll[0], ll[1]) + liftKm, -(ll[1] - c.lat) * kmLat);
  }

  lngLatOf(p: THREE.Vector3): LngLat {
    const { kmLng, kmLat } = this.size();
    const c = this.centre();
    return [p.x / kmLng + c.lng, -p.z / kmLat + c.lat];
  }

  /** the chunk meshes, for things that must sit exactly on the land as drawn */
  get landMeshes() {
    return this.chunks.map((c) => c.mesh);
  }

  get eye() {
    return this.camera.position;
  }

  /* ------------------------------------------------------------- streaming */

  /** each visible chunk takes the coarsest texture still giving a texel a pixel; others let go after a while */
  private stream(now: number) {
    if (!this.chunks.length || !this.meta || now - this.lastStream < 250) return;
    this.lastStream = now;
    this.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
    const h = this.container.clientHeight || 1;
    const pxPerKmAt1 = h / (2 * Math.tan(((FOV / 2) * Math.PI) / 180));
    const cols = Math.max(...this.meta.chunks.map((k) => k.col)) + 1;
    const previewPx = (this.preview?.image as ImageBitmap | undefined)?.width ?? 4096;
    let pending = 0;
    for (const ch of this.chunks) {
      const visible = this.frustum.intersectsBox(ch.box);
      const dist = Math.max(1, ch.box.distanceToPoint(this.camera.position));
      const chunkKm = ch.box.max.x - ch.box.min.x;
      const texelPx = (px: number) => (chunkKm / px) * (pxPerKmAt1 / dist);
      let want = 0;
      if (visible) {
        if (texelPx(previewPx / cols) > 1.2) want = 1;
        if (want === 1 && ch.meta.l2 && texelPx(2048) > 1.2) want = 2;
      }
      for (let lv = 1; lv <= want; lv++) ch.wanted[lv] = now;
      if (want > 0 && !ch.textures[want] && !(ch.loading & (1 << want))) this.loadLevel(ch, want as 1 | 2);
      if (want > ch.level && !ch.textures[want]) pending++;
      const best = [2, 1, 0].find((lv) => lv === 0 || (ch.textures[lv] && now - ch.wanted[lv] < 8000)) ?? 0;
      if (best !== ch.level) {
        ch.material.map = best === 0 ? ch.previewMap : ch.textures[best];
        ch.material.needsUpdate = true;
        ch.level = best;
      }
      for (const lv of [1, 2]) {
        const t = ch.textures[lv];
        if (t && lv !== ch.level && now - ch.wanted[lv] > 25000) {
          t.dispose();
          ch.textures[lv] = null;
        }
      }
    }
    if (pending !== this.progress.sharpening) this.report({ sharpening: pending });
  }

  private loadLevel(ch: Chunk, lv: 1 | 2) {
    const path = lv === 2 ? ch.meta.l2 : ch.meta.l1;
    if (!path || !this.cache) return;
    ch.loading |= 1 << lv;
    void this.cache
      .bitmap(path)
      .then((bmp) => {
        if (this.disposed) return bmp.close();
        ch.textures[lv] = this.texture(bmp);
      })
      .catch(() => undefined)
      .finally(() => {
        ch.loading &= ~(1 << lv);
      });
  }

  /* --------------------------------------------------------------- camera */

  private aimKey(azimuthDeg: number, elevationDeg: number) {
    const az = (azimuthDeg * Math.PI) / 180;
    const el = (elevationDeg * Math.PI) / 180;
    // x east, z south: the sun's direction from the ground
    this.key.position.set(Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)).multiplyScalar(3000);
  }

  private poseToOrbit(p: Pose): Orbit {
    const target = this.world(p.center);
    const dist = clamp(ZOOM_K / 2 ** p.zoom, MIN_DISTANCE, MAX_DISTANCE);
    const polar = clamp(((p.pitch ?? 0) * Math.PI) / 180, this.controls.minPolarAngle, this.controls.maxPolarAngle);
    const azim = (-(p.bearing ?? 0) * Math.PI) / 180;
    return { target, dist, polar, azim };
  }

  private applyOrbit(o: Orbit) {
    const off = new THREE.Vector3().setFromSphericalCoords(o.dist, o.polar, o.azim);
    this.controls.target.copy(o.target);
    this.camera.position.copy(o.target).add(off);
    this.camera.lookAt(o.target);
  }

  private current(): Orbit {
    const off = this.camera.position.clone().sub(this.controls.target);
    const s = new THREE.Spherical().setFromVector3(off);
    return { target: this.controls.target.clone(), dist: s.radius, polar: s.phi, azim: s.theta };
  }

  getZoom() {
    return Math.log2(ZOOM_K / this.camera.position.distanceTo(this.controls.target));
  }

  isMoving() {
    return !!this.flight;
  }

  jumpTo(p: Pose) {
    this.flight = null;
    this.applyOrbit(this.poseToOrbit(p));
  }

  flyTo(p: Pose, opts: { duration?: number; onEnd?: () => void } = {}) {
    const from = this.current();
    const to = this.poseToOrbit(p);
    // the short way round
    to.azim = from.azim + Math.atan2(Math.sin(to.azim - from.azim), Math.cos(to.azim - from.azim));
    const dur = opts.duration ?? 2400;
    const prev = this.flight;
    this.flight = null;
    prev?.onEnd?.();
    if (dur <= 0) {
      this.applyOrbit(to);
      opts.onEnd?.();
      return;
    }
    const travel = from.target.distanceTo(to.target);
    const peak = Math.max(from.dist, to.dist, Math.min(MAX_DISTANCE * 0.7, travel * 1.1));
    this.flight = { from, to, peak, start: performance.now(), dur, onEnd: opts.onEnd };
  }

  stop() {
    this.flight = null;
  }

  zoomBy(factor: number) {
    const c = this.current();
    const to = { ...c, dist: clamp(c.dist * factor, MIN_DISTANCE, MAX_DISTANCE) };
    const prev = this.flight;
    this.flight = null;
    prev?.onEnd?.();
    this.flight = { from: c, to, peak: Math.max(c.dist, to.dist), start: performance.now(), dur: 450 };
  }

  resetNorth() {
    const c = this.current();
    this.flight = { from: c, to: { ...c, azim: 0 }, peak: c.dist, start: performance.now(), dur: 600 };
  }

  setPadding(p: Padding) {
    this.padding = p;
    this.resize();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const dx = (this.padding.left - this.padding.right) / 2;
    const dy = (this.padding.top - this.padding.bottom) / 2;
    this.camera.setViewOffset(w, h, -dx, -dy, w, h);
    this.camera.updateProjectionMatrix();
    for (const m of this.lineMats) m.resolution.set(w, h);
    const aspect = w / h;
    (this.studio.backdrop.material as THREE.ShaderMaterial).uniforms.uAspect.value = aspect;
    (this.studio.shafts.material as THREE.ShaderMaterial).uniforms.uAspect.value = aspect;
  }

  /** the camera may wander, but not off the model */
  private clampTarget() {
    const t = this.controls.target;
    const { width, height } = this.size();
    const x = clamp(t.x, -width / 2, width / 2);
    const z = clamp(t.z, -height / 2, height / 2);
    if (x !== t.x || z !== t.z) {
      const d = new THREE.Vector3(x - t.x, 0, z - t.z);
      t.add(d);
      this.camera.position.add(d);
    }
  }

  /* -------------------------------------------------------------- markers */

  addMarker(m: DioramaMarker) {
    this.markers.add(m);
    this.overlay.appendChild(m.wrap);
    this.place(m);
  }

  removeMarker(m: DioramaMarker) {
    this.markers.delete(m);
    m.wrap.remove();
  }

  place(m: DioramaMarker) {
    this.world(m.lngLat, m.opts.lift ?? 0, m.world);
  }

  private projectMarkers() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = new THREE.Vector3();
    const cam = this.camera.position;
    for (const m of this.markers) {
      v.copy(m.world).project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3;
      m.position((v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h, cam.distanceTo(m.world), visible);
    }
  }

  /* ---------------------------------------------------------------- lines */

  setLines(id: string, coords: LngLat[][], style: LineStyle) {
    const prev = this.lines.get(id);
    for (const l of prev?.lines ?? []) {
      this.scene.remove(l);
      l.geometry.dispose();
      (l.material as LineMaterial).dispose();
      this.lineMats.delete(l.material as LineMaterial);
    }
    const out: Line2[] = [];
    for (const pts of coords) {
      if (pts.length < 2) continue;
      const geo = new LineGeometry();
      geo.setPositions(this.drape(pts));
      const mat = new LineMaterial({
        color: style.color as THREE.ColorRepresentation,
        linewidth: style.width,
        transparent: true,
        opacity: style.opacity ?? 1,
        dashed: !!style.dashed,
        dashSize: style.dash?.[0] ?? 6,
        gapSize: style.dash?.[1] ?? 8,
        depthWrite: false,
        worldUnits: false,
      });
      mat.resolution.set(this.container.clientWidth, this.container.clientHeight);
      this.lineMats.add(mat);
      const line = new Line2(geo, mat);
      if (style.dashed) line.computeLineDistances();
      line.renderOrder = 3;
      line.visible = prev?.visible ?? true;
      this.scene.add(line);
      out.push(line);
    }
    this.lines.set(id, { lines: out, coords, style, visible: prev?.visible ?? true });
  }

  setLinesVisible(id: string, visible: boolean) {
    const set = this.lines.get(id);
    if (!set) return;
    set.visible = visible;
    for (const l of set.lines) l.visible = visible;
  }

  private drape(pts: LngLat[]): number[] {
    const out: number[] = [];
    const v = new THREE.Vector3();
    const { kmLng, kmLat } = this.size();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const km = Math.hypot((b[0] - a[0]) * kmLng, (b[1] - a[1]) * kmLat);
      const n = Math.max(1, Math.ceil(km / 4));
      for (let k = 0; k < n; k++) {
        this.world([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n], LINE_LIFT, v);
        out.push(v.x, v.y, v.z);
      }
    }
    this.world(pts[pts.length - 1], LINE_LIFT, v);
    out.push(v.x, v.y, v.z);
    return out;
  }

  /* ----------------------------------------------------------------- loop */

  onFrame(fn: () => void) {
    this.frameFns.add(fn);
    return () => void this.frameFns.delete(fn);
  }

  onUserMove(fn: () => void) {
    this.userMoveFns.add(fn);
    return () => void this.userMoveFns.delete(fn);
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const f = this.flight;
    if (f) {
      const t = Math.min(1, (now - f.start) / f.dur);
      const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      const target = f.from.target.clone().lerp(f.to.target, e);
      const base = f.from.dist + (f.to.dist - f.from.dist) * e;
      const dist = base + (f.peak - Math.max(f.from.dist, f.to.dist)) * Math.sin(Math.PI * e);
      this.applyOrbit({
        target,
        dist,
        polar: f.from.polar + (f.to.polar - f.from.polar) * e,
        azim: f.from.azim + (f.to.azim - f.from.azim) * e,
      });
      if (t >= 1) {
        this.flight = null;
        f.onEnd?.();
      }
    } else {
      this.controls.update();
      this.clampTarget();
    }
    // the key light's shadow covers what is in view, around the target
    const d = this.camera.position.distanceTo(this.controls.target);
    const s = clamp(d * 0.9, 60, 1600);
    const cam = this.key.shadow.camera;
    if (cam.right !== s) {
      cam.left = -s;
      cam.right = s;
      cam.top = s;
      cam.bottom = -s;
      cam.near = 10;
      cam.far = 8000;
      cam.updateProjectionMatrix();
    }
    const dir = this.key.position.clone().sub(this.key.target.position).normalize();
    this.key.target.position.copy(this.controls.target);
    this.key.position.copy(this.controls.target).addScaledVector(dir, 3000);
    // focus on what you look at; the closer, the shallower
    this.dof.cocMaterial.focusDistance = d;
    this.dof.cocMaterial.focusRange = d * 1.8;
    const time = (now - this.start) / 1000;
    (this.studio.backdrop.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    (this.studio.shafts.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    if (this.studio.dust) {
      const u = (this.studio.dust.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = time;
      u.uScale.value = clamp(d / 900, 0.25, 2.5);
    }
    this.stream(now);
    this.composer.render();
    this.projectMarkers();
    for (const fn of this.frameFns) fn();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.controls.dispose();
    for (const ch of this.chunks) for (const t of ch.textures) t?.dispose();
    this.preview?.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    });
    this.composer.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlay.remove();
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
