import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import {
  AerialPerspectiveEffect,
  PrecomputedTexturesGenerator,
  SkyMaterial,
  StarsGeometry,
  StarsMaterial,
  SunDirectionalLight,
  getECIToECEFRotationMatrix,
  getSunDirectionECEF,
  type PrecomputedTextures,
} from "@takram/three-atmosphere";
import type { LngLat } from "@/data/journeys";
import { DEG, R, distanceM, ecef, frameAt, geodetic } from "./geo";
import {
  GlobeControls,
  MAX_DIST,
  MIN_DIST,
  cameraFrame,
  distForZoom,
  flightView,
  maxPitch,
  wrapAngle,
  zoomForDist,
  type CameraFrame,
  type Flight,
  type View,
} from "./camera";
import { GLOBE_UNIFORMS, GlobeTiles } from "./tiles";

/**
 * The whole Earth, as it looks: Sentinel-2 imagery over real terrain, under
 * a physically modelled sky (Bruneton's precomputed scattering, by takram),
 * lit by a sun that keeps the afternoon wherever you look.
 *
 * Content lives in ECEF metres inside `ecef`; the scene's world frame is
 * the local frame (x east, y up, z south) at a point that follows the
 * camera's target, so whatever is near the camera is near the origin and
 * float32 stays precise down to the centimetre.
 *
 * It offers the explorer what a web map would — projected DOM markers,
 * route lines, a camera that flies between MapLibre-style poses — so the
 * journey and world layers sit on it unchanged.
 */

export type Padding = { top: number; bottom: number; left: number; right: number };

/** a MapLibre-style camera pose, so the journey camera code carries over */
export type Pose = { center: LngLat; zoom: number; pitch: number; bearing: number };

export type Anchor = "center" | "top" | "bottom" | "left" | "right";

export type LoadProgress = {
  /** 0..1 through the first load: the sky's tables and the whole-Earth tiles */
  fraction: number;
  phase: "map" | "ready";
  /** tiles still on their way to the view */
  sharpening: number;
};

type LineStyle = { color: string | number; width: number; opacity?: number; dashed?: boolean; dash?: [number, number] };

const FOV = 40;
/** route lines stand this far above the ground, metres */
const LINE_LIFT = 25;
/** re-base the world frame once the target strays this far from it, metres */
const REBASE_M = 4000;

/**
 * Two fixes to the aerial perspective's shader.
 *
 * It rebuilds each pixel's position by turning log depth back into
 * perspective depth, which at globe range keeps only a handful of distinct
 * values (and its near plane goes stale as ours moves): the haze comes out in
 * bands. Log depth already holds the view distance, so read it straight off
 * and walk that far along the pixel's ray.
 *
 * And close to the ground, the haze between two nearby points is a small
 * difference of large table lookups; the Mie part, extrapolated from that
 * difference's ratio, can blow up into a wall of fog a few hundred metres
 * off. The ratio is capped at what clear air could give.
 */
function patchAerial(effect: AerialPerspectiveEffect) {
  const fx = effect as unknown as { getFragmentShader(): string; setFragmentShader(s: string): void };
  const from = `  depth = reverseLogDepth(depth, cameraNear, cameraFar);

  // Reconstruct position and normal in world space.
  vec3 viewPosition = screenToView(
    uv,
    depth,
    getViewZ(depth),
    projectionMatrix,
    inverseProjectionMatrix
  );`;
  const to = `  float viewZ = -(exp2(depth * log2(cameraFar + 1.0)) - 1.0);
  vec4 nearPoint = inverseProjectionMatrix * vec4(uv * 2.0 - 1.0, -1.0, 1.0);
  vec3 ray = nearPoint.xyz / nearPoint.w;
  vec3 viewPosition = ray * (viewZ / ray.z);
  depth = reverseLogDepth(depth, cameraNear, cameraFar);`;
  const mieFrom = "return scattering.rgb * scattering.a / scattering.r *";
  const mieTo = "return scattering.rgb * min(scattering.a / scattering.r, 3.0) *";
  let src = fx.getFragmentShader();
  if (!src.includes(from) || !src.includes(mieFrom)) console.warn("globe: the aerial perspective shader changed; haze may misbehave");
  src = src.replace(from, to).replace(mieFrom, mieTo);
  fx.setFragmentShader(src);
}

