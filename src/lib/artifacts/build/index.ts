import type { ArtifactId } from "@/data/artifacts";
import { BUILDS } from "@/data/builds";
import type * as THREE from "three";
import type { ArtifactMats } from "@/lib/artifacts/materials";
import { ARK_GEOMETRY } from "./ark";
import { assemble, type Assembled, type StepFn } from "./engine";
import { modelSteps, type ModelView } from "./model";
import { NOAH_GEOMETRY } from "./noah";
import { TABERNACLE_FX, TABERNACLE_GEOMETRY } from "./tabernacle";
import { TEMPLE_FX, TEMPLE_GEOMETRY } from "./temple";

const GEOMETRY: Partial<Record<ArtifactId, Record<string, StepFn>>> = {
  temple: TEMPLE_GEOMETRY,
  "noahs-ark": NOAH_GEOMETRY,
  tabernacle: TABERNACLE_GEOMETRY,
  ark: ARK_GEOMETRY,
};

/** fire and light that stay in code when a step's parts come from a model */
const FX: Partial<Record<ArtifactId, Record<string, StepFn>>> = {
  temple: TEMPLE_FX,
  tabernacle: TABERNACLE_FX,
};

export function hasBuild(id: ArtifactId) {
  return !!BUILDS[id] && !!GEOMETRY[id];
}

/**
 * Every step of a build, parts tagged by step. With a Blender model, its
 * steps replace the code-built ones (plus their fire and light); any step the
 * model leaves out is still built in code.
 */
export function assembleBuild(
  id: ArtifactId,
  m: ArtifactMats,
  model?: THREE.Group | null,
  view: ModelView = "build",
): Assembled {
  const info = BUILDS[id];
  const geo = GEOMETRY[id];
  if (!info || !geo) throw new Error(`no build for ${id}`);
  const steps: Record<string, StepFn> = { ...geo };
  if (model) {
    const fx = FX[id] ?? {};
    for (const [step, fn] of Object.entries(modelSteps(model, m, view))) {
      if (!(step in geo)) continue;
      steps[step] = (k) => {
        fn(k);
        fx[step]?.(k);
      };
    }
  }
  return assemble(
    info.steps.map((s) => s.id),
    steps,
    m,
  );
}

export { showStep, tickParts, showAll, type Assembled } from "./engine";
export { loadBuildModel, loadObjectModel, hasModel, type ModelView } from "./model";
