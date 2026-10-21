import * as THREE from "three";
import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from "maplibre-gl";
import type { ArtifactId } from "@/data/artifacts";
import { BUILDS } from "@/data/builds";
import type { LngLat } from "@/data/journeys";
import {
  assembleBuild,
  loadBuildModel,
  showStep,
  tickParts,
  type Assembled,
} from "@/lib/artifacts/build";
import { disposeGroup } from "@/lib/artifacts/geometry";
import { loadArtifactMaterials, loadStudioEnv, type ArtifactMats } from "@/lib/artifacts/materials";

/**
 * The step-by-step build models, standing on the globe at their sites.
 *
 * A MapLibre custom layer that draws three.js into the map's own WebGL
 * context. Each model gets one local → clip matrix per frame: on the globe a
 * frame on the unit sphere (MapLibre's globe shader space), close in a
 * mercator frame, blended exactly as MapLibre blends its own projection.
 * Models are in cubits, x toward the west, z toward the north — so the temple
 * and tabernacle face east, as the text has them.
 */

const EARTH_RADIUS = 6371008.8; // MapLibre's GLOBE_RADIUS
/** a short cubit, the app's unit */
const CUBIT_M = 0.45;
/** the smallest a model is drawn on screen; below it, it is drawn larger than life */
const MIN_PIXELS = 150;
const MAX_ENLARGE = 80;
/** below this zoom the pins are enough */
export const MODELS_MIN_ZOOM = 7;
/** steps that are weather and light, not structure: left out on the map */
const NOT_ON_MAP = new Set(["flood", "cloud", "glory", "meeting"]);

export type StructureOnMap = {
  id: ArtifactId;
  coord: LngLat;
  /** 0..1 through construction (1 once built) */
  progress: number;
};

type Entry = {
  id: ArtifactId;
  coord: LngLat;
  progress: number;
  asm: Assembled | null;
  loading: boolean;
  /** the step currently shown */
  step: number;
  /** true span in cubits, for the on-screen size */
  span: number;
};

/** how much larger than life a model of `spanCubits` is drawn at this zoom */
export function enlargement(spanCubits: number, lat: number, zoom: number): number {
  const metresPerPixel = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
  const px = (spanCubits * CUBIT_M) / metresPerPixel;
  return Math.min(MAX_ENLARGE, Math.max(1, MIN_PIXELS / px));
}

/** the highest step shown on the map (weather and glory steps left out) */
function lastStructuralStep(id: ArtifactId): number {
  const steps = BUILDS[id]?.steps ?? [];
  let last = steps.length - 1;
  while (last > 0 && NOT_ON_MAP.has(steps[last].id)) last--;
  return last;
}

function stepFor(id: ArtifactId, progress: number): number {
  const last = lastStructuralStep(id);
  return progress >= 1 ? last : Math.min(last, Math.floor(progress * (last + 1)));
}

const m4 = (a: ArrayLike<number>) => new THREE.Matrix4().fromArray(Array.from(a));

