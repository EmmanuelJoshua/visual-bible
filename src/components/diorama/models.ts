import * as THREE from "three";
import type { ArtifactId } from "@/data/artifacts";
import { BUILDS } from "@/data/builds";
import type { LngLat } from "@/data/journeys";
import { assembleBuild, loadBuildModel, showStep, tickParts, type Assembled } from "@/lib/artifacts/build";
import { loadArtifactMaterials, type ArtifactMats } from "@/lib/artifacts/materials";
import type { DioramaStage } from "./stage";

/**
 * The step-by-step builds standing on the diorama at their sites.
 *
 * From afar the map is a model four thousand kilometres across, where a
 * true-size temple would be a speck: there each build is drawn as a landmark
 * tens of kilometres across, as a museum diorama's buildings are made larger
 * than its land. Come down and it shrinks back to its true size, cubit for
 * cubit, standing among the hills as it stood (but never smaller than a
 * speck you could find). The studio's key light — the sun the map was
 * rendered under — lights them, and their shadows fall on the land.
 *
 * A building stands level at the height of the ground under it; a vessel
 * come to rest (Noah's ark on Ararat) lies along the slope and tilts to it,
 * settled into the ground. Models are in cubits, x toward the west and z
 * toward the north: a half turn faces them as the text has them.
 */

const CUBIT_KM = 0.00045;
/** steps that are weather and light, not structure: left out here */
const NOT_ON_MAP = new Set(["flood", "cloud", "glory", "meeting"]);
/** how wide each build is drawn, km */
export const DIORAMA_KM: Partial<Record<ArtifactId, number>> = { temple: 22, tabernacle: 18, "noahs-ark": 14, ark: 8 };
/** true footprints in cubits */
const SPAN_CUBITS: Partial<Record<ArtifactId, number>> = { temple: 160, tabernacle: 100, "noahs-ark": 300, ark: 4 };
const MAX_TILT = (14 * Math.PI) / 180;

export function enlargement(id: ArtifactId): number {
  return (DIORAMA_KM[id] ?? 6) / ((SPAN_CUBITS[id] ?? 50) * CUBIT_KM);
}

export type StructureOnMap = { id: ArtifactId; coord: LngLat; progress: number; resting?: boolean };

type Entry = StructureOnMap & {
  asm: Assembled | null;
  loading: boolean;
  step: number;
  holder: THREE.Group;
  shadow: THREE.Mesh;
  footprint: THREE.Box3 | null;
  placed: string;
};

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

/** a plane y = a + b·x + c·z through samples, by least squares */
function fitPlane(pts: [number, number, number][]) {
  let n = 0, sx = 0, sz = 0, sy = 0, sxx = 0, sxz = 0, szz = 0, sxy = 0, szy = 0;
  for (const [x, z, y] of pts) {
    n++;
    sx += x; sz += z; sy += y;
    sxx += x * x; sxz += x * z; szz += z * z;
    sxy += x * y; szy += z * y;
  }
  const m = new THREE.Matrix3().set(sxx, sxz, sx, sxz, szz, sz, sx, sz, n).invert();
  const r = new THREE.Vector3(sxy, szy, sy).applyMatrix3(m);
  return { b: r.x, c: r.y, a: r.z };
}

export class DioramaModels {
  private entries = new Map<ArtifactId, Entry>();
  private mats: ArtifactMats | null = null;
  private root = new THREE.Group();
  private shadowMat = new THREE.ShadowMaterial({ opacity: 0.42, depthWrite: false });
  private disposed = false;

  constructor(private stage: DioramaStage) {
    stage.scene.add(this.root);
    void loadArtifactMaterials().then((mats) => {
      if (this.disposed) return;
      this.mats = mats;
      for (const e of this.entries.values()) this.ensureLoaded(e);
    });
    void stage.ready.then(() => {
      for (const e of this.entries.values()) e.placed = "";
    });
  }

  setStructures(list: StructureOnMap[]) {
    const keep = new Set(list.map((s) => s.id));
    for (const [id, e] of this.entries) {
      if (keep.has(id)) continue;
      this.stage.clearings.delete(id);
      this.root.remove(e.holder, e.shadow);
      e.shadow.geometry.dispose();
      e.asm?.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      this.entries.delete(id);
    }
    const now = performance.now();
    for (const s of list) {
      let e = this.entries.get(s.id);
      if (!e) {
        const holder = new THREE.Group();
        const shadow = new THREE.Mesh(new THREE.BufferGeometry(), this.shadowMat);
        shadow.receiveShadow = true;
        shadow.renderOrder = 4;
        e = { ...s, asm: null, loading: false, step: -1, holder, shadow, footprint: null, placed: "" };
        this.entries.set(s.id, e);
        this.root.add(holder, shadow);
      }
      e.coord = s.coord;
      e.progress = s.progress;
      e.resting = s.resting;
      if (e.asm) this.showProgress(e, now);
      else this.ensureLoaded(e);
    }
  }

  setVisible(v: boolean) {
    this.root.visible = v;
  }

  /* ------------------------------------------------------------ placing */

  /** km a cubit is drawn at, seen from `dist` km: diorama size afar, true size near */
  private scaleAt(e: Entry, dist: number) {
    const trueSpan = (SPAN_CUBITS[e.id] ?? 50) * CUBIT_KM;
    const k = smoothstep(3, 240, dist);
    const span = Math.max(trueSpan * (1 + (enlargement(e.id) - 1) * k), dist * 0.035);
    return CUBIT_KM * (span / trueSpan);
  }

