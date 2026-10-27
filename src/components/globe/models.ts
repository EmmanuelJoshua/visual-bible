import * as THREE from "three";
import type { ArtifactId } from "@/data/artifacts";
import { BUILDS } from "@/data/builds";
import type { LngLat } from "@/data/journeys";
import { assembleBuild, loadBuildModel, showStep, tickParts, type Assembled } from "@/lib/artifacts/build";
import { loadArtifactMaterials, type ArtifactMats } from "@/lib/artifacts/materials";
import { DEG, distanceM, ecef, frameAt } from "./geo";
import type { GlobeStage } from "./stage";

/**
 * The step-by-step build models standing at their sites, at true size: a
 * cubit is 45 cm, so the ark of Noah is a 135-metre hull and the ark of the
 * covenant a chest you could carry.
 *
 * Each sits on the real ground. Buildings stand level, on a stone terrace
 * cut to the slope the way ancient builders levelled a site; a vessel come
 * to rest (Noah's ark on Ararat) lies on the ground under it, its hull laid
 * along the slope and tilted to it, settled a little into the earth.
 *
 * Around each, a patch of natural ground (photoscanned dry earth and stones,
 * taking on the colour the satellite sees there) fades out over a couple of
 * hundred metres: up close the ten-metre imagery is a blur, and of a modern
 * city at that.
 *
 * Models are in cubits, x toward the west and z toward the north, so a half
 * turn faces them as the text has them: the temple and tabernacle open east.
 */

const CUBIT_M = 0.45;
/** steps that are weather and light, not structure: left out here */
const NOT_ON_MAP = new Set(["flood", "cloud", "glory", "meeting"]);
/** beyond this the model is a speck: leave it to its label */
const SHOW_WITHIN_M = 45000;
const MAX_TILT = 12 * DEG;
/** how far a resting hull settles into the ground, metres */
const SETTLE_M = 2.4;
/** sites their builders levelled: a dressed-stone platform, a packed-earth one */
const TERRACE: Partial<Record<ArtifactId, number>> = { temple: 0xc9b896, tabernacle: 0xa48d6c };
/** the ground texture's mean colour (linear): dividing it out leaves only its grain to tint */
const GROUND_MEAN = [0.3128, 0.1829, 0.0843];
/** metres one repeat of the ground texture covers */
const GROUND_TILE_M = 4.5;
const GROUND_LIFT_M = 0.3;