export class StructureModelLayer implements CustomLayerInterface {
  readonly id = "structure-models";
  readonly type = "custom" as const;
  readonly renderingMode = "3d" as const;

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  /** placed by hand every frame from MapLibre's matrices */
  private camera = Object.assign(new THREE.Camera(), { matrixWorldAutoUpdate: false });
  private mats: ArtifactMats | null = null;
  private entries = new Map<ArtifactId, Entry>();
  private disposed = false;

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext) {
    this.map = map;
    this.disposed = false;
    this.scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    renderer.autoClear = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    this.renderer = renderer;
    // a warm sun over the desert, sky from above, the studio HDR for metal
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.position.set(-60, 120, -40);
    this.scene.add(sun, new THREE.HemisphereLight(0xdfe8f5, 0x6b5a44, 1.1));
    void Promise.all([loadArtifactMaterials(), loadStudioEnv(renderer)]).then(([mats, env]) => {
      if (this.disposed) return;
      this.mats = mats;
      this.scene.environment = env;
      this.scene.environmentIntensity = 0.5;
      for (const e of this.entries.values()) this.ensureLoaded(e);
    });
  }

  onRemove() {
    this.disposed = true;
    // kept as a list of wanted structures, so a re-add (React strict mode) reloads them
    for (const e of this.entries.values()) {
      if (e.asm) disposeGroup(e.asm.root);
      e.asm = null;
      e.loading = false;
      e.step = -1;
    }
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  /** the structures standing this year; models load on first need */
  setStructures(list: StructureOnMap[]) {
    const keep = new Set(list.map((s) => s.id));
    for (const [id, e] of this.entries) {
      if (keep.has(id)) continue;
      if (e.asm) {
        this.scene.remove(e.asm.root);
        disposeGroup(e.asm.root);
      }
      this.entries.delete(id);
    }
    const now = performance.now();
    for (const s of list) {
      let e = this.entries.get(s.id);
      if (!e) {
        e = { ...s, asm: null, loading: false, step: -1, span: 1 };
        this.entries.set(s.id, e);
      }
      e.coord = s.coord;
      e.progress = s.progress;
      if (e.asm) this.showProgress(e, now);
      else this.ensureLoaded(e);
    }
    this.map?.triggerRepaint();
  }

  private ensureLoaded(e: Entry) {
    if (e.asm || e.loading || !this.mats) return;
    e.loading = true;
    const mats = this.mats;
    void loadBuildModel(e.id).then((model) => {
      e.loading = false;
      if (this.disposed || this.entries.get(e.id) !== e) return;
      const asm = assembleBuild(e.id, mats, model);
      // the span of what is drawn (not the flood's horizon-wide water)
      const shown = new THREE.Box3();
      const last = lastStructuralStep(e.id);
      for (const p of asm.parts) if (p.step <= last && p.frame) shown.union(p.box);
      const size = shown.getSize(new THREE.Vector3());
      e.span = Math.max(size.x, size.z, 1);
      asm.root.matrixAutoUpdate = false;
      asm.root.visible = false;
      e.asm = asm;
      this.scene.add(asm.root);
      this.showProgress(e, performance.now(), false);
      this.map?.triggerRepaint();
    });
  }

  /** reveal the steps reached by now; a newly reached step drops in */
  private showProgress(e: Entry, now: number, animate = true) {
    const step = stepFor(e.id, e.progress);
    if (step === e.step || !e.asm) return;
    showStep(e.asm, step, now, animate && e.step >= 0 && step === e.step + 1);
    e.step = step;
  }

  /**
   * local cubits → clip space for a model at `coord`, standing at `h` metres,
   * drawn `k` times larger than life, for this frame's projection
   */
  private modelToClip(args: CustomRenderMethodInput, coord: LngLat, h: number, k: number): THREE.Matrix4 {
    const data = args.defaultProjectionData;
    const main = m4(data.mainMatrix);
    const fallback = m4(data.fallbackMatrix);
    const sameMatrix = main.equals(fallback);
    const t = sameMatrix ? 0 : data.projectionTransition;
    const metres = CUBIT_M * k;

    // mercator frame: x → west, y → up, z → north in mercator units
    const merc = MercatorCoordinate.fromLngLat({ lng: coord[0], lat: coord[1] }, h);
    const s = merc.meterInMercatorCoordinateUnits() * metres;
    const mercFrame = new THREE.Matrix4().set(
      -s, 0, 0, merc.x,
      0, 0, -s, merc.y,
      0, s, 0, merc.z,
      0, 0, 0, 1,
    );
    const flat = (sameMatrix ? main : fallback).clone().multiply(mercFrame);
    if (t <= 0.001) return flat;

    // globe frame: MapLibre's unit sphere, (sin λ cos φ, sin φ, cos λ cos φ)
    const lng = (coord[0] * Math.PI) / 180;
    const lat = (coord[1] * Math.PI) / 180;
    const up = new THREE.Vector3(Math.sin(lng) * Math.cos(lat), Math.sin(lat), Math.cos(lng) * Math.cos(lat));
    const east = new THREE.Vector3(Math.cos(lng), 0, -Math.sin(lng));
    const north = new THREE.Vector3().crossVectors(up, east);
    const g = metres / EARTH_RADIUS;
    const o = up.clone().multiplyScalar(1 + h / EARTH_RADIUS);
    const globeFrame = new THREE.Matrix4().set(
      -east.x * g, up.x * g, north.x * g, o.x,
      -east.y * g, up.y * g, north.y * g, o.y,
      -east.z * g, up.z * g, north.z * g, o.z,
      0, 0, 0, 1,
    );
    const round = main.clone().multiply(globeFrame);
    if (t >= 0.999) return round;
    // MapLibre mixes the two clip positions; both are linear in the model's coordinates
    const out = new THREE.Matrix4();
    for (let i = 0; i < 16; i++) out.elements[i] = flat.elements[i] * (1 - t) + round.elements[i] * t;
    return out;
  }

  render(gl: WebGL2RenderingContext, args: CustomRenderMethodInput) {
    const map = this.map;
    const renderer = this.renderer;
    if (!map || !renderer || map.getZoom() < MODELS_MIN_ZOOM) return;
    const now = performance.now();
    let busy = false;
    const ready = [...this.entries.values()].filter((e) => e.asm);
    if (!ready.length) return;

    renderer.resetState();
    // the globe's depth is MapLibre's own; models draw over the ground, depth-tested among themselves
    renderer.clearDepth();
    for (const e of ready) e.asm!.root.visible = false;
    for (const e of ready) {
      const asm = e.asm!;
      busy = tickParts(asm, now) || busy;
      const zoom = map.getZoom();
      const k = enlargement(e.span, e.coord[1], zoom);
      const h = map.queryTerrainElevation({ lng: e.coord[0], lat: e.coord[1] }) ?? 0;
      const clip = this.modelToClip(args, e.coord, h, k);
      // put three's camera at the eye in model space, so lighting and reflections are right
      const inv = clip.clone().invert();
      const eye = new THREE.Vector4(0, 0, 1, 0).applyMatrix4(inv);
      const eyePos = Math.abs(eye.w) > 1e-12 ? new THREE.Vector3(eye.x / eye.w, eye.y / eye.w, eye.z / eye.w) : new THREE.Vector3();
      this.camera.matrixWorld.makeTranslation(eyePos.x, eyePos.y, eyePos.z);
      this.camera.matrixWorldInverse.makeTranslation(-eyePos.x, -eyePos.y, -eyePos.z);
      this.camera.projectionMatrix.copy(clip).multiply(this.camera.matrixWorld);
      this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
      asm.root.visible = true;
      asm.root.updateMatrixWorld(true);
      renderer.render(this.scene, this.camera);
      asm.root.visible = false;
    }
    if (busy) map.triggerRepaint();
  }
}
