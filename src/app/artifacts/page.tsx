import type { Metadata } from "next";
import { Suspense } from "react";
import { ArtifactsView } from "@/components/artifacts/ArtifactsView";

export const metadata: Metadata = {
  title: "Cubit models — Visual Bible",
  description:
    "Small interactive 3D models built from the measurements in Scripture: both arks, the tabernacle and its furniture, Solomon’s house and sea, Ezekiel’s altar, and the city foursquare.",
};

export default function ArtifactsPage() {
  return (
    <Suspense fallback={null}>
      <ArtifactsView />
    </Suspense>
  );
}