let groundMaps: { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture } | null = null;
function loadGround() {
  if (groundMaps) return groundMaps;
  const loader = new THREE.TextureLoader();
  const load = (name: string, srgb = false) => {
    const t = loader.load(`/textures/ground/${name}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  groundMaps = { map: load("diff", true), normalMap: load("nor"), roughnessMap: load("rough") };
  return groundMaps;
}

export type StructureOnMap = {
  id: ArtifactId;
  coord: LngLat;
  progress: number;
  /** lying where it came to rest, not built level */
  resting?: boolean;
};

type Entry = StructureOnMap & {
  asm: Assembled | null;
  loading: boolean;
  step: number;
  holder: THREE.Group;
  terrace: THREE.Mesh | null;
  terraceOn: boolean;
  ground: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null;
  /** the ground has taken on the colour of the land around it */
  tinted: boolean;
  /** the drawn part of the build, cubits, centred, its floor at 0 */
  footprint: THREE.Box3 | null;
  placedGen: number;
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

/** a plane h = a + b·east + c·north through ground samples, by least squares */
function fitPlane(pts: [number, number, number][]) {
  let n = 0, sx = 0, sy = 0, sz = 0, sxx = 0, sxy = 0, syy = 0, sxz = 0, syz = 0;
  for (const [x, y, z] of pts) {
    n++;
    sx += x; sy += y; sz += z;
    sxx += x * x; sxy += x * y; syy += y * y;
    sxz += x * z; syz += y * z;
  }
  const m = new THREE.Matrix3().set(sxx, sxy, sx, sxy, syy, sy, sx, sy, n);
  const inv = m.clone().invert();
  const r = new THREE.Vector3(sxz, syz, sz).applyMatrix3(inv);
  return { b: r.x, c: r.y, a: r.z };
}

export class GlobeModels {
  private entries = new Map<ArtifactId, Entry>();
  private mats: ArtifactMats | null = null;
  private root = new THREE.Group();
  private terraceMats = new Map<number, THREE.MeshStandardMaterial>();
  private disposed = false;
  private lastPlace = 0;

  constructor(private stage: GlobeStage) {
    stage.ecef.add(this.root);
    void loadArtifactMaterials().then((mats) => {
      if (this.disposed) return;
      this.mats = mats;
      for (const e of this.entries.values()) this.ensureLoaded(e);
    });
  }

  setStructures(list: StructureOnMap[]) {
    const keep = new Set(list.map((s) => s.id));
    for (const [id, e] of this.entries) {
      if (keep.has(id)) continue;
      this.root.remove(e.holder);
      if (e.terrace) {
        this.root.remove(e.terrace);
        e.terrace.geometry.dispose();
      }
      if (e.ground) {
        this.root.remove(e.ground);
        e.ground.geometry.dispose();
        e.ground.material.dispose();
      }
      e.asm?.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      this.entries.delete(id);
    }
    const now = performance.now();
    for (const s of list) {
      let e = this.entries.get(s.id);
      if (!e) {
        const holder = new THREE.Group();
        holder.matrixAutoUpdate = false;
        e = {
          ...s,
          asm: null,
          loading: false,
          step: -1,
          holder,
          terrace: null,
          terraceOn: false,
          ground: null,
          tinted: false,
          footprint: null,
          placedGen: -1,
        };
        this.entries.set(s.id, e);
        this.root.add(holder);
      }
      const moved = e.coord[0] !== s.coord[0] || e.coord[1] !== s.coord[1] || e.resting !== s.resting;
      e.coord = s.coord;
      e.progress = s.progress;
      e.resting = s.resting;
      if (moved) {
        e.placedGen = -1;
        e.tinted = false;
      }
      if (e.asm) this.showProgress(e, now);
      else this.ensureLoaded(e);
    }
  }

  setVisible(v: boolean) {
    this.root.visible = v;
  }

  /* ------------------------------------------------------------ placing */

  private place(e: Entry) {
    const fp = e.footprint;
    const [lng, lat] = e.coord;
    if (!fp) {
      e.holder.matrix.copy(frameAt(lng, lat, this.stage.heightAt(lng, lat)));
      e.holder.matrixWorldNeedsUpdate = true;
      return;
    }
    // footprint in metres, after the half turn
    const sx = (fp.max.x - fp.min.x) * CUBIT_M;
    const sz = (fp.max.z - fp.min.z) * CUBIT_M;
    const mPerDegLat = 111132;
    const mPerDegLng = 111320 * Math.cos(lat * DEG);
    const groundAt = (east: number, north: number) => {
      // the surface as drawn, so the patch lies on the mesh rather than cutting through it
      const h = this.stage.surfaceAt(lng + east / mPerDegLng, lat + north / mPerDegLat);
      return Math.max(0, h);
    };
    // ground under the footprint, on a grid
    const sample = (yaw: number) => {
      const pts: [number, number, number][] = [];
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      for (let i = 0; i <= 8; i++) {
        for (let j = 0; j <= 6; j++) {
          const u = (i / 8 - 0.5) * sx;
          const v = (j / 6 - 0.5) * sz;
          // where model (u, v) lands once turned by π − yaw about the local up
          const east = -u * c + v * s;
          const north = u * s + v * c;
          pts.push([east, north, groundAt(east, north)]);
        }
      }
      return pts;
    };

    let yaw = 0;
    let up = new THREE.Vector3(0, 1, 0);
    let height: number;
    let terrace: { top: number; bottom: number } | null = null;
    if (e.resting) {
      // lay the hull along the slope's contour, so it rests on its keel and lists a little
      const probe = fitPlane(sample(0));
      const downhill = Math.atan2(-probe.c, -probe.b); // steepest descent, from east toward north
      // turn the long axis (model x, or z) square to it
      yaw = sx >= sz ? Math.PI / 2 - downhill : -downhill;
      const plane = fitPlane(sample(yaw));
      up = new THREE.Vector3(-plane.b, 1, plane.c).normalize();
      const tilt = up.angleTo(new THREE.Vector3(0, 1, 0));
      if (tilt > MAX_TILT) up.lerp(new THREE.Vector3(0, 1, 0), 1 - MAX_TILT / tilt).normalize();
      height = plane.a - SETTLE_M;
    } else {
      yaw = 0;
      const hs = sample(0).map((p) => p[2]);
      const top = Math.max(...hs);
      const bottom = Math.min(...hs);
      if (TERRACE[e.id] !== undefined) {
        // level with the high ground, the low side built up
        height = top - 0.25;
        if (top - bottom > 1.5) terrace = { top: height + 0.05, bottom: bottom - 4 };
        else height = (top + bottom) / 2;
      } else {
        // stood on the ground as it is: half sunk on the high side, propped on the low
        height = hs.reduce((a, b) => a + b, 0) / hs.length;
      }
    }

    const frame = frameAt(lng, lat, height);
    const tiltQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    const local = new THREE.Matrix4().compose(
      new THREE.Vector3(),
      tiltQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI - yaw)),
      new THREE.Vector3(CUBIT_M, CUBIT_M, CUBIT_M),
    );
    e.holder.matrix.multiplyMatrices(frame, local);
    e.holder.matrixWorldNeedsUpdate = true;
    this.placeTerrace(e, frame, sx, sz, terrace);
    this.placeGround(e, Math.max(sx, sz) * 1.5 + 80, groundAt, { sx, sz, yaw });
  }

  /** a disc of natural ground draped over the land around the site, fading at its edge */
  private placeGround(
    e: Entry,
    radius: number,
    groundAt: (east: number, north: number) => number,
    foot: { sx: number; sz: number; yaw: number },
  ) {
    const c = Math.cos(foot.yaw);
    const sn = Math.sin(foot.yaw);
    const n = 72;
    const size = radius * 2;
    const geo = new THREE.PlaneGeometry(size, size, n, n);
    geo.rotateX(-Math.PI / 2); // x east, z south
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const rgba = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const east = pos.getX(i);
      const north = -pos.getZ(i);
      pos.setY(i, groundAt(east, north) + GROUND_LIFT_M);
      uv.setXY(i, east / GROUND_TILE_M, north / GROUND_TILE_M);
      const r = Math.hypot(east, north) / radius;
      const fade = 1 - THREE.MathUtils.smoothstep(r, 0.45, 1);
      // contact shade: the ground darkens toward the model's footprint, where the sky is half hidden
      const u = -c * east + sn * north;
      const v = sn * east + c * north;
      const d = Math.hypot(Math.max(Math.abs(u) - foot.sx / 2, 0), Math.max(Math.abs(v) - foot.sz / 2, 0));
      const shade = 0.6 + 0.4 * THREE.MathUtils.smoothstep(d, 0, Math.min(14, 4 + Math.max(foot.sx, foot.sz) * 0.08));
      rgba.set([shade, shade, shade, fade], i * 4);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
    geo.computeVertexNormals();
    if (!e.ground) {
      const maps = loadGround();
      const mat = new THREE.MeshStandardMaterial({
        ...maps,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        roughness: 1,
        envMapIntensity: 0,
      });
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader
          // the same grain at two larger scales, so the repeat doesn't show
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
            {
              vec3 mean = vec3(${GROUND_MEAN.join(", ")});
              // a second, turned and rescaled copy, swapped in by a slow mask: no repeat to catch the eye
              vec4 turned = texture2D(map, mat2(0.8, -0.6, 0.6, 0.8) * vMapUv * 0.77 + vec2(0.37, 0.71));
              float swap = smoothstep(0.3, 0.7, 0.5 * texture2D(map, vMapUv * 0.029 + 0.13).g / mean.g);
              diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * turned.rgb, swap);
              vec3 macro = texture2D(map, vMapUv * 0.083 + 0.31).rgb / mean;
              vec3 broad = texture2D(map, vMapUv * 0.0121 + 0.67).rgb / mean;
              diffuseColor.rgb *= mix(vec3(1.0), macro, 0.45) * mix(vec3(1.0), broad, 0.35);
            }`,
          )
          // the terrain mesh follows the heights more coarsely than this patch does, and polygon
          // offset is moot under log depth: pull it a fraction of its distance toward the eye instead
          .replace(
            "#include <logdepthbuf_fragment>",
            `#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
              gl_FragDepth = log2( vFragDepth * 0.993 ) * logDepthBufFC * 0.5;
            #else
              #include <logdepthbuf_fragment>
            #endif`,
          );
      };
      mat.customProgramCacheKey = () => "site-ground";
      e.ground = new THREE.Mesh(geo, mat);
      e.ground.matrixAutoUpdate = false;
      e.ground.receiveShadow = true;
      e.ground.visible = false;
      this.root.add(e.ground);
    } else {
      e.ground.geometry.dispose();
      e.ground.geometry = geo;
    }
    e.ground.matrix.copy(frameAt(e.coord[0], e.coord[1], 0));
    e.ground.matrixWorldNeedsUpdate = true;
    e.ground.userData.radius = radius;
  }

  /** tint the ground to the land around it, once the imagery there is sharp enough to say */
  private tintGround(e: Entry) {
    const g = e.ground;
    if (!g || e.tinted) return;
    const radius = g.userData.radius as number;
    const [lng, lat] = e.coord;
    const sum = [0, 0, 0];
    let count = 0;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      const d = radius * (k % 2 ? 0.9 : 1.25);
      const c = this.stage.tiles.colourAt(
        lng + (Math.cos(a) * d) / (111320 * Math.cos(lat * DEG)),
        lat + (Math.sin(a) * d) / 111132,
      );
      if (!c || c.z < 12) return;
      const lin = new THREE.Color().setRGB(c.rgb[0], c.rgb[1], c.rgb[2], THREE.SRGBColorSpace);
      sum[0] += lin.r;
      sum[1] += lin.g;
      sum[2] += lin.b;
      count++;
    }
    g.material.color.setRGB(
      sum[0] / count / GROUND_MEAN[0],
      sum[1] / count / GROUND_MEAN[1],
      sum[2] / count / GROUND_MEAN[2],
    );
    e.tinted = true;
  }

  /** a stone platform under a level building, down to the lowest ground beneath it */
  private placeTerrace(e: Entry, frame: THREE.Matrix4, sx: number, sz: number, t: { top: number; bottom: number } | null) {
    e.terraceOn = !!t;
    if (!t) return;
    const depth = t.top - t.bottom;
    const geo = new THREE.BoxGeometry(sx * 1.04 + 2, depth, sz * 1.04 + 2);
    // frame is at the building's floor; the box hangs below it
    geo.translate(0, -depth / 2 + 0.05, 0);
    const color = TERRACE[e.id] ?? 0xc9b896;
    let mat = this.terraceMats.get(color);
    if (!mat) this.terraceMats.set(color, (mat = new THREE.MeshStandardMaterial({ color, roughness: 0.96, envMapIntensity: 0.25 })));
    if (!e.terrace) {
      e.terrace = new THREE.Mesh(geo, mat);
      e.terrace.matrixAutoUpdate = false;
      e.terrace.castShadow = true;
      e.terrace.receiveShadow = true;
      this.root.add(e.terrace);
    } else {
      e.terrace.geometry.dispose();
      e.terrace.geometry = geo;
    }
    e.terrace.matrix.copy(frame);
    e.terrace.matrixWorldNeedsUpdate = true;
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
      // centre the drawn part of the build on the site, its floor on the ground
      const shown = new THREE.Box3();
      const last = lastStructuralStep(e.id);
      for (const p of asm.parts) if (p.step <= last && p.frame) shown.union(p.box);
      const c = shown.getCenter(new THREE.Vector3());
      asm.root.position.set(-c.x, -shown.min.y, -c.z);
      e.footprint = shown.clone().translate(new THREE.Vector3(-c.x, -shown.min.y, -c.z));
      asm.root.traverse((o) => {
        // lamp and altar lights would relight every tile of the Earth's shader: the sun is enough
        if ((o as THREE.Light).isLight) o.visible = false;
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
      e.asm = asm;
      e.holder.add(asm.root);
      e.placedGen = -1;
      this.showProgress(e, performance.now(), false);
    });
  }

  private showProgress(e: Entry, now: number, animate = true) {
    const step = stepFor(e.id, e.progress);
    if (step === e.step || !e.asm) return;
    showStep(e.asm, step, now, animate && e.step >= 0 && step === e.step + 1);
    e.step = step;
  }

  /** every frame: drop-in animations, re-seating on finer ground, and hiding what's too far to see */
  tick() {
    const now = performance.now();
    const gen = this.stage.tiles.surfaceGen;
    const eye = this.stage.eyeECEF;
    const p = new THREE.Vector3();
    for (const e of this.entries.values()) {
      if (e.asm) tickParts(e.asm, now);
      const near = eye.distanceTo(ecef(e.coord[0], e.coord[1], 0, p)) < SHOW_WITHIN_M;
      e.holder.visible = near;
      if (e.terrace) e.terrace.visible = near && e.terraceOn;
      if (e.ground) {
        if (near) this.tintGround(e);
        e.ground.visible = near && e.tinted;
      }
      if (near && e.placedGen !== gen && (e.placedGen < 0 || now - this.lastPlace > 800)) {
        this.lastPlace = now;
        e.placedGen = gen;
        this.place(e);
      }
    }
  }

  /** how far the camera stands from a structure, metres */
  distanceTo(id: ArtifactId, from: LngLat) {
    const e = this.entries.get(id);
    return e ? distanceM(e.coord, from) : Infinity;
  }

  dispose() {
    this.disposed = true;
    for (const e of this.entries.values()) {
      e.asm?.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      e.terrace?.geometry.dispose();
      e.ground?.geometry.dispose();
      e.ground?.material.dispose();
    }
    for (const m of this.terraceMats.values()) m.dispose();
    this.entries.clear();
    this.stage.ecef.remove(this.root);
  }
}
