import type { Metadata } from "next";
import { Suspense } from "react";
import { ArtifactsView } from "@/components/artifacts/ArtifactsView";

export const metadata: Metadata = {
  title: "Cubit models — Visual Bible",
  description:
    "Build Solomon’s Temple, Noah’s Ark, the Tabernacle and the Ark of the Covenant step by step in 3D, verse by verse, with blueprints and a temple walk-through — plus cubit-scale models of the other sacred objects.",
};

export default function ArtifactsPage() {
  return (
    <Suspense fallback={null}>
      <ArtifactsView />
    </Suspense>
  );
}
