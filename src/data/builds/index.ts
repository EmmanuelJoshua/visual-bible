import type { ArtifactId } from "@/data/artifacts";
import { ARK_BUILD } from "./ark";
import { NOAH_BUILD } from "./noah";
import { TABERNACLE_BUILD } from "./tabernacle";
import { TEMPLE_BUILD } from "./temple";
import type { BuildInfo } from "./types";

/** Artifacts that have a guided, step-by-step construction. */
export const BUILDS: Partial<Record<ArtifactId, BuildInfo>> = {
  temple: TEMPLE_BUILD,
  "noahs-ark": NOAH_BUILD,
  tabernacle: TABERNACLE_BUILD,
  ark: ARK_BUILD,
};

export const BUILD_ORDER: ArtifactId[] = ["temple", "noahs-ark", "tabernacle", "ark"];

export type { BuildInfo, BuildStepInfo, Blueprint, BlueprintEl, WalkStop } from "./types";
