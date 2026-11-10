import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { TownNow } from "@/world/towns";
import { inTownNow } from "./cities";
import type { DioramaStage } from "./stage";

/**
 * What stands on the land close up: the trees, scrub, grass and boulders of
 * each place. Modelled in Blender: near the camera, trees of leaf cards cut
 * from a painted atlas (blender/trees.py), swaying, lit through; further off
 * the low-poly kit (blender/landscape.py). Drawn many at once (instanced),
 * and only near the camera.
 *
 * The land is cut into half-kilometre cells. Each grows the same things every
 * time (its seed is its place), chosen by what the land is there: the
 * painting's colour (green or bare), the slope, the height and the latitude,
 * gathered into groves and clearings by a little noise. Olive groves and
 * scrub on the hills of Judah and Samaria, palms by the Jordan and the Nile,
 * pine and oak in the mountains, acacia in the wilderness, boulders on the
 * steeps; around the towns, orchards in rows. A cell near the camera grows
 * fully; further off only its first few (the same few), so the screen holds
 * about the same number of things wherever the camera is. Nothing grows
 * inside a town standing in the year (cities.ts builds those).
 */

type Kind = "tree_olive" | "tree_cypress" | "tree_palm" | "tree_pine" | "tree_oak" | "tree_acacia" | "shrub" | "grass" | "rock_a" | "rock_b";
const KINDS: Kind[] = ["tree_olive", "tree_cypress", "tree_palm", "tree_pine", "tree_oak", "tree_acacia", "shrub", "grass", "rock_a", "rock_b"];
/** each kind near (the leaf-card trees, blender/trees.py) and further off (the low-poly kit, blender/landscape.py) */
const NEAR: Record<Kind, string> = { tree_olive: "olive", tree_cypress: "cypress", tree_palm: "palm", tree_pine: "pine", tree_oak: "oak", tree_acacia: "acacia", shrub: "shrub", grass: "grass", rock_a: "rock_a", rock_b: "rock_b" };
const FAR: Partial<Record<Kind, string>> = { tree_olive: "tree_olive", tree_cypress: "tree_cypress", tree_palm: "tree_palm", tree_pine: "tree_pine", tree_oak: "tree_oak", tree_acacia: "tree_acacia", shrub: "shrub", rock_a: "rock_a", rock_b: "rock_b" };
const CAPACITY: Record<Kind, [number, number]> = {
  // near, far
  tree_olive: [6000, 24000], tree_cypress: [1500, 4000], tree_palm: [3000, 8000], tree_pine: [3500, 14000], tree_oak: [3500, 14000], tree_acacia: [1500, 3000],
  shrub: [7000, 20000], grass: [14000, 0], rock_a: [4000, 7000], rock_b: [1500, 3000],
};
/** the far kit's leaf colours (linear), matched to the atlas's at the distance the near trees hand over */
const FAR_LEAF: Partial<Record<Kind, THREE.Color>> = {
  tree_olive: new THREE.Color(0.2, 0.25, 0.15),
  tree_oak: new THREE.Color(0.075, 0.13, 0.03),
  tree_pine: new THREE.Color(0.05, 0.1, 0.035),
  tree_cypress: new THREE.Color(0.025, 0.055, 0.02),
  tree_palm: new THREE.Color(0.1, 0.16, 0.04),
  tree_acacia: new THREE.Color(0.18, 0.21, 0.08),
  shrub: new THREE.Color(0.12, 0.15, 0.06),
};
const SOFT: Partial<Record<Kind, true>> = { tree_olive: true, tree_cypress: true, tree_palm: true, tree_pine: true, tree_oak: true, tree_acacia: true, shrub: true, grass: true };
/**
 * drawn larger than life, as a model railway's trees are: at true size a grove
 * a kilometre off is a few specks; and larger still with distance, where there
 * are fewer, so the hills stay clothed
 */
