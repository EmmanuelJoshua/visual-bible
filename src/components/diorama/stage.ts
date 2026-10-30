import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
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
import { DioramaCities } from "./cities";
import { Scatter } from "./scatter";
import { Terrain, modelY, type ChunkInfo, type ModelParams } from "./terrain";

/**
 * The diorama: a relief model of the biblical world, from the Nile to the
 * Caspian and Italy to Arabia, set out like a museum piece on a plinth, under
 * a warm studio light, its seas cast in clear resin, dust turning in the
 * light over it.
 *
 * From afar it wears Blender's render (`blender/diorama.py`, built by
 * `scripts/build-diorama.py`): shading, shadows and colour baked in, its
 * relief drawn seven times taller than life. Come down and the land builds
 * itself sharper (`terrain.ts`): real elevation, lit live, with the grain of
 * rock, scrub and sand; the exaggeration eases toward the land as it is, the
 * resin becomes water, the lakes lie at their own levels.
 *
 * World units are kilometres from the map's centre: x east, y up, z south.
 * It offers what the explorer needs from a map: projected DOM markers (kept
 * from piling on each other), draped route lines and a camera that flies
 * between MapLibre-style poses.
 */

export type Padding = { top: number; bottom: number; left: number; right: number };
export type Pose = { center: LngLat; zoom: number; pitch: number; bearing: number };
export type Anchor = "center" | "top" | "bottom" | "left" | "right";
export type LoadProgress = { fraction: number; phase: "map" | "ready"; sharpening: number };
type LineStyle = { color: string | number; width: number; opacity?: number; dashed?: boolean; dash?: [number, number] };

type ChunkMeta = ChunkInfo & { l1: string; l2?: string };
type Meta = {
  version: number;
  west: number;
  south: number;
  east: number;
  north: number;
  refLat: number;
  sun: { azimuth: number; elevation: number };
  preview: string;
  sea: string;
  chunks: ChunkMeta[];
  albedo: Record<string, { l1: string; l2?: string }>;
  metres: { path: string; offset: number };
  lakes: string;
  ground: [string, string];
  model: ModelParams;
};
type Lake = { name: string; level: number; ring: [number, number][] };

type Chunk = {
  meta: ChunkMeta;
  previewXform: THREE.Vector4;
  /** render levels (0 the shared preview) and the painted colour's */
  render: [null, THREE.Texture | null, THREE.Texture | null];
  albedo: [null, THREE.Texture | null, THREE.Texture | null];
  loading: Set<string>;
  shown: string;
  wanted: Record<string, number>;
};

