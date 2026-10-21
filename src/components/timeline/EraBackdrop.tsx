"use client";

import type { Era } from "@/data/eras";
import { ThreeUIScene } from "@/components/atmosphere/ThreeUIScene";

/**
 * 3D scenes only run inside ink-black chapters, where the iframe's dark stage
 * blends naturally. Cream and red chapters stay pure editorial paper.
 */
export function EraBackdrop({ era }: { era: Era }) {
  if (era.theme !== "ink") return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <ThreeUIScene kind={era.backdrop} opacity={0.5} />
      {/* keep chapter text legible over the scene */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#141210]/75 via-transparent to-[#141210]" />
    </div>
  );
}