const GROW: Partial<Record<Kind, number>> = { tree_olive: 2.1, tree_cypress: 1.9, tree_palm: 1.8, tree_pine: 2, tree_oak: 2.1, tree_acacia: 2, shrub: 2.2, grass: 1.7, rock_a: 1.5, rock_b: 1.5 };

/** something placed: where, which way, how big (x, y, z), how far into the ground (m), its tint; its height, as of a terrain generation */
type Item = { kind: Kind; lng: number; lat: number; yaw: number; sx: number; sy: number; sz: number; sink: number; tint: [number, number, number]; m: number; gen: number };
type Placed = Item & { idx: number };
type Rand = { s: number };
type Cell = { cx: number; cy: number; rand: Rand; tried: number; items: Placed[]; grid: Float32Array; orchard: Set<string>; farm: number; towns: TownNow[] };
type Pick = { kind: Kind; size: number; sink: number };
type MeshSet = { parts: THREE.InstancedMesh[]; matrix: THREE.InstancedBufferAttribute; color: THREE.InstancedBufferAttribute; cap: number };

const CELL = 0.005; // degrees, ~0.5 km
const GRID = 8; // a cell's heights for choosing, 9 × 9
/** candidates a cell near the camera tries */
const FULL = 1600;
/** within this of the camera a cell grows fully, km; beyond, falling as the square of the distance */
const FULL_KM = 1.2;
/** nothing grows past this from the camera, km: a tree there is under a pixel */
const FAR_KM = 9;
/** the leaf-card trees within this of the camera, km; the low-poly ones beyond */
const NEAR_KM = 1.5;
/** grass only this close, km */
const GRASS_KM = 0.5;
/** towns are looked for out to here, km */
const TOWN_KM = 12;
/** the camera must be within this of what it looks at for any of it to show, km */
export const SCATTER_BELOW = 12;
/** ms a frame may spend growing cells; the rest waits for the next frame */
const BUDGET_MS = 8;

export class Scatter {
  readonly group = new THREE.Group();
  /** resolves once both kits are in, and every material made */
  readonly loaded: Promise<void>;
  private sets = new Map<string, MeshSet>();
  private cells = new Map<string, Cell>();
  private townsVersion = -1;
  private lastKey = "";
  private lastBuild = 0;
  private builtGen = -1;
  private ready = false;
  private budgetEnd = 0;
  private unfinished = false;
  private frustum = new THREE.Frustum();
  private box = new THREE.Box3();
  private bare: { at: [number, number]; km: number }[] = [];
  /** shared by every swaying, back-lit material */
  private uniforms = { uTime: { value: 0 }, uSunView: { value: new THREE.Vector3(0, 1, 0) } };

  constructor(private stage: DioramaStage) {
    this.group.name = "scatter";
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const atlas = new THREE.TextureLoader().loadAsync("/models/foliage.png").then((t) => {
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      return t;
    });
    this.loaded = Promise.all([loader.loadAsync("/models/trees.glb"), loader.loadAsync("/models/landscape.glb"), atlas]).then(([near, far, leaves]) => {
      const foliage = this.foliage(leaves);
      for (const kind of KINDS) {
        this.addSet(`${kind}|near`, near.scene, NEAR[kind], CAPACITY[kind][0], (src) => {
          if (src.name.startsWith("foliage")) return foliage;
          // boulders a weathered limestone, a shade darker than the ground they lie on
          const color = kind.startsWith("rock") ? new THREE.Color(0.36, 0.33, 0.29) : src.color;
          // matte, like everything that grows or lies on a hillside: the simpler (Lambert) lighting, at half the cost
          const m = new THREE.MeshLambertMaterial({ color, vertexColors: true });
          if (src.name.startsWith("bark")) this.sway(m);
          return m;
        });
        const lo = FAR[kind];
        if (lo) {
          this.addSet(`${kind}|far`, far.scene, lo, CAPACITY[kind][1], (src) => {
            // boulders a weathered grey, not the kit's fresh-cut limestone
            // the leaf-card trees' colours, and lit as soft crowns, not facets: further off they meet seamlessly
            const color = kind.startsWith("rock") ? new THREE.Color(0.36, 0.33, 0.29) : (FAR_LEAF[kind] && src.name !== "bark" ? FAR_LEAF[kind]!.clone() : src.color);
            return new THREE.MeshLambertMaterial({ color, flatShading: !SOFT[kind], side: SOFT[kind] ? THREE.DoubleSide : THREE.FrontSide });
          });
        }
      }
      this.ready = true;
    });
  }