const FOV = 32;
/** as close as the camera comes */
export const MIN_DISTANCE = 0.8;
export const MAX_DISTANCE = 5200;
/** the zoom (MapLibre sense) to camera distance: kept from the earlier maps so journey framing carries over */
const ZOOM_K = 72000;
const LINE_LIFT = 0.06;
/** the cut sides go down to here, km: a block, not a board */
const BOTTOM = -110;
/** the land's exaggeration, from close up to the whole model */
const E_NEAR = 1.8;
const E_FAR = 7;

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
  /** its size on screen, measured now and then, for keeping labels apart */
  size: [number, number] = [0, 0];
  measured = 0;
  private stage: DioramaStage | null = null;

  constructor(
    readonly element: HTMLElement,
    readonly opts: {
      anchor?: Anchor;
      offset?: [number, number];
      lift?: number;
      interactive?: boolean;
      /** higher wins a contested spot; 0 never gives way */
      priority?: number;
    } = {},
  ) {
    this.wrap = document.createElement("div");
    this.wrap.style.cssText = "position:absolute;left:0;top:0;will-change:transform;pointer-events:none;transition:opacity 200ms;";
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

  position(x: number, y: number, depth: number, visible: boolean, clear: boolean) {
    const [ox, oy] = this.opts.offset ?? [0, 0];
    this.wrap.style.transform = `translate(${(x + ox).toFixed(1)}px, ${(y + oy).toFixed(1)}px) ${ANCHORS[this.opts.anchor ?? "center"]}`;
    this.wrap.style.visibility = visible ? "visible" : "hidden";
    this.wrap.style.opacity = clear ? "1" : "0";
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
  /** how many times taller than life the land is drawn just now */
  exaggeration = E_FAR;
  terrain: Terrain | null = null;
  /** ground kept bare of trees and houses (a structure's model stands there), by id */
  readonly clearings = new Map<string, { at: LngLat; km: number }>();
  /** counts the painted colours decoded for `albedoAt` */
  albedoGen = 0;

  private composer: EffectComposer;
  private dof: DepthOfFieldEffect;
  /** a painted model's colours, a little quieter than the satellite's; the open land's, fuller */
  private grade = { hue: new HueSaturationEffect({ saturation: -0.14 }), contrast: new BrightnessContrastEffect({ contrast: 0.06 }) };
  private meta: Meta | null = null;
  private cache: DioramaCache | null = null;
  private chunks: Chunk[] = [];
  private preview: THREE.Texture | null = null;
  private metres: Float32Array | null = null;
  private mw = 0;
  private mh = 0;
  private metreOffset = 11000;
  private seaMask: Uint8Array | null = null;
  private sw = 0;
  private sh = 0;
  private markers = new Set<DioramaMarker>();
  private lines = new Map<string, { lines: Line2[]; coords: LngLat[][]; style: LineStyle; visible: boolean }>();
  private lineMats = new Set<LineMaterial>();
  private linesDraped = { e: 0, gen: -1, at: 0 };
  private flight: Flight | null = null;
  private frameFns = new Set<() => void>();
  private userMoveFns = new Set<() => void>();
  private progressFns = new Set<(p: LoadProgress) => void>();
  private progress: LoadProgress = { fraction: 0, phase: "map", sharpening: 0 };
  private padding: Padding = { top: 0, bottom: 0, left: 0, right: 0 };
  private studio: { backdrop: THREE.Mesh; shafts: THREE.Mesh; dust: THREE.Points | null };
  private bodyGroup = new THREE.Group();
  private sides: THREE.Mesh | null = null;
  private sidesE = 0;
  private sea: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial> | null = null;
  private waterNormals: THREE.Texture | null = null;
  private lakeNormals: THREE.Texture | null = null;
  private lakes: { mesh: THREE.Mesh; level: number; ring: [number, number][]; box: [number, number, number, number] }[] = [];
  private albedoPx = new Map<string, { w: number; h: number; px: Uint8ClampedArray; used: number }>();
  private albedoLoading = new Set<string>();
  private scatter: Scatter | null = null;
  /** the cities standing in the year */
  cities: DioramaCities | null = null;
  private year: number | null = null;
  private resizeObs: ResizeObserver;
  private raf = 0;
  private disposed = false;
  private lastStream = 0;
  private frustum = new THREE.Frustum();
  private start = performance.now();
  private loaded = false;

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

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.02, 40000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = MIN_DISTANCE;
    c.maxDistance = MAX_DISTANCE;
    c.minPolarAngle = 0.05;
    c.maxPolarAngle = 1.36;
    c.screenSpacePanning = false;
    c.zoomSpeed = 1.1;
    c.rotateSpeed = 0.6;
    c.addEventListener("start", () => {
      this.flight = null;
      for (const fn of this.userMoveFns) fn();
    });

    // the studio: a warm key light from the north-west (where the render's sun was), a soft fill,
    // and a room for glossy things to reflect
    this.key = new THREE.DirectionalLight(0xfff1dc, 3.4);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.key, this.key.target);
    this.scene.add(new THREE.HemisphereLight(0xe9e4dc, 0x3a2c20, 0.5));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
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
    noise.blendMode.opacity.value = 0.08;
    this.composer.addPass(
      new EffectPass(
        this.camera,
        this.dof,
        new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0005, 0.0003), radialModulation: true, modulationOffset: 0.3 }),
        this.grade.hue,
        this.grade.contrast,
        new VignetteEffect({ offset: 0.32, darkness: 0.58 }),
        noise,
        new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
      ),
    );

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
    this.metreOffset = meta.metres.offset;
    this.cache = new DioramaCache(meta.version);
    this.aimKey(meta.sun.azimuth, meta.sun.elevation);

    const parts = new Map<string, [number, number]>();
    const tell = (k: string) => (l: number, t: number) => {
      parts.set(k, [l, t]);
      let a = 0;
      let b = 0;
      for (const [x, y] of parts.values()) {
        a += x;
        b += y;
      }
      this.report({ fraction: b ? Math.min(0.95, a / b) : 0, phase: "map" });
    };
    const big = this.renderer.capabilities.maxTextureSize >= 8192;
    const [metresBmp, previewBmp, seaBmp, groundA, groundB, lakes] = await Promise.all([
      this.cache.bitmap(meta.metres.path, undefined, tell("m")),
      this.cache.bitmap(big ? meta.preview : meta.preview.replace(".webp", "-2k.webp"), undefined, tell("p")),
      this.cache.bitmap(meta.sea, { imageOrientation: "flipY" }, tell("s")),
      this.cache.bitmap(meta.ground[0], undefined, tell("ga")),
      this.cache.bitmap(meta.ground[1], undefined, tell("gb")),
      this.cache.blob(meta.lakes).then((b) => b.text()).then((t) => JSON.parse(t) as Lake[]),
    ]);
    if (this.disposed) return;
    this.decodeMetres(metresBmp);
    this.decodeSea(seaBmp);
    this.preview = this.texture(previewBmp);

    const terrain = new Terrain(
      meta.chunks,
      meta.model,
      (lng, lat) => {
        const p = this.toWorld(lng, lat);
        return { x: p.x, z: p.z };
      },
      (lng, lat) => this.fallbackMetres(lng, lat),
      (lng, lat) => this.isSea(lng, lat),
    );
    terrain.uniforms.uGroundA.value = this.grain(groundA);
    terrain.uniforms.uGroundB.value = this.grain(groundB);
    {
      const { kmLng, kmLat } = this.size();
      const c = this.centre();
      terrain.uniforms.uLL.value.set(kmLng, kmLat, c.lng, c.lat);
    }
    this.terrain = terrain;
    this.scene.add(terrain.group);
    this.cities = new DioramaCities(this);
    this.cities.setYear(this.year);
    this.scene.add(this.cities.group);
    this.scatter = new Scatter(this);
    this.scene.add(this.scatter.group);
    const cols = Math.max(...meta.chunks.map((k) => k.col)) + 1;
    const rows = Math.max(...meta.chunks.map((k) => k.row)) + 1;
    for (const c of meta.chunks) {
      const ch: Chunk = {
        meta: c,
        previewXform: new THREE.Vector4(1 / cols, 1 / rows, c.col / cols, c.row / rows),
        render: [null, null, null],
        albedo: [null, null, null],
        loading: new Set(),
        shown: "",
        wanted: {},
      };
      this.chunks.push(ch);
      this.showMaps(ch, 0, 0);
    }

    this.buildSea(seaBmp);
    this.buildLakes(lakes);
    this.buildBody();
    // the coarsest tiles of the whole map, before the curtain lifts
    await new Promise<void>((resolve) => {
      const check = () => (this.disposed || terrain.ready ? resolve() : setTimeout(check, 100));
      check();
    });
    if (this.disposed) return;
    this.loaded = true;
    for (const m of this.markers) this.place(m);
    this.report({ fraction: 1, phase: "ready" });
    setTimeout(() => void this.prefetch(), 6000);
  }

  private texture(img: ImageBitmap) {
    const t = new THREE.Texture(img);
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    t.needsUpdate = true;
    return t;
  }

  private grain(img: ImageBitmap) {
    const t = new THREE.Texture(img);
    t.flipY = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    t.needsUpdate = true;
    return t;
  }

  private decodeMetres(img: ImageBitmap) {
    const px = pixels(img);
    const h = new Float32Array(img.width * img.height);
    for (let i = 0; i < h.length; i++) h[i] = px[i * 4] * 256 + px[i * 4 + 1] - this.metreOffset;
    this.metres = h;
    this.mw = img.width;
    this.mh = img.height;
    img.close();
  }

  /** decoded flipped for its texture: read its rows back the other way */
  private decodeSea(img: ImageBitmap) {
    const px = pixels(img);
    const m = new Uint8Array(img.width * img.height);
    for (let y = 0; y < img.height; y++) {
      const src = (img.height - 1 - y) * img.width;
      for (let x = 0; x < img.width; x++) m[y * img.width + x] = px[(src + x) * 4] > 127 ? 1 : 0;
    }
    this.seaMask = m;
    this.sw = img.width;
    this.sh = img.height;
  }

  /** after the first view, the sharper textures into the cache, one at a time */
  private async prefetch() {
    if (!this.cache || !this.meta) return;
    for (const c of this.meta.chunks) {
      for (const p of [c.l1, c.l2, this.meta.albedo[c.id]?.l1]) {
        if (this.disposed) return;
        if (p) await this.cache.warm(p);
      }
    }
  }

  /* ------------------------------------------------------------- the body */

  /** the seas: clear resin over the painted sea floor from afar, water close up */
  private buildSea(mask: ImageBitmap) {
    const { width, height } = this.size();
    const alpha = new THREE.Texture(mask);
    // decoded flipped, so its first row is the south edge, where the plane's v starts
    alpha.flipY = false;
    alpha.needsUpdate = true;
    this.waterNormals = waterNormals();
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
      normalMap: this.waterNormals,
      normalScale: new THREE.Vector2(0, 0),
      depthWrite: false,
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 1, 1), mat);
    sea.rotation.x = -Math.PI / 2;
    sea.renderOrder = 2;
    sea.receiveShadow = true;
    this.bodyGroup.add(sea);
    this.sea = sea;
  }

  /** the lakes, each at its own level (the Dead Sea four hundred metres down) */
  private buildLakes(lakes: Lake[]) {
    this.lakeNormals = this.waterNormals?.clone() ?? null;
    if (this.lakeNormals) this.lakeNormals.needsUpdate = true;
    for (const l of lakes) {
      const shape = new THREE.Shape(l.ring.map(([lng, lat]) => {
        const p = this.toWorld(lng, lat);
        return new THREE.Vector2(p.x, -p.z);
      }));
      const geo = new THREE.ShapeGeometry(shape, 2);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0x14414c,
        transparent: true,
        opacity: 0.82,
        roughness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.2,
        normalMap: this.lakeNormals,
        normalScale: new THREE.Vector2(0.25, 0.25),
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2;
      this.bodyGroup.add(mesh);
      const lngs = l.ring.map((p) => p[0]);
      const lats = l.ring.map((p) => p[1]);
      this.lakes.push({ mesh, level: l.level, ring: l.ring, box: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)] });
    }
  }

  /** the model's cut sides, its plinth, and the dust in the air over it */
  private buildBody() {
    this.buildSides();
    const { width, height } = this.size();
    this.bodyGroup.add(plinth(width, height, BOTTOM));
    const box = new THREE.Box3(new THREE.Vector3(-width * 0.7, 30, -height * 0.8), new THREE.Vector3(width * 0.7, 1600, height * 0.8));
    this.studio.dust = dust(box);
    this.scene.add(this.studio.dust);
  }

  private buildSides() {
    const { west, south, east, north } = this.bounds;
    const edge: { x: number; z: number; ground: number }[] = [];
    const steps = 360;
    const at = (lng: number, lat: number) => {
      const p = this.toWorld(lng, lat);
      edge.push({ x: p.x, z: p.z, ground: this.groundAt(lng, lat) });
    };
    for (let i = 0; i <= steps; i++) at(west + ((east - west) * i) / steps, north);
    for (let i = 1; i <= steps / 2; i++) at(east, north - ((north - south) * i) / (steps / 2));
    for (let i = 1; i <= steps; i++) at(east - ((east - west) * i) / steps, south);
    for (let i = 1; i <= steps / 2; i++) at(west, south + ((north - south) * i) / (steps / 2));
    const sides = slabSides(edge, BOTTOM);
    (sides.material as THREE.Material).side = THREE.DoubleSide;
    if (this.sides) {
      this.bodyGroup.remove(this.sides);
      this.sides.geometry.dispose();
      (this.sides.material as THREE.Material).dispose();
    }
    this.bodyGroup.add(sides);
    this.sides = sides;
    this.sidesE = this.exaggeration;
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

  /** a place's x and z on the model, km (y 0) */
  toWorld(lng: number, lat: number, out = new THREE.Vector3()) {
    const { kmLng, kmLat } = this.size();
    const c = this.centre();
    return out.set((lng - c.lng) * kmLng, 0, -(lat - c.lat) * kmLat);
  }

  private fallbackMetres(lng: number, lat: number) {
    if (!this.metres) return 0;
    const { west, south, east, north } = this.bounds;
    const fx = ((lng - west) / (east - west)) * this.mw - 0.5;
    const fy = ((north - lat) / (north - south)) * this.mh - 0.5;
    const x0 = Math.max(0, Math.min(this.mw - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(this.mh - 2, Math.floor(fy)));
    const tx = Math.min(1, Math.max(0, fx - x0));
    const ty = Math.min(1, Math.max(0, fy - y0));
    const h = this.metres;
    const i = y0 * this.mw + x0;
    return (h[i] * (1 - tx) + h[i + 1] * tx) * (1 - ty) + (h[i + this.mw] * (1 - tx) + h[i + this.mw + 1] * tx) * ty;
  }

  isSea(lng: number, lat: number) {
    if (!this.seaMask) return false;
    const { west, south, east, north } = this.bounds;
    const x = Math.min(this.sw - 1, Math.max(0, Math.floor(((lng - west) / (east - west)) * this.sw)));
    const y = Math.min(this.sh - 1, Math.max(0, Math.floor(((north - lat) / (north - south)) * this.sh)));
    return this.seaMask[y * this.sw + x] === 1;
  }

  /** metres above the sea, from the finest land loaded here */
  metresAt(lng: number, lat: number) {
    return this.terrain ? this.terrain.metresAt(lng, lat) : this.fallbackMetres(lng, lat);
  }

  /** the model's surface at a place, km, as drawn just now */
  groundAt(lng: number, lat: number): number {
    const h = this.metresAt(lng, lat);
    const p = this.meta?.model;
    if (!p) return 0;
    return modelY(h, h < 1 && this.isSea(lng, lat), this.exaggeration, p);
  }

  /** where things stand: the ground (down in a basin too), or the sea's surface over its floor */
  heightAt(lng: number, lat: number) {
    const g = this.groundAt(lng, lat);
    return this.isSea(lng, lat) ? Math.max(g, 0) : g;
  }

  /** the year the cities stand in; null for every city at its height */
  setYear(year: number | null) {
    this.year = year;
    this.cities?.setYear(year);
  }

  /** the model's height for so many metres above the sea, km, as drawn just now */
  yOf(metres: number) {
    const p = this.meta?.model;
    return p ? modelY(metres, false, this.exaggeration, p) : 0;
  }

  /** whether a place is under one of the lakes */
  inLake(lng: number, lat: number) {
    for (const l of this.lakes) {
      const [w, s, e, n] = l.box;
      if (lng < w || lng > e || lat < s || lat > n) continue;
      let inside = false;
      const r = l.ring;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        if (r[i][1] > lat !== r[j][1] > lat && lng < ((r[j][0] - r[i][0]) * (lat - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  }

  /** km between two places, on the ground */
  kmBetween(a: LngLat, b: LngLat) {
    const kmLng = 111.32 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
    return Math.hypot((a[0] - b[0]) * kmLng, (a[1] - b[1]) * 111.32);
  }

  /**
   * the painted colour at a place (0–255 rgb), from its chunk's sharpest
   * painting; null while that is still being fetched and read
   */
  albedoAt(lng: number, lat: number): [number, number, number] | null {
    const ch = this.chunks.find((c) => lng >= c.meta.west && lng < c.meta.east && lat >= c.meta.south && lat < c.meta.north);
    if (!ch || !this.meta || !this.cache) return null;
    const id = ch.meta.id;
    const a = this.albedoPx.get(id);
    if (!a) {
      const entry = this.meta.albedo[id];
      const path = entry?.l2 ?? entry?.l1;
      if (path && !this.albedoLoading.has(id)) {
        this.albedoLoading.add(id);
        void this.cache
          .bitmap(path)
          .then((bmp) => {
            if (this.disposed) return bmp.close();
            this.albedoPx.set(id, { w: bmp.width, h: bmp.height, px: pixels(bmp), used: performance.now() });
            bmp.close();
            // a few chunks' worth kept: they are large
            if (this.albedoPx.size > 5) {
              const old = [...this.albedoPx.entries()].sort((x, y) => x[1].used - y[1].used)[0];
              this.albedoPx.delete(old[0]);
            }
            this.albedoGen++;
          })
          .catch(() => undefined)
          .finally(() => this.albedoLoading.delete(id));
      }
      return null;
    }
    a.used = performance.now();
    const m = ch.meta;
    const x = Math.min(a.w - 1, Math.max(0, Math.floor(((lng - m.west) / (m.east - m.west)) * a.w)));
    const y = Math.min(a.h - 1, Math.max(0, Math.floor(((m.north - lat) / (m.north - m.south)) * a.h)));
    const i = (y * a.w + x) * 4;
    return [a.px[i], a.px[i + 1], a.px[i + 2]];
  }

  world(ll: LngLat, liftKm = 0, out = new THREE.Vector3()) {
    this.toWorld(ll[0], ll[1], out);
    out.y = this.heightAt(ll[0], ll[1]) + liftKm;
    return out;
  }

  lngLatOf(p: THREE.Vector3): LngLat {
    const { kmLng, kmLat } = this.size();
    const c = this.centre();
    return [p.x / kmLng + c.lng, -p.z / kmLat + c.lat];
  }

  get eye() {
    return this.camera.position;
  }

  /* ------------------------------------------------------------- streaming */

  /** each chunk's render and painted colour, as sharp as its distance calls for */
  private stream(now: number) {
    if (!this.chunks.length || !this.meta || !this.terrain || now - this.lastStream < 250) return;
    this.lastStream = now;
    this.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
    const h = this.container.clientHeight || 1;
    const pxPerKmAt1 = h / (2 * Math.tan(((FOV / 2) * Math.PI) / 180));
    const cols = Math.max(...this.meta.chunks.map((k) => k.col)) + 1;
    const previewPx = (this.preview?.image as ImageBitmap | undefined)?.width ?? 4096;
    let pending = this.terrain.pending;
    for (const ch of this.chunks) {
      const a = this.toWorld(ch.meta.west, ch.meta.north);
      const b = this.toWorld(ch.meta.east, ch.meta.south);
      const box = new THREE.Box3(new THREE.Vector3(a.x, -10, a.z), new THREE.Vector3(b.x, 45, b.z));
      const visible = this.frustum.intersectsBox(box);
      const dist = Math.max(0.5, box.distanceToPoint(this.camera.position));
      const chunkKm = b.x - a.x;
      const texelPx = (px: number) => (chunkKm / px) * (pxPerKmAt1 / dist);
      let r = 0;
      let al = 0;
      if (visible) {
        if (texelPx(previewPx / cols) > 1.1) r = 1;
        if (r === 1 && ch.meta.l2 && texelPx(2048) > 1.1) r = 2;
        // the painted colour only matters once the land is lit live
        if (dist < 900) al = 1;
        if (al === 1 && this.meta.albedo[ch.meta.id]?.l2 && dist < 260) al = 2;
      }
      for (let lv = 1; lv <= r; lv++) ch.wanted[`r${lv}`] = now;
      for (let lv = 1; lv <= al; lv++) ch.wanted[`a${lv}`] = now;
      if (r > 0 && !ch.render[r]) this.loadMap(ch, "r", r as 1 | 2);
      if (al > 0 && !ch.albedo[al]) this.loadMap(ch, "a", al as 1 | 2);
      if ((r > 0 && !ch.render[r]) || (al > 0 && !ch.albedo[al])) pending++;
      const keep = (kind: "r" | "a", lv: number) => now - (ch.wanted[`${kind}${lv}`] ?? 0) < 8000;
      const bestR = [2, 1].find((lv) => ch.render[lv] && keep("r", lv)) ?? 0;
      const bestA = [2, 1].find((lv) => ch.albedo[lv] && keep("a", lv)) ?? 0;
      this.showMaps(ch, bestR, bestA);
      for (const lv of [1, 2] as const) {
        for (const [kind, arr] of [["r", ch.render], ["a", ch.albedo]] as const) {
          const t = arr[lv];
          if (t && now - (ch.wanted[`${kind}${lv}`] ?? 0) > 30000) {
            t.dispose();
            arr[lv] = null;
          }
        }
      }
    }
    if (pending !== this.progress.sharpening) this.report({ sharpening: pending });
  }

  private showMaps(ch: Chunk, r: number, a: number) {
    const key = `${r}${a}`;
    if (ch.shown === key || !this.terrain || !this.preview) return;
    ch.shown = key;
    const full = new THREE.Vector4(1, 1, 0, 0);
    const render = r ? ch.render[r]! : this.preview;
    this.terrain.setMaps(ch.meta.id, {
      render,
      renderXform: r ? full : ch.previewXform,
      albedo: a ? ch.albedo[a] : null,
      albedoXform: full,
    });
  }

  private loadMap(ch: Chunk, kind: "r" | "a", lv: 1 | 2) {
    const tag = `${kind}${lv}`;
    const path = kind === "r" ? (lv === 2 ? ch.meta.l2 : ch.meta.l1) : this.meta?.albedo[ch.meta.id]?.[lv === 2 ? "l2" : "l1"];
    if (!path || !this.cache || ch.loading.has(tag)) return;
    ch.loading.add(tag);
    void this.cache
      .bitmap(path)
      .then((bmp) => {
        if (this.disposed) return bmp.close();
        (kind === "r" ? ch.render : ch.albedo)[lv] = this.texture(bmp);
        ch.shown = "";
      })
      .catch(() => undefined)
      .finally(() => ch.loading.delete(tag));
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
    to.azim = from.azim + Math.atan2(Math.sin(to.azim - from.azim), Math.cos(to.azim - from.azim));
    const travel = from.target.distanceTo(to.target);
    // a long way, or a long way down: take longer
    const dur = opts.duration ?? Math.min(5200, 2200 + Math.abs(Math.log(to.dist / from.dist)) * 260 + Math.sqrt(travel) * 20);
    const prev = this.flight;
    this.flight = null;
    prev?.onEnd?.();
    if (dur <= 0) {
      this.applyOrbit(to);
      opts.onEnd?.();
      return;
    }
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

  /** the camera may wander, but not off the model, nor under the ground */
  private keepToTheLand() {
    const t = this.controls.target;
    const { width, height } = this.size();
    const x = clamp(t.x, -width / 2, width / 2);
    const z = clamp(t.z, -height / 2, height / 2);
    if (x !== t.x || z !== t.z) {
      const d = new THREE.Vector3(x - t.x, 0, z - t.z);
      t.add(d);
      this.camera.position.add(d);
    }
    if (!this.loaded) return;
    // the target rides the land as it sharpens and as the exaggeration eases
    const [lng, lat] = this.lngLatOf(t);
    const ground = this.heightAt(lng, lat);
    const dy = ground - t.y;
    if (Math.abs(dy) > 1e-4) {
      const k = this.flight ? 1 : 0.25;
      t.y += dy * k;
      this.camera.position.y += dy * k;
    }
    const [clng, clat] = this.lngLatOf(this.camera.position);
    const floor = this.heightAt(clng, clat) + Math.max(0.05, this.camera.position.distanceTo(t) * 0.04);
    if (this.camera.position.y < floor) this.camera.position.y = floor;
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

  /**
   * every marker to its place on screen; where labels would overlap, the
   * more important (or nearer) one keeps the spot
   */
  private projectMarkers(now: number) {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const v = new THREE.Vector3();
    const cam = this.camera.position;
    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const items: { m: DioramaMarker; x: number; y: number; d: number; visible: boolean }[] = [];
    for (const m of this.markers) {
      this.place(m);
      v.copy(m.world).project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      items.push({ m, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, d: cam.distanceTo(m.world), visible });
      if (visible && now - m.measured > 700) {
        const r = m.element.getBoundingClientRect();
        m.size = [r.width, r.height];
        m.measured = now;
      }
    }
    items.sort((a, b) => (b.m.opts.priority ?? 1) - (a.m.opts.priority ?? 1) || a.d - b.d);
    for (const it of items) {
      let clear = true;
      const pr = it.m.opts.priority ?? 1;
      if (it.visible && pr > 0) {
        const [sw, sh] = it.m.size;
        const [ox, oy] = it.m.opts.offset ?? [0, 0];
        const anchor = it.m.opts.anchor ?? "center";
        let x0 = it.x + ox - sw / 2;
        let y0 = it.y + oy - sh / 2;
        if (anchor === "top") y0 = it.y + oy;
        if (anchor === "bottom") y0 = it.y + oy - sh;
        if (anchor === "left") x0 = it.x + ox;
        if (anchor === "right") x0 = it.x + ox - sw;
        const box = { x0: x0 - 3, y0: y0 - 2, x1: x0 + sw + 3, y1: y0 + sh + 2 };
        clear = !placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0);
        if (clear && sw > 0) placed.push(box);
      }
      it.m.position(it.x, it.y, it.d, it.visible, clear);
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

  /** points along the polyline on the ground: finer the closer the camera, lifted a little */
  private drape(pts: LngLat[]): number[] {
    const out: number[] = [];
    const v = new THREE.Vector3();
    const { kmLng, kmLat } = this.size();
    const d = this.camera.position.distanceTo(this.controls.target);
    const stepKm = clamp(d / 120, 0.15, 6);
    // lifted clear of coarser tiles than the ones the heights came from
    const lift = LINE_LIFT + d * 0.0032;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const km = Math.hypot((b[0] - a[0]) * kmLng, (b[1] - a[1]) * kmLat);
      const n = Math.max(1, Math.min(4000, Math.ceil(km / stepKm)));
      for (let k = 0; k < n; k++) {
        this.world([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n], lift, v);
        out.push(v.x, v.y, v.z);
      }
    }
    this.world(pts[pts.length - 1], lift, v);
    out.push(v.x, v.y, v.z);
    return out;
  }

  /** lines follow the land as it sharpens and its exaggeration eases (now and then, not every frame) */
  private redrape(now: number) {
    if (!this.terrain || now - this.linesDraped.at < 600) return;
    const e = this.exaggeration;
    const moved = Math.abs(e - this.linesDraped.e) / e > 0.04;
    if (!moved && this.terrain.gen === this.linesDraped.gen) return;
    this.linesDraped = { e, gen: this.terrain.gen, at: now };
    for (const [id, set] of this.lines) this.setLines(id, set.coords, set.style);
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
      // distance eases in log space, so a dive from orbit to the ground stays smooth
      const la = Math.log(f.from.dist);
      const lb = Math.log(f.to.dist);
      const rise = Math.max(0, Math.log(f.peak) - Math.max(la, lb));
      const dist = Math.exp(la + (lb - la) * e + rise * Math.sin(Math.PI * e));
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
    }
    const d = this.camera.position.distanceTo(this.controls.target);
    // a model from above; the land nearly as it is, up close
    this.exaggeration = E_NEAR + (E_FAR - E_NEAR) * smoothstep(6, 900, d);
    this.keepToTheLand();
    // near enough for a hut at your feet, far enough for the whole model
    this.camera.near = clamp(d * 0.004, 0.005, 2);
    this.camera.far = clamp(d * 60 + 600, 900, 40000);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.controls.zoomSpeed = d < 30 ? 0.8 : 1.1;
    this.controls.panSpeed = 1;

    // the key light's shadow covers what is in view, around the target
    const s = clamp(d * 0.9, 1.5, 1600);
    const cam = this.key.shadow.camera;
    if (Math.abs(cam.right - s) / s > 0.02) {
      cam.left = -s;
      cam.right = s;
      cam.top = s;
      cam.bottom = -s;
      cam.near = 1;
      cam.far = 8000;
      cam.updateProjectionMatrix();
    }
    const dir = this.key.position.clone().sub(this.key.target.position).normalize();
    this.key.target.position.copy(this.controls.target);
    this.key.position.copy(this.controls.target).addScaledVector(dir, 3000);
    this.dof.cocMaterial.focusRange = d * 1.8;

    const time = (now - this.start) / 1000;
    // down among the land: open sky in place of the studio, and the lens's blur and window light let go
    const outdoors = 1 - smoothstep(25, 220, d);
    const back = (this.studio.backdrop.material as THREE.ShaderMaterial).uniforms;
    back.uTime.value = time;
    back.uSky.value = outdoors;
    back.uProjInv.value.copy(this.camera.projectionMatrixInverse);
    back.uCamWorld.value.copy(this.camera.matrixWorld);
    back.uSun.value.copy(dir);
    const shafts = (this.studio.shafts.material as THREE.ShaderMaterial).uniforms;
    shafts.uTime.value = time;
    shafts.uStrength.value = 1 - outdoors * 0.85;
    this.dof.bokehScale = 0.65 * (0.15 + 0.85 * smoothstep(6, 160, d));
    this.grade.hue.saturation = -0.14 + 0.12 * outdoors;
    this.grade.contrast.contrast = 0.06 + 0.08 * outdoors;
    if (this.studio.dust) {
      const u = (this.studio.dust.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = time;
      u.uScale.value = clamp(d / 900, 0.02, 2.5);
      this.studio.dust.visible = d > 40;
    }
    if (this.terrain) {
      this.terrain.uniforms.uTime.value = time;
      this.terrain.uniforms.uCamDist.value = d;
      this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
      const h = this.container.clientHeight || 1;
      this.terrain.update({
        camera: this.camera,
        frustum: this.frustum,
        pxPerRad: h / (2 * Math.tan(((FOV / 2) * Math.PI) / 180)),
        e: this.exaggeration,
      });
    }
    this.water(d, time);
    this.cities?.update(now);
    this.scatter?.update(now);
    if (this.sides && Math.abs(this.exaggeration - this.sidesE) / this.sidesE > 0.03) this.buildSides();
    this.stream(now);
    this.redrape(now);
    this.composer.render();
    this.projectMarkers(now);
    for (const fn of this.frameFns) fn();
  };

  /** resin from afar, water close up; lakes at their levels as the exaggeration eases */
  private water(d: number, time: number) {
    const near = 1 - smoothstep(25, 260, d);
    if (this.sea) {
      const m = this.sea.material;
      m.opacity = 0.38 + 0.47 * near;
      m.normalScale.setScalar(0.3 * near);
      // a sheen, not a mirror: the sun spreads into a soft glitter
      m.roughness = 0.06 + 0.12 * near;
      m.clearcoatRoughness = 0.04 + 0.1 * near;
      m.clearcoat = 1 - 0.5 * near;
      m.color.setRGB(0.06 - 0.03 * near, 0.23 - 0.05 * near, 0.29 - 0.03 * near);
    }
    if (this.waterNormals) {
      // ripples a few hundredths of the view across: crisp close up, a fine sheen (mipmapped flat) from higher
      const tile = clamp(d * 0.03, 0.03, 60);
      const r = this.size().width / tile;
      this.waterNormals.repeat.set(r, r);
      this.waterNormals.offset.set(time * 0.004, time * 0.0027);
      // the lakes' uvs are in km
      if (this.lakeNormals) {
        this.lakeNormals.repeat.set(1 / tile, 1 / tile);
        this.lakeNormals.offset.copy(this.waterNormals.offset);
      }
    }
    const p = this.meta?.model;
    if (p) for (const l of this.lakes) l.mesh.position.y = modelY(l.level, false, this.exaggeration, p) + 0.002;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.controls.dispose();
    for (const ch of this.chunks) for (const t of [...ch.render, ...ch.albedo]) t?.dispose();
    this.preview?.dispose();
    this.terrain?.dispose();
    this.scatter?.dispose();
    this.cities?.dispose();
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
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function pixels(img: ImageBitmap) {
  const cv = document.createElement("canvas");
  cv.width = img.width;
  cv.height = img.height;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height).data;
}

/** a tiling normal map of small waves, drawn once */
function waterNormals() {
  const n = 256;
  const h = new Float32Array(n * n);
  // many small waves running every way, at random phases (whole numbers of waves across, so it tiles):
  // a few regular ones line their glints up in rows
  let seed = 9;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const waves: [number, number, number, number][] = [];
  for (let i = 0; i < 48; i++) {
    const f = 3 + Math.floor(rand() * 26);
    const a = rand() * Math.PI * 2;
    const kx = Math.round(Math.cos(a) * f);
    const ky = Math.round(Math.sin(a) * f);
    if (!kx && !ky) continue;
    waves.push([kx, ky, rand() * Math.PI * 2, 1 / Math.hypot(kx, ky)]);
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x / n) * Math.PI * 2;
      const v = (y / n) * Math.PI * 2;
      let z = 0;
      for (const [kx, ky, ph, amp] of waves) z += Math.sin(u * kx + v * ky + ph) * amp;
      h[y * n + x] = z * 2.2;
    }
  }
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = h[y * n + ((x + 1) % n)] - h[y * n + ((x - 1 + n) % n)];
      const dy = h[((y + 1) % n) * n + x] - h[((y - 1 + n) % n) * n + x];
      const len = Math.hypot(dx, dy, 0.5);
      const i = (y * n + x) * 4;
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      data[i + 2] = ((0.5 / len) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
