import type { ArtifactId } from "@/data/artifacts";
import { BUILDS } from "@/data/builds";
import type { ArtifactMats } from "@/lib/artifacts/materials";
import { ARK_GEOMETRY } from "./ark";
import { assemble, type Assembled, type StepFn } from "./engine";
import { NOAH_GEOMETRY } from "./noah";
import { TABERNACLE_GEOMETRY } from "./tabernacle";
import { TEMPLE_GEOMETRY } from "./temple";

const GEOMETRY: Partial<Record<ArtifactId, Record<string, StepFn>>> = {
  temple: TEMPLE_GEOMETRY,
  "noahs-ark": NOAH_GEOMETRY,
  tabernacle: TABERNACLE_GEOMETRY,
  ark: ARK_GEOMETRY,
};

export function hasBuild(id: ArtifactId) {
  return !!BUILDS[id] && !!GEOMETRY[id];
}

/** Every step of a build, parts tagged by step. */
export function assembleBuild(id: ArtifactId, m: ArtifactMats): Assembled {
  const info = BUILDS[id];
  const geo = GEOMETRY[id];
  if (!info || !geo) throw new Error(`no build for ${id}`);
  return assemble(
    info.steps.map((s) => s.id),
    geo,
    m,
  );
}

export { showStep, tickParts, showAll, type Assembled } from "./engine";