  private place(e: Entry) {
    const centre = this.stage.world(e.coord);
    const dist = this.stage.eye.distanceTo(centre);
    const scale = this.scaleAt(e, dist);
    // re-seated when it has grown or shrunk, or the land's exaggeration has changed, by a few percent
    const q = (v: number) => Math.round(Math.log(v) / 0.03);
    const key = `${e.coord[0]},${e.coord[1]},${e.resting},${!!e.footprint},${q(scale)},${q(this.stage.exaggeration)}`;
    if (e.placed === key) return;
    e.placed = key;
    const fp = e.footprint;
    const sx = fp ? (fp.max.x - fp.min.x) * scale : 10;
    const sz = fp ? (fp.max.z - fp.min.z) * scale : 10;
    // no trees or houses through it
    if (fp) this.stage.clearings.set(e.id, { at: e.coord, km: Math.hypot(sx, sz) / 2 + 0.012 });
    const ground = (x: number, z: number) => this.stage.world(this.stage.lngLatOf(new THREE.Vector3(centre.x + x, 0, centre.z + z))).y;
    const sample = (yaw: number) => {
      const pts: [number, number, number][] = [];
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      for (let i = 0; i <= 8; i++) {
        for (let j = 0; j <= 6; j++) {
          const u = (i / 8 - 0.5) * sx;
          const v = (j / 6 - 0.5) * sz;
          // model (u along its x, v along its z) turned by π - yaw about up, into x east / z south
          const x = -u * c + v * s;
          const z = -u * s - v * c;
          pts.push([x, z, ground(x, z)]);
        }
      }
      return pts;
    };
    let yaw = 0;
    const up = new THREE.Vector3(0, 1, 0);
    let y: number;
    if (e.resting) {
      // the hull along the slope's contour, resting on its keel and listing a little
      const probe = fitPlane(sample(0));
      const downhill = Math.atan2(-probe.c, -probe.b); // from east toward south
      // turn whichever axis is long (model x, or z) square to it
      yaw = sx >= sz ? downhill - Math.PI / 2 : downhill;
      const plane = fitPlane(sample(yaw));
      up.set(-plane.b, 1, -plane.c).normalize();
      const tilt = up.angleTo(new THREE.Vector3(0, 1, 0));
      if (tilt > MAX_TILT) up.lerp(new THREE.Vector3(0, 1, 0), 1 - MAX_TILT / tilt).normalize();
      // on the ground under its keel's middle (a shoulder bulges above any flat fit), settled in a little
      const keel = sample(yaw).filter((_, k) => {
        const i = Math.floor(k / 7);
        const j = k % 7;
        return i >= 2 && i <= 6 && j >= 2 && j <= 4;
      });
      const above = Math.max(...keel.map(([x, z, g]) => g - (plane.a + plane.b * x + plane.c * z)));
      const tall = fp ? (fp.max.y - fp.min.y) * scale : 1;
      y = plane.a + Math.max(0, above) - 0.1 * tall;
    } else {
      // level, at the ground's mean under it: the high side takes it in, the low side props it
      const hs = sample(0).map((p) => p[2]);
      y = hs.reduce((a, b) => a + b, 0) / hs.length;
    }
    e.holder.position.set(centre.x, y, centre.z);
    e.holder.quaternion
      .setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - yaw));
    e.holder.scale.setScalar(scale);
    this.placeShadow(e, centre, Math.max(sx, sz) * 2.2);
  }

  /** a patch of the land around the build that shows only its shadow */
  private placeShadow(e: Entry, centre: THREE.Vector3, size: number) {
    const n = 40;
    const geo = new THREE.PlaneGeometry(size, size, n, n);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(centre.x + pos.getX(i), 0, centre.z + pos.getZ(i));
      pos.setXYZ(i, v.x, this.stage.world(this.stage.lngLatOf(v)).y + 0.08, v.z);
    }
    geo.computeVertexNormals();
    e.shadow.geometry.dispose();
    e.shadow.geometry = geo;
  }

  /* ------------------------------------------------------------ loading */

  private ensureLoaded(e: Entry) {
    if (e.asm || e.loading || !this.mats) return;
    e.loading = true;
    const mats = this.mats;
    void loadBuildModel(e.id).then((model) => {
      e.loading = false;
      if (this.disposed || this.entries.get(e.id) !== e) return;
      const asm = assembleBuild(e.id, mats, model, "map");
      const shown = new THREE.Box3();
      const last = lastStructuralStep(e.id);
      for (const p of asm.parts) if (p.step <= last && p.frame) shown.union(p.box);
      const c = shown.getCenter(new THREE.Vector3());
      asm.root.position.set(-c.x, -shown.min.y, -c.z);
      e.footprint = shown.clone().translate(new THREE.Vector3(-c.x, -shown.min.y, -c.z));
      asm.root.traverse((o) => {
        // lamp and altar lights are sized in cubits; at model scale they'd light a province
        if ((o as THREE.Light).isLight) o.visible = false;
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      e.asm = asm;
      e.holder.add(asm.root);
      this.showProgress(e, performance.now(), false);
    });
  }

  private showProgress(e: Entry, now: number, animate = true) {
    const step = stepFor(e.id, e.progress);
    if (step === e.step || !e.asm) return;
    showStep(e.asm, step, now, animate && e.step >= 0 && step === e.step + 1);
    e.step = step;
  }

  /** every frame: drop-in animations, and seating once the land's heights are in */
  tick() {
    const now = performance.now();
    for (const e of this.entries.values()) {
      if (e.asm) tickParts(e.asm, now);
      this.place(e);
    }
  }

  dispose() {
    this.disposed = true;
    for (const e of this.entries.values()) {
      e.asm?.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      e.shadow.geometry.dispose();
    }
    this.shadowMat.dispose();
    for (const id of this.entries.keys()) this.stage.clearings.delete(id);
    this.entries.clear();
    this.stage.scene.remove(this.root);
  }
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