/** a small PMREM of an open day: deep blue overhead, pale at the horizon, warm earth beneath */
function outdoorEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(10, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `varying vec3 vDir;
        void main() {
          float y = vDir.y;
          vec3 zenith = vec3(0.05, 0.1, 0.22);
          vec3 horizon = vec3(0.2, 0.22, 0.24);
          vec3 ground = vec3(0.09, 0.07, 0.05);
          vec3 c = y > 0.0 ? mix(horizon, zenith, pow(y, 0.6)) : mix(horizon * 0.6, ground, pow(-y, 0.4));
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sphere);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  sphere.geometry.dispose();
  (sphere.material as THREE.Material).dispose();
  return env;
}

const ANCHORS: Record<Anchor, string> = {
  center: "translate(-50%, -50%)",
  top: "translate(-50%, 0)",
  bottom: "translate(-50%, -100%)",
  left: "translate(0, -50%)",
  right: "translate(-100%, -50%)",
};

/** a DOM element pinned to a place on the globe */
export class GlobeMarker {
  readonly wrap: HTMLDivElement;
  lngLat: LngLat = [0, 0];
  /** on the ground, ECEF; re-draped as finer terrain arrives */
  readonly ecef = new THREE.Vector3();
  heightGen = -1;
  private stage: GlobeStage | null = null;

  constructor(
    readonly element: HTMLElement,
    readonly opts: {
      anchor?: Anchor;
      offset?: [number, number];
      /** metres above the ground */
      lift?: number;
      /** false: clicks pass through to the globe (the element may opt parts back in) */
      interactive?: boolean;
    } = {},
  ) {
    this.wrap = document.createElement("div");
    this.wrap.style.cssText = "position:absolute;left:0;top:0;will-change:transform;pointer-events:none;";
    if (opts.interactive !== false) element.style.pointerEvents = "auto";
    this.wrap.appendChild(element);
  }

  setLngLat(ll: LngLat) {
    this.lngLat = ll;
    this.heightGen = -1;
    return this;
  }

  addTo(stage: GlobeStage) {
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
    const anchor = ANCHORS[this.opts.anchor ?? "center"];
    this.wrap.style.transform = `translate(${(x + ox).toFixed(1)}px, ${(y + oy).toFixed(1)}px) ${anchor}`;
    this.wrap.style.visibility = visible ? "visible" : "hidden";
    this.wrap.style.zIndex = String(Math.round(1e6 - Math.min(1e6, depth / 10)));
  }
}

type LineSet = { lines: Line2[]; coords: LngLat[][]; style: LineStyle; visible: boolean; centre: THREE.Vector3; radius: number };

export class GlobeStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly overlay: HTMLDivElement;
  /** ECEF space: tiles and models go in here */
  readonly ecef = new THREE.Group();
  readonly tiles: GlobeTiles;
  readonly controls: GlobeControls;
  readonly sun: SunDirectionalLight;
  readonly ready: Promise<void>;

  private composer: EffectComposer;
  private aerial: AerialPerspectiveEffect;
  private skyLight: THREE.HemisphereLight;
  private sky: THREE.Mesh<THREE.PlaneGeometry, SkyMaterial>;
  private stars: THREE.Points | null = null;
  private starsMat: StarsMaterial | null = null;
  /** route lines are drawn after tone mapping, in their own colours, over the land */
  private lineScene = new THREE.Scene();
  private lineEcef = new THREE.Group();
  private lineSets = new Map<string, LineSet>();
  private lineMats = new Set<LineMaterial>();
  private linesGen = -1;
  private linesAt = 0;

  private origin = { lng: 1e9, lat: 0 };
  private ecefToWorld = new THREE.Matrix4();
  private worldToECEF = new THREE.Matrix4();
  private cam: CameraFrame = cameraFrame({ lng: 0, lat: 0, h: 0, dist: 1, heading: 0, pitch: 0 });
  private flight: Flight | null = null;
  private markers = new Set<GlobeMarker>();
  private frameFns = new Set<() => void>();
  private userMoveFns = new Set<() => void>();
  private progressFns = new Set<(p: LoadProgress) => void>();
  private progress: LoadProgress = { fraction: 0, phase: "map", sharpening: 0 };
  private padding: Padding = { top: 0, bottom: 0, left: 0, right: 0 };
  private resizeObs: ResizeObserver;
  private raf = 0;
  private last = performance.now();
  private disposed = false;
  private atmosphereReady = false;
  private sunLng = 1e9;
  private sunDir = new THREE.Vector3();
  private frustum = new THREE.Frustum();

  constructor(readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      logarithmicDepthBuffer: true,
      powerPreference: "high-performance",
      stencil: false,
    });
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 5;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;";
    container.appendChild(this.renderer.domElement);

    this.overlay = document.createElement("div");
    // its own stacking context: markers order among themselves, never over the page's panels
    this.overlay.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none;isolation:isolate;z-index:0;";
    container.appendChild(this.overlay);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 1, 1e8);
    this.camera.matrixAutoUpdate = false;

    this.ecef.matrixAutoUpdate = false;
    this.lineEcef.matrixAutoUpdate = false;
    this.scene.add(this.ecef);
    this.lineScene.add(this.lineEcef);

    this.tiles = new GlobeTiles(this.renderer);
    this.ecef.add(this.tiles.group);

    // the sky, drawn first behind everything; the aerial perspective then hazes the land
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new SkyMaterial({ moon: false }));
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this.sun = new SunDirectionalLight({ distance: 6000 });
    this.sun.castShadow = false;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    // the sky's light: blue from above, warm from the ground (the precomputed probe comes out near black)
    this.skyLight = new THREE.HemisphereLight(0x8fb4ff, 0x8a7458, 0.32);
    this.scene.add(this.skyLight);
    // what metal, polish and water on the models reflect: an outdoor surround of sky above and
    // sunlit earth below (the land itself takes none of it)
    this.scene.environment = outdoorEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.7;

    this.aerial = new AerialPerspectiveEffect(this.camera, { moon: false });
    patchAerial(this.aerial);
    this.composer = new EffectComposer(this.renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: dpr > 1.25 ? 2 : 4,
    });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const tone = new EffectPass(this.camera, this.aerial, new ToneMappingEffect({ mode: ToneMappingMode.AGX }));
    tone.dithering = true;
    this.composer.addPass(tone);

    this.controls = new GlobeControls(this.renderer.domElement, FOV, this.pick, () => {
      this.flight = null;
      for (const fn of this.userMoveFns) fn();
    });

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.jumpTo({ center: [38, 31], zoom: 1.6, pitch: 0, bearing: 0 });
    this.ready = this.load();
    this.loop();
  }

  /* --------------------------------------------------------------- loading */

  /** the first load, then the finer tiles streaming in */
  onProgress(fn: (p: LoadProgress) => void) {
    this.progressFns.add(fn);
    fn(this.progress);
    return () => void this.progressFns.delete(fn);
  }

  private report(p: Partial<LoadProgress>) {
    const next = { ...this.progress, ...p };
    if (next.fraction === this.progress.fraction && next.phase === this.progress.phase && next.sharpening === this.progress.sharpening) return;
    this.progress = next;
    for (const fn of this.progressFns) fn(this.progress);
  }

  private async load() {
    const generator = new PrecomputedTexturesGenerator(this.renderer);
    const [textures] = await Promise.all([generator.update(), this.tiles.water.ready]);
    if (this.disposed) return;
    Object.assign(this.sky.material, textures);
    Object.assign(this.aerial, textures);
    this.sun.transmittanceTexture = textures.transmittanceTexture;
    this.atmosphereReady = true;
    void this.loadStars(textures);
    // the whole Earth at its coarsest, before the curtain lifts
    await new Promise<void>((resolve) => {
      const check = () => {
        if (this.disposed || this.tiles.rootsReady >= 1) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
  }

  private async loadStars(textures: PrecomputedTextures) {
    const data = await fetch("/globe/stars.bin").then((r) => r.arrayBuffer());
    if (this.disposed) return;
    const mat = new StarsMaterial({ pointSize: 1.4, intensity: 1.2 });
    Object.assign(mat, textures);
    const stars = new THREE.Points(new StarsGeometry(data), mat);
    stars.frustumCulled = false;
    stars.renderOrder = -9;
    stars.matrixAutoUpdate = false;
    mat.worldToECEFMatrix.copy(this.worldToECEF);
    mat.sunDirection.copy(this.sunDir);
    this.starsMat = mat;
    this.stars = stars;
    this.scene.add(stars);
  }

  /* ------------------------------------------------------------- geography */

  heightAt(lng: number, lat: number): number {
    return this.tiles.heightAt(lng, lat);
  }

  /** the height of the ground as drawn (falls back to the elevation data) */
  surfaceAt(lng: number, lat: number): number {
    return this.tiles.surfaceAt(lng, lat) ?? this.tiles.heightAt(lng, lat);
  }

  /** the ground (plus `liftM` metres) at a place, ECEF */
  ecefAt(ll: LngLat, liftM = 0, out = new THREE.Vector3()) {
    return ecef(ll[0], ll[1], this.heightAt(ll[0], ll[1]) + liftM, out);
  }

  /** the ground at a place in the current world frame (it moves as the camera does: prefer `ecef`) */
  world(ll: LngLat, liftM = 0, out = new THREE.Vector3()) {
    return this.ecefAt(ll, liftM, out).applyMatrix4(this.ecefToWorld);
  }

  /** the local frame at a place on the ground: x east, y up, z south, in ECEF */
  frameAt(ll: LngLat, liftM = 0, out = new THREE.Matrix4()) {
    return frameAt(ll[0], ll[1], this.heightAt(ll[0], ll[1]) + liftM, out);
  }

  /** the place under a screen point, on a sphere through the camera's target */
  pick = (clientX: number, clientY: number): { lng: number; lat: number } | null => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const o = ray.ray.origin.clone().applyMatrix4(this.worldToECEF);
    const d = ray.ray.direction.clone().transformDirection(this.worldToECEF);
    const r = this.cam.target.length();
    const b = o.dot(d);
    const c = o.lengthSq() - r * r;
    const disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    if (t < 0) return null;
    const g = geodetic(o.addScaledVector(d, t));
    return { lng: g.lng, lat: g.lat };
  };

  /* ---------------------------------------------------------------- camera */

  private poseView(p: Pose): View {
    const dist = Math.min(MAX_DIST, Math.max(MIN_DIST, distForZoom(p.zoom)));
    return {
      lng: p.center[0],
      lat: p.center[1],
      h: Math.max(0, this.heightAt(p.center[0], p.center[1])),
      dist,
      heading: (p.bearing ?? 0) * DEG,
      pitch: Math.min((p.pitch ?? 0) * DEG, maxPitch(dist)),
    };
  }

  /** the zoom (MapLibre sense) the camera is at */
  getZoom() {
    return zoomForDist(this.controls.view.dist);
  }

  getCenter(): LngLat {
    return [this.controls.view.lng, this.controls.view.lat];
  }

  isMoving() {
    return !!this.flight || this.controls.active;
  }

  jumpTo(p: Pose) {
    this.flight = null;
    this.controls.stop();
    Object.assign(this.controls.view, this.poseView(p));
  }

  /** fly as a map's flyTo does: along the great circle, rising over long distances */
  flyTo(p: Pose, opts: { duration?: number; onEnd?: () => void } = {}) {
    const from = { ...this.controls.view };
    const to = this.poseView(p);
    const travel = distanceM([from.lng, from.lat], [to.lng, to.lat]);
    const dur = opts.duration ?? Math.min(4200, 1400 + Math.sqrt(travel / 1000) * 60);
    this.controls.stop();
    const prev = this.flight;
    this.flight = null;
    prev?.onEnd?.();
    if (dur <= 0) {
      Object.assign(this.controls.view, to);
      opts.onEnd?.();
      return;
    }
    const peak = Math.max(from.dist, to.dist, Math.min(MAX_DIST * 0.5, travel * 1.1));
    this.flight = { from, to, peak, start: performance.now(), dur, onEnd: opts.onEnd };
  }

  stop() {
    this.flight = null;
    this.controls.stop();
  }

  /** zoom in (factor < 1) or out about the target */
  zoomBy(factor: number) {
    const v = this.controls.view;
    const to = { ...v, dist: Math.min(MAX_DIST, Math.max(MIN_DIST, v.dist * factor)) };
    to.pitch = Math.min(to.pitch, maxPitch(to.dist));
    this.flyView(to, 450);
  }

  /** turn back to north-up and look straight down a little more */
  resetNorth() {
    this.flyView({ ...this.controls.view, heading: 0 }, 600);
  }

  private flyView(to: View, dur: number) {
    const prev = this.flight;
    this.flight = null;
    prev?.onEnd?.();
    const from = { ...this.controls.view };
    this.flight = { from, to, peak: Math.max(from.dist, to.dist), start: performance.now(), dur };
  }

  /** keep the focal point clear of panels: shift the projection's centre */
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
  }

  /** settle the view: in bounds, above the ground, the target on the land */
  private settle(v: View) {
    v.dist = Math.min(MAX_DIST, Math.max(MIN_DIST, v.dist));
    v.lat = Math.min(85, Math.max(-85, v.lat));
    v.heading = wrapAngle(v.heading);
    v.pitch = Math.min(Math.max(0, v.pitch), maxPitch(v.dist));
    // the target rides the ground as finer terrain arrives
    const ground = Math.max(0, this.heightAt(v.lng, v.lat));
    v.h += (ground - v.h) * (Math.abs(ground - v.h) > 3000 ? 1 : 0.15);
    // never under the hills: tilt up until the eye clears them
    for (let i = 0; i < 40; i++) {
      cameraFrame(v, this.cam);
      const g = geodetic(this.cam.eye);
      const below = Math.max(0, this.heightAt(g.lng, g.lat)) + Math.max(15, v.dist * 0.04) - g.h;
      if (below <= 0 || v.pitch <= 0) break;
      v.pitch = Math.max(0, v.pitch - 1.5 * DEG);
    }
  }

  /** move the world's origin under the target when it strays */
  private rebase(v: View) {
    if (distanceM([v.lng, v.lat], [this.origin.lng, this.origin.lat]) < REBASE_M && Math.abs(this.origin.lng) < 1e8) return;
    this.origin = { lng: v.lng, lat: v.lat };
    frameAt(v.lng, v.lat, 0, this.worldToECEF);
    this.ecefToWorld.copy(this.worldToECEF).invert();
    this.ecef.matrix.copy(this.ecefToWorld);
    this.lineEcef.matrix.copy(this.ecefToWorld);
    this.ecef.matrixWorldNeedsUpdate = true;
    this.lineEcef.matrixWorldNeedsUpdate = true;
    for (const o of [this.sky.material, this.aerial, this.sun, this.starsMat]) o?.worldToECEFMatrix.copy(this.worldToECEF);
  }

  private placeCamera() {
    const f = this.cam;
    const rot = new THREE.Matrix3().setFromMatrix4(this.ecefToWorld);
    const x = f.x.clone().applyMatrix3(rot);
    const y = f.y.clone().applyMatrix3(rot);
    const z = f.z.clone().applyMatrix3(rot);
    const p = f.eye.clone().applyMatrix4(this.ecefToWorld);
    this.camera.matrix.makeBasis(x, y, z).setPosition(p);
    this.camera.matrix.decompose(this.camera.position, this.camera.quaternion, this.camera.scale);
    // near enough for a model at the eye's feet, far enough for the stars
    const alt = Math.max(1, geodetic(f.eye).h - Math.max(0, this.heightAt(this.controls.view.lng, this.controls.view.lat)));
    this.camera.near = Math.min(1000, Math.max(0.5, alt * 0.02));
    this.camera.far = 1e8;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }

  /** the sun of a spring afternoon, wherever the camera looks */
  private placeSun(v: View) {
    if (Math.abs(v.lng - this.sunLng) > 0.25) {
      this.sunLng = v.lng;
      const hours = 15.5 - v.lng / 15;
      getSunDirectionECEF(new Date(Date.UTC(2025, 3, 12) + hours * 3600e3), this.sunDir);
      this.sky.material.sunDirection.copy(this.sunDir);
      this.aerial.sunDirection.copy(this.sunDir);
      this.sun.sunDirection.copy(this.sunDir);
      if (this.starsMat) this.starsMat.sunDirection.copy(this.sunDir);
    }
    const target = this.cam.target.clone().applyMatrix4(this.ecefToWorld);
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();
    // the hemisphere's up is the world's y: the up of the place the camera looks at
    // shadows only matter close up, where the models stand; frame them around the target
    const close = v.dist < 6000;
    this.sun.castShadow = close;
    if (close) {
      const s = Math.max(60, v.dist * 1.1);
      const cam = this.sun.shadow.camera;
      cam.left = -s;
      cam.right = s;
      cam.top = s;
      cam.bottom = -s;
      cam.near = 1;
      cam.far = 14000;
      this.sun.distance = 6000;
      cam.updateProjectionMatrix();
    }
    if (this.atmosphereReady) this.sun.update();
    if (this.stars) {
      // stars only from space: in daylight under the air they'd be specks on the blue
      this.stars.visible = geodetic(this.cam.eye).h > 90000;
      const rot = new THREE.Matrix4().extractRotation(this.ecefToWorld);
      this.stars.matrix.multiplyMatrices(rot, getECIToECEFRotationMatrix(Date.UTC(2025, 3, 12), new THREE.Matrix4()));
      this.stars.matrixWorldNeedsUpdate = true;
    }
  }

  /* -------------------------------------------------------------- markers */

  addMarker(m: GlobeMarker) {
    this.markers.add(m);
    this.overlay.appendChild(m.wrap);
  }

  removeMarker(m: GlobeMarker) {
    this.markers.delete(m);
    m.wrap.remove();
  }

  private projectMarkers() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const eye = this.cam.eye;
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    const gen = this.tiles.terrainGen;
    for (const m of this.markers) {
      if (m.heightGen !== gen) {
        this.ecefAt(m.lngLat, m.opts.lift ?? 0, m.ecef);
        m.heightGen = gen;
      }
      // over the horizon: the ground there faces away from the eye
      n.copy(m.ecef).normalize();
      const facing = v.copy(eye).sub(m.ecef).dot(n) > -50;
      v.copy(m.ecef).applyMatrix4(this.ecefToWorld).project(this.camera);
      const visible = facing && v.z < 1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3;
      m.position((v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h, eye.distanceTo(m.ecef), visible);
    }
  }

  /* ---------------------------------------------------------------- lines */

  /** polylines along the ground, replaced as a set under `id` */
  setLines(id: string, coords: LngLat[][], style: LineStyle) {
    const prev = this.lineSets.get(id);
    const set: LineSet = { lines: [], coords, style, visible: prev?.visible ?? true, centre: new THREE.Vector3(), radius: 0 };
    if (prev) this.clearLines(prev);
    this.lineSets.set(id, set);
    this.buildLines(set);
  }

  setLinesVisible(id: string, visible: boolean) {
    const set = this.lineSets.get(id);
    if (set) set.visible = visible;
  }

  private clearLines(set: LineSet) {
    for (const l of set.lines) {
      this.lineEcef.remove(l);
      l.geometry.dispose();
      (l.material as LineMaterial).dispose();
      this.lineMats.delete(l.material as LineMaterial);
    }
    set.lines = [];
  }

  private buildLines(set: LineSet) {
    const box = new THREE.Box3();
    for (const pts of set.coords) {
      if (pts.length < 2) continue;
      const anchor = this.ecefAt(pts[0]);
      const flat = this.drape(pts, anchor, box);
      const geo = new LineGeometry();
      geo.setPositions(flat);
      const s = set.style;
      const mat = new LineMaterial({
        color: s.color as THREE.ColorRepresentation,
        linewidth: s.width,
        transparent: true,
        opacity: s.opacity ?? 1,
        dashed: !!s.dashed,
        dashSize: s.dash?.[0] ?? 6,
        gapSize: s.dash?.[1] ?? 8,
        depthTest: false,
        depthWrite: false,
        worldUnits: false,
      });
      mat.userData.opacity = s.opacity ?? 1;
      mat.resolution.set(this.container.clientWidth, this.container.clientHeight);
      this.lineMats.add(mat);
      const line = new Line2(geo, mat);
      if (s.dashed) line.computeLineDistances();
      line.position.copy(anchor);
      line.updateMatrix();
      line.matrixAutoUpdate = false;
      line.frustumCulled = false;
      this.lineEcef.add(line);
      set.lines.push(line);
    }
    if (!box.isEmpty()) {
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      set.centre.copy(sphere.center);
      set.radius = sphere.radius;
    }
  }

  /** points every couple of km along the polyline, on the ground, relative to `anchor` */
  private drape(pts: LngLat[], anchor: THREE.Vector3, box: THREE.Box3): number[] {
    const out: number[] = [];
    const v = new THREE.Vector3();
    const push = (ll: LngLat) => {
      this.ecefAt(ll, LINE_LIFT, v);
      box.expandByPoint(v);
      v.sub(anchor);
      out.push(v.x, v.y, v.z);
    };
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const n = Math.max(1, Math.ceil(distanceM(a, b) / 2500));
      for (let k = 0; k < n; k++) push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
    push(pts[pts.length - 1]);
    return out;
  }

  /** lines follow finer terrain as it comes, hide over the horizon, and fade at the models' feet */
  private updateLines(now: number) {
    const gen = this.tiles.terrainGen;
    if (gen !== this.linesGen && now - this.linesAt > 700) {
      this.linesGen = gen;
      this.linesAt = now;
      for (const set of this.lineSets.values()) {
        this.clearLines(set);
        this.buildLines(set);
      }
    }
    const eye = this.cam.eye;
    const fade = Math.min(1, Math.max(0, (this.controls.view.dist - 1500) / 3500));
    const n = new THREE.Vector3();
    for (const set of this.lineSets.values()) {
      n.copy(set.centre).normalize();
      const overHorizon = n.multiplyScalar(R).dot(eye) < R * R - set.radius * eye.length();
      for (const l of set.lines) {
        l.visible = set.visible && !overHorizon && fade > 0;
        const mat = l.material as LineMaterial;
        mat.opacity = (mat.userData.opacity as number) * fade;
      }
    }
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
    const dt = Math.min(100, now - this.last);
    this.last = now;
    GLOBE_UNIFORMS.uTime.value = now / 1000;
    const v = this.controls.view;
    const f = this.flight;
    if (f) {
      // the destination's ground may have sharpened since take-off
      f.to.h = Math.max(0, this.heightAt(f.to.lng, f.to.lat));
      if (flightView(f, now, v)) {
        this.flight = null;
        f.onEnd?.();
      }
    } else this.controls.update(dt);
    this.settle(v);
    this.rebase(v);
    cameraFrame(v, this.cam);
    this.placeCamera();
    this.placeSun(v);
    this.ecef.updateMatrixWorld();

    if (this.atmosphereReady) {
      this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse));
      const h = this.container.clientHeight || 1;
      this.tiles.update({
        camera: this.camera,
        eye: this.cam.eye,
        ecefToWorld: this.ecef.matrixWorld,
        frustum: this.frustum,
        pxPerRad: h / (2 * Math.tan((FOV / 2) * DEG)),
      });
    }
    this.updateLines(now);
    this.composer.render(dt / 1000);
    // the route lines, over the finished picture
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.lineScene, this.camera);
    this.renderer.autoClear = true;
    this.projectMarkers();
    for (const fn of this.frameFns) fn();
    if (this.atmosphereReady) {
      const roots = this.tiles.rootsReady;
      this.report({
        fraction: Math.min(1, 0.35 + 0.65 * roots),
        phase: roots >= 1 ? "ready" : "map",
        sharpening: this.tiles.pending,
      });
    }
  };

  /** the camera's eye and target, for things that face it */
  get eyeECEF() {
    return this.cam.eye;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.controls.dispose();
    this.tiles.dispose();
    for (const set of this.lineSets.values()) this.clearLines(set);
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

