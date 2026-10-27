import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { ArtifactId } from "@/data/artifacts";
import type { ArtifactMats, MatKey } from "@/lib/artifacts/materials";
import type { Anim, PartOpts, StepFn } from "./engine";

/**
 * Blender-made parts for the step-by-step builds (`blender/*.py` →
 * `public/models/*.glb`). Each `step_<id>` node holds that step's parts in
 * order; their `userData` (glTF extras) carries the animation, the label's
 * hero part and the counter material. Materials arrive only as names and are
 * swapped for the app's own, so a model and a code-built step look alike.
 */

const MODELS: Partial<Record<ArtifactId, string>> = {
  temple: "/models/temple.glb",
  tabernacle: "/models/tabernacle.glb",
  "noahs-ark": "/models/noah.glb",
  ark: "/models/ark.glb",
};

/** standalone pieces (blender/objects.py): one `object_<id>` node each */
const OBJECTS: Partial<Record<ArtifactId, string>> = {
  showbread: "/models/showbread.glb",
  "incense-altar": "/models/incense-altar.glb",
  "bronze-altar": "/models/bronze-altar.glb",
  "solomon-altar": "/models/solomon-altar.glb",
  "temple-cherubim": "/models/temple-cherubim.glb",
  "bronze-sea": "/models/bronze-sea.glb",
  "davids-tent": "/models/davids-tent.glb",
  "forest-house": "/models/forest-house.glb",
  "ezekiel-altar": "/models/ezekiel-altar.glb",
  "new-jerusalem": "/models/new-jerusalem.glb",
};

export function hasModel(id: ArtifactId) {
  return !!MODELS[id];
}

const cache = new Map<string, Promise<THREE.Group | null>>();

/** the model's scene, or null (no model, or it failed: the build falls back to code) */
export function loadBuildModel(id: ArtifactId): Promise<THREE.Group | null> {
  return load(MODELS[id], id);
}

/** a standalone piece, dressed in the app's materials, or null to build it in code */
export async function loadObjectModel(id: ArtifactId, m: ArtifactMats): Promise<THREE.Group | null> {
  const scene = await load(OBJECTS[id], id);
  if (!scene) return null;
  const g = new THREE.Group();
  g.name = id;
  g.add(dress(scene, m));
  return g;
}

function load(url: string | undefined, id: string): Promise<THREE.Group | null> {
  if (!url) return Promise.resolve(null);
  let p = cache.get(url);
  if (!p) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    p = loader.loadAsync(url).then(
      (gltf) => gltf.scene,
      (err) => {
        console.warn(`model for ${id} failed to load; using code-built parts`, err);
        cache.delete(url);
        return null;
      },
    );
    cache.set(url, p);
  }
  return p;
}

/** "drop", "drop:6", "grow", "grow:x", "pop", "fade", "slide:-14,0,0" */
function parseAnim(s: unknown): Anim | undefined {
  if (typeof s !== "string") return undefined;
  const [kind, arg] = s.split(":");
  switch (kind) {
    case "drop":
      return arg ? { kind: "drop", h: Number(arg) } : { kind: "drop" };
    case "grow":
      return arg === "x" || arg === "y" || arg === "z" ? { kind: "grow", axis: arg } : { kind: "grow" };
    case "slide": {
      const [x, y, z] = (arg ?? "0,0,0").split(",").map(Number);
      return { kind: "slide", from: [x, y, z] };
    }
    case "pop":
    case "fade":
      return { kind };
  }
  return undefined;
}

function partOpts(ud: Record<string, unknown>): PartOpts {
  const opts: PartOpts = { tile: false };
  const anim = parseAnim(ud.anim);
  if (anim) opts.anim = anim;
  if (ud.hero) opts.hero = true;
  if (typeof ud.tally === "string") opts.tally = ud.tally === "none" ? null : (ud.tally as MatKey);
  return opts;
}

/**
 * A model part, with the app's materials in place of the named placeholders.
 * Names the app has no material for (the gems, pearl, glass-like gold of New
 * Jerusalem) keep the look they were given in Blender.
 */
function dress(src: THREE.Object3D, m: ArtifactMats): THREE.Object3D {
  const obj = src.clone();
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const own = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.Material;
    const mat = (m as Partial<Record<string, THREE.Material>>)[own.name] ?? own;
    if (mat === own && own.transparent) own.depthWrite = false;
    o.material = mat;
    o.userData.src = mat;
    o.castShadow = !own.transparent;
    o.receiveShadow = true;
  });
  return obj;
}

/** where a model is shown: the step-by-step view keeps its cut-aways, the map and desk show it whole */
export type ModelView = "build" | "map";

/** one StepFn per `step_<id>` node in the model, keeping the parts meant for `view` */
export function modelSteps(model: THREE.Group, m: ArtifactMats, view: ModelView = "build"): Record<string, StepFn> {
  const out: Record<string, StepFn> = {};
  for (const node of model.children) {
    if (!node.name.startsWith("step_")) continue;
    const id = node.name.slice(5);
    out[id] = (k) => {
      for (const part of node.children) {
        const only = part.userData.view as ModelView | undefined;
        if (!only || only === view) k.add(dress(part, m), partOpts(part.userData));
      }
      const a = node.userData.anchor as number[] | undefined;
      if (a?.length === 3) k.anchor(a[0], a[1], a[2]);
    };
  }
  return out;
}