  /** a kit piece as instanced meshes, a part per material, sharing one set of transforms and tints */
  private addSet(id: string, root: THREE.Object3D, name: string, cap: number, material: (src: THREE.MeshStandardMaterial) => THREE.Material) {
    const node = root.getObjectByName(name);
    if (!node || cap <= 0) return;
    root.updateMatrixWorld(true);
    const matrix = new THREE.InstancedBufferAttribute(new Float32Array(cap * 16), 16);
    matrix.setUsage(THREE.DynamicDrawUsage);
    const color = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    color.setUsage(THREE.DynamicDrawUsage);
    const parts: THREE.InstancedMesh[] = [];
    node.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // every kit piece sits at its file's origin, in metres (its world matrix only undoes the
      // compression's quantizing); drawn in km
      const geo = unpacked(m.geometry);
      geo.applyMatrix4(m.matrixWorld);
      geo.scale(0.001, 0.001, 0.001);
      const mat = material(m.material as THREE.MeshStandardMaterial);
      const inst = new THREE.InstancedMesh(geo, mat, cap);
      inst.instanceMatrix = matrix;
      inst.instanceColor = color;
      inst.count = 0;
      inst.castShadow = !id.startsWith("grass");
      inst.receiveShadow = true;
      inst.frustumCulled = false;
      if ((mat as THREE.MeshLambertMaterial).alphaTest > 0) inst.customDepthMaterial = this.leafDepth((mat as THREE.MeshLambertMaterial).map!);
      this.group.add(inst);
      parts.push(inst);
    });
    this.sets.set(id, { parts, matrix, color, cap });
  }

  /**
   * the leaves: cut out of the atlas (with alpha to coverage, so their edges
   * are soft and they don't thin away as the atlas mips), swaying a little, and
   * glowing where the sun is behind them
   */
  private foliage(map: THREE.Texture) {
    const m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, alphaToCoverage: true, side: THREE.DoubleSide, vertexColors: true });
    this.sway(m, (shader) => {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uSunView;")
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          #ifdef USE_MAP
          {
            // as the atlas mips its cut-outs average toward clear: hold their coverage up
            vec2 texel = fwidth(vMapUv) * vec2(1024.0, 512.0);
            float lod = max(0.0, log2(max(max(texel.x, texel.y), 1e-4)));
            diffuseColor.a = clamp(diffuseColor.a * (1.0 + lod * 0.3), 0.0, 1.0);
          }
          #endif`,
        )
        .replace(
          "#include <opaque_fragment>",
          `{
            // sunlight through the leaves when the sun is behind them
            float back = max(dot(normalize(-vViewPosition), uSunView), 0.0);
            outgoingLight += diffuseColor.rgb * vec3(1.0, 0.93, 0.62) * pow(back, 4.0) * 0.6;
          }
          #include <opaque_fragment>`,
        );
    });
    return m;
  }

  /** a tree's sway in the breeze: nothing at its foot, most at its crown, each tree out of step with the next */
  private sway(m: THREE.Material, more?: (shader: THREE.WebGLProgramParametersWithUniforms) => void) {
    const uniforms = this.uniforms;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;").replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
          float phase = dot(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), vec2(371.0, 517.0));
          #else
          float phase = 0.0;
          #endif
          // kit units are km: a 10 m crown moves about half a metre
          float h = max(transformed.y, 0.0);
          float sway = h * h * 4.0;
          transformed.x += (sin(uTime * 1.1 + phase) + 0.3 * sin(uTime * 2.9 + phase * 1.7 + transformed.z * 900.0)) * sway;
          transformed.z += cos(uTime * 0.9 + phase * 1.3) * sway * 0.6;
        }`,
      );
      more?.(shader);
    };
    m.customProgramCacheKey = () => (more ? "scatter-foliage" : "scatter-sway");
  }

  /** the shadow of cut-out leaves, swaying with them */
  private leafDepth(map: THREE.Texture) {
    const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
    this.sway(d);
    d.customProgramCacheKey = () => "scatter-leaf-depth";
    return d;
  }

  /** once a frame: rebuilt when the camera has moved enough, or the land under it has changed */
  update(now: number) {
    const s = this.stage;
    const d = s.camera.position.distanceTo(s.controls.target);
    const show = this.ready && d < SCATTER_BELOW;
    this.group.visible = show;
    if (!show) return;
    this.uniforms.uTime.value = now / 1000;
    // the sun, as the camera sees it
    this.uniforms.uSunView.value.copy(s.key.position).sub(s.key.target.position).normalize().transformDirection(s.camera.matrixWorldInverse);
    const cam = s.camera.position;
    const dir = s.camera.getWorldDirection(new THREE.Vector3());
    const step = Math.max(0.04, d * 0.06);
    const q = (v: number, k: number) => Math.round(v / k);
    const clearings = [...s.clearings.values()].map((c) => `${c.at[0].toFixed(4)}${c.at[1].toFixed(4)}${c.km.toFixed(3)}`).join();
    const key = [q(cam.x, step), q(cam.y, step), q(cam.z, step), q(dir.x, 0.08), q(dir.y, 0.08), q(dir.z, 0.08), q(Math.log(s.exaggeration), 0.02), s.albedoGen, clearings].join(",");
    const gen = s.terrain?.gen ?? 0;
    // the towns standing changed with the year: grow every cell again round them
    const version = s.cities?.version ?? 0;
    if (version !== this.townsVersion) {
      this.townsVersion = version;
      this.cells.clear();
      this.lastKey = "";
    }
    // a build that ran out of time carries on next frame
    const due = this.unfinished ? now - this.lastBuild > 30 : key !== this.lastKey ? now - this.lastBuild > 200 : gen !== this.builtGen && now - this.lastBuild > 700;
    if (!due) return;
    this.lastKey = key;
    this.lastBuild = now;
    this.builtGen = gen;
    this.build(gen);
  }

  private build(gen: number) {
    const s = this.stage;
    const cam = s.camera.position;
    this.budgetEnd = performance.now() + BUDGET_MS;
    this.unfinished = false;
    s.camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(s.camera.projectionMatrix, s.camera.matrixWorldInverse));
    const [lng, lat] = s.lngLatOf(cam);
    const kmLng = 111.32 * Math.cos((lat * Math.PI) / 180);
    const rLng = FAR_KM / kmLng;
    const rLat = FAR_KM / 111.32;
    const here = (s.cities?.active ?? []).filter((t) => Math.hypot((t.at[0] - lng) * kmLng, (t.at[1] - lat) * 111.32) - t.radius / 1000 < TOWN_KM);
    const towns = here.filter((t) => t.houses !== false);
    // a sanctuary, a fortress or the pyramids (landmarks without a town) stand on bare ground
    this.bare = here.filter((t) => t.houses === false).map((t) => ({ at: t.at, km: Math.max(t.radius, 150) / 1000 + 0.35 }));
    const found: { d: number; cx: number; cy: number }[] = [];

    const x0 = Math.floor((lng - rLng) / CELL);
    const x1 = Math.floor((lng + rLng) / CELL);
    const y0 = Math.floor((lat - rLat) / CELL);
    const y1 = Math.floor((lat + rLat) / CELL);
    const nw = new THREE.Vector3();
    const se = new THREE.Vector3();
    const mid = new THREE.Vector3();
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        s.world([cx * CELL, (cy + 1) * CELL], 0, nw);
        s.world([(cx + 1) * CELL, cy * CELL], 0, se);
        s.world([(cx + 0.5) * CELL, (cy + 0.5) * CELL], 0, mid);
        this.box.min.set(nw.x, mid.y - 1.2, nw.z);
        this.box.max.set(se.x, mid.y + 1.2, se.z);
        const dk = Math.max(0.05, this.box.distanceToPoint(cam));
        if (dk > FAR_KM || !this.frustum.intersectsBox(this.box)) continue;
        found.push({ d: dk, cx, cy });
      }
    }
    // the nearest first: grown first while there is time, and if a kind runs out it runs out far away
    found.sort((a, b) => a.d - b.d);
    const lists: { d: number; items: Item[] }[] = [];
    for (const f of found) {
      // falling with distance, but not as fast as the square: further trees are drawn larger, and fewer would leave the hills bare
      const want = Math.round(FULL * Math.min(1, (FULL_KM / f.d) ** 1.5));
      if (want < 4) continue;
      const cell = this.cell(f.cx, f.cy, towns, want);
      if (!cell) continue;
      const items: Item[] = [];
      for (const it of cell.items) {
        if (it.idx >= want) break;
        items.push(it);
      }
      if (items.length) lists.push({ d: f.d, items });
    }
    this.write(lists, gen);
  }

  /* -------------------------------------------------------------- nature */

  /** a cell, grown toward `want` candidates (as far as time and the land's colour allow); null if not known yet */
  private cell(cx: number, cy: number, towns: TownNow[], want: number): Cell | null {
    const s = this.stage;
    const key = `${cx},${cy}`;
    let cell = this.cells.get(key);
    if (!cell) {
      if (performance.now() > this.budgetEnd) {
        this.unfinished = true;
        return null;
      }
      const lng0 = cx * CELL;
      const lat0 = cy * CELL;
      const clng = lng0 + CELL / 2;
      const clat = lat0 + CELL / 2;
      if (!s.albedoAt(clng, clat)) return null;
      const grid = new Float32Array((GRID + 1) ** 2);
      for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) grid[j * (GRID + 1) + i] = s.metresAt(lng0 + (i / GRID) * CELL, lat0 + (j / GRID) * CELL);
      const kmLng = 111.32 * Math.cos((clat * Math.PI) / 180);
      // fields and orchards round a town; none inside it
      let farm = 0;
      const near: TownNow[] = [];
      for (const t of towns) {
        const dk = Math.hypot((t.at[0] - clng) * kmLng, (t.at[1] - clat) * 111.32);
        const r = t.radius / 1000;
        farm = Math.max(farm, 1 - smoothstep(r + 0.4, 2 * r + 2.8, dk));
        if (dk < r * 1.3 + 0.4) near.push(t);
      }
      cell = { cx, cy, rand: { s: (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) >>> 0 || 1 }, tried: 0, items: [], grid, orchard: new Set(), farm, towns: near };
      this.cells.set(key, cell);
      if (this.cells.size > 6000) {
        const first = this.cells.keys().next().value;
        if (first) this.cells.delete(first);
      }
    }
    while (cell.tried < want) {
      if ((cell.tried & 63) === 0 && performance.now() > this.budgetEnd) {
        this.unfinished = true;
        break;
      }
      if (!this.grow(cell)) break;
    }
    return cell;
  }

  /** one more candidate for a cell; false if the land's colour there isn't in yet */
  private grow(cell: Cell): boolean {
    const s = this.stage;
    const r = cell.rand;
    const saved = r.s;
    const fx = next(r);
    const fy = next(r);
    let lng = (cell.cx + fx) * CELL;
    let lat = (cell.cy + fy) * CELL;
    const col = s.albedoAt(lng, lat);
    if (!col) {
      // the same candidate comes again once the colour is in
      r.s = saved;
      return false;
    }
    const yaw = next(r) * Math.PI * 2;
    const roll = next(r);
    const vary = next(r);
    const idx = cell.tried++;

    // the land here, from the cell's grid
    const gx = fx * GRID;
    const gy = fy * GRID;
    const i = Math.min(GRID - 1, Math.floor(gx));
    const j = Math.min(GRID - 1, Math.floor(gy));
    const tx = gx - i;
    const ty = gy - j;
    const g = cell.grid;
    const n = GRID + 1;
    const h00 = g[j * n + i];
    const h10 = g[j * n + i + 1];
    const h01 = g[(j + 1) * n + i];
    const h11 = g[(j + 1) * n + i + 1];
    const h = (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
    // the shore and the sea (but not the Jordan's valley, hundreds of metres under sea level and green)
    if (h < 1 && s.nearSea(lng, lat)) return true;
    const cellM = (CELL * 111320) / GRID;
    const dx = ((h10 - h00) * (1 - ty) + (h11 - h01) * ty) / (cellM * Math.cos((lat * Math.PI) / 180));
    const dz = ((h01 - h00) * (1 - tx) + (h11 - h10) * tx) / cellM;
    const slope = Math.hypot(dx, dz);
    if (s.inLake(lng, lat)) return true;
    for (const t of cell.towns) if (inTownNow(t, lng, lat)) return true;

    // how the painting reads: watered ground as green as it is red, and dark (the Nile, the
    // Euphrates); the paler the rest, the barer (Galilee darkest, the deserts palest)
    const lum = (col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11) / 255;
    if (col[2] > col[0] + 6 && lum < 0.42) return true; // water-coloured: a river or a marsh
    const lush = col[1] - col[0] > -8 && lum < 0.5;
    const veg = Math.min(1, Math.max(0, (0.68 - lum) / 0.25));
    const clump = 0.6 * noise(lng * 620, lat * 620) + 0.4 * noise(lng * 1900 + 17, lat * 1900 + 5);
    const grove = smoothstep(0.36, 0.72, clump);

    let pick: Pick | null;
    let sx: number;
    let sy: number;
    // a town in the hot, low desert stands in an oasis, watered by its spring (Jericho, "the city of palm trees")
    const oasis = !lush && veg < 0.25 && lat < 33 && h < 300 && cell.farm > 0.45;
    if (cell.farm > 0 && slope < 0.16 && (lush || veg > 0.25 || oasis) && noise(lng * 240 + 3, lat * 240 + 9) > 0.66 - 0.18 * cell.farm) {
      // an orchard round a town, on gentle ground: trees in rows, a lattice a few hundred metres across
      const a = noise(Math.floor(lng * 240) * 1.7, Math.floor(lat * 240) * 2.3) * Math.PI;
      const kmLng = 111.32 * Math.cos((lat * Math.PI) / 180);
      const e = (lng - cell.cx * CELL) * kmLng * 1000;
      const nz = (lat - cell.cy * CELL) * 111320;
      const spacing = 9;
      const u = Math.round((e * Math.cos(a) + nz * Math.sin(a)) / spacing);
      const v = Math.round((-e * Math.sin(a) + nz * Math.cos(a)) / spacing);
      const k = `${u},${v}`;
      if (cell.orchard.has(k)) return true;
      cell.orchard.add(k);
      lng = cell.cx * CELL + ((u * Math.cos(a) - v * Math.sin(a)) * spacing) / (kmLng * 1000);
      lat = cell.cy * CELL + ((u * Math.sin(a) + v * Math.cos(a)) * spacing) / 111320;
      pick = oasis || (lat < 31.6 && h < 300) ? { kind: "tree_palm", size: 0.9, sink: 0.3 } : { kind: "tree_olive", size: 0.85, sink: 0.3 };
      sx = sy = pick.size * (0.85 + vary * 0.25);
    } else {
      pick = choose({ veg, lush, slope, h, lat, lng, grove }, roll, vary);
      if (!pick) return true;
      sx = pick.size * (0.75 + vary * 0.55);
      sy = sx * (0.85 + ((vary * 7.3) % 1) * 0.3);
    }
    // no two trees quite alike: a little lighter or darker, warmer or cooler
    const b = 0.84 + 0.28 * ((vary * 13.7) % 1);
    const w = pick.kind.startsWith("rock") ? 0 : (((vary * 7.1) % 1) - 0.5) * 0.14;
    cell.items.push({ kind: pick.kind, lng, lat, yaw, sx, sy, sz: sx, sink: pick.sink, tint: [b * (1 + w), b, b * (1 - w * 1.4)], m: h, gen: -1, idx });
    return true;
  }

  /* --------------------------------------------------------------- write */

  private write(lists: { d: number; items: Item[] }[], gen: number) {
    const s = this.stage;
    const counts = new Map<MeshSet, number>();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const clearings = [...s.clearings.values(), ...this.bare];
    // larger than life only from a way off: come right down (to a build at its true size) and a tree is a
    // tree's height, not twice the temple's
    const camera = s.camera.position.distanceTo(s.controls.target);
    const life = smoothstep(0.3, 1.6, camera);
    for (const list of lists) {
      const far = Math.min(2.4, 1 + 0.22 * list.d);
      for (const it of list.items) {
        // across a band, not at a line: each tree has its own distance to change at
        const lod = list.d < NEAR_KM * (0.75 + 0.5 * ((it.yaw * 7.13) % 1)) ? "near" : "far";
        if (it.kind === "grass" && list.d > GRASS_KM) continue;
        const set = this.sets.get(`${it.kind}|${lod}`);
        if (!set) continue;
        const i = counts.get(set) ?? 0;
        if (i >= set.cap) continue;
        if (clearings.length && clearings.some((c) => s.kmBetween(c.at, [it.lng, it.lat]) < c.km)) continue;
        if (it.gen !== gen) {
          it.m = s.metresAt(it.lng, it.lat);
          it.gen = gen;
        }
        counts.set(set, i + 1);
        s.toWorld(it.lng, it.lat, p);
        p.y = s.yOf(it.m) - it.sink / 1000;
        q.setFromAxisAngle(up, it.yaw);
        const k = (1 + ((GROW[it.kind] ?? 1) - 1) * life) * (SOFT[it.kind] ? 1 + (far - 1) * life : 1);
        sc.set(it.sx * k, it.sy * k, it.sz * k);
        m.compose(p, q, sc);
        m.toArray(set.matrix.array, i * 16);
        set.color.array[i * 3] = it.tint[0];
        set.color.array[i * 3 + 1] = it.tint[1];
        set.color.array[i * 3 + 2] = it.tint[2];
      }
    }
    for (const set of this.sets.values()) {
      const n = counts.get(set) ?? 0;
      set.matrix.needsUpdate = true;
      set.color.needsUpdate = true;
      for (const inst of set.parts) inst.count = n;
    }
  }

  dispose() {
    for (const set of this.sets.values()) {
      for (const inst of set.parts) {
        inst.geometry.dispose();
        (inst.material as THREE.Material).dispose();
        inst.customDepthMaterial?.dispose();
      }
    }
  }
}

/** a copy with plain float attributes: the compressed (normalized integer) ones clamp when moved or scaled */
function unpacked(src: THREE.BufferGeometry) {
  const geo = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(src.attributes)) {
    const n = a.itemSize;
    const out = new Float32Array(a.count * n);
    for (let i = 0; i < a.count; i++) {
      out[i * n] = a.getX(i);
      if (n > 1) out[i * n + 1] = a.getY(i);
      if (n > 2) out[i * n + 2] = a.getZ(i);
      if (n > 3) out[i * n + 3] = a.getW(i);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, n));
  }
  if (src.index) geo.setIndex(src.index.clone());
  return geo;
}

/** what grows here, if anything */
function choose(c: { veg: number; lush: boolean; slope: number; h: number; lat: number; lng: number; grove: number }, roll: number, vary: number): Pick | null {
  const { veg, lush, slope, h, lat, lng, grove } = c;
  // Egypt, Sinai, Arabia and the plains of Mesopotamia: date palms by the water, acacia and tamarisk
  // beyond it, and far fewer of them; no Mediterranean woods
  const arid = h < 700 && (lat < 31.1 || (lng > 38.5 && lat < 35.6));
  const rock = (size = 1): Pick => ({ kind: vary < 0.7 ? "rock_a" : "rock_b", size, sink: 0.4 });
  const shrub = (size: number): Pick => ({ kind: "shrub", size, sink: 0.1 });
  const grass = (): Pick => ({ kind: "grass", size: 1, sink: 0.05 });
  if (slope > 0.7) return roll < 0.1 ? rock() : roll < 0.14 ? shrub(0.8) : null;
  const mountain = h > 1100 || lat > 37.5;
  const hot = lat < 32.4 && h < 450;
  if (arid) {
    if (lush) {
      const trees = 0.05 + 0.4 * grove;
      if (roll < trees) return { kind: vary < 0.82 ? "tree_palm" : "tree_acacia", size: 1, sink: 0.3 };
      if (roll < trees + 0.1) return shrub(1);
      return vary < 0.5 ? grass() : null;
    }
    if (roll < veg * (0.004 + 0.05 * grove)) return { kind: vary < 0.75 ? "tree_acacia" : "tree_palm", size: 0.9, sink: 0.2 };
    if (roll < 0.03 + 0.1 * veg * grove) return shrub(0.7);
    return roll < 0.06 + slope * 0.12 ? rock(0.8) : null;
  }
  if (lush) {
    // the watered valleys: palm groves in the south, orchards and woods elsewhere
    const trees = 0.06 + 0.5 * grove;
    if (roll < trees) {
      if (mountain) return { kind: vary < 0.6 ? "tree_pine" : "tree_oak", size: 1, sink: 0.3 };
      if (lat < 34 && h < 300) return { kind: vary < 0.7 ? "tree_palm" : vary < 0.9 ? "tree_olive" : "tree_cypress", size: 1, sink: 0.3 };
      return { kind: vary < 0.45 ? "tree_olive" : vary < 0.8 ? "tree_oak" : "tree_cypress", size: 1, sink: 0.3 };
    }
    if (roll < trees + 0.12) return shrub(1.1);
    return vary < 0.55 ? grass() : null;
  }
  if (veg > 0) {
    // the hills: woods and olive groves where the land is darkest, maquis and stone where it is paler
    const trees = veg * (0.03 + 0.55 * grove);
    if (roll < trees) {
      if (mountain) return { kind: vary < 0.55 ? "tree_pine" : "tree_oak", size: 1, sink: 0.3 };
      if (slope > 0.35) return { kind: vary < 0.6 ? "tree_oak" : "tree_pine", size: 0.9, sink: 0.3 };
      return { kind: vary < 0.55 ? "tree_olive" : vary < 0.85 ? "tree_oak" : vary < 0.93 ? "tree_cypress" : "tree_pine", size: 1, sink: 0.3 };
    }
    const scrub = 0.06 + 0.3 * veg * (0.5 + grove);
    if (roll < trees + scrub) return shrub(0.8 + 0.4 * veg);
    if (roll < trees + scrub + 0.03 + 0.06 * (1 - veg) + slope * 0.12) return rock();
    // tufts of grass between, where anything grows
    return vary < 0.2 + 0.45 * veg ? grass() : null;
  }
  // desert: a thorn tree here and there, a few bushes, stones
  if (hot && roll < 0.006 + 0.012 * grove) return { kind: "tree_acacia", size: 1, sink: 0.2 };
  if (roll < 0.035) return shrub(0.6);
  return roll < 0.07 + slope * 0.12 ? rock(0.8) : null;
}

/** xorshift: a seeded sequence whose state can be put back */
function next(r: Rand) {
  let s = r.s;
  s ^= s << 13;
  s ^= s >>> 17;
  s ^= s << 5;
  r.s = s >>> 0;
  return r.s / 4294967296;
}

function hash2(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** smooth value noise, 0..1, a lattice cell per unit */
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
