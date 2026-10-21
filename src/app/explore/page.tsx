import type { Metadata } from "next";
import { WorldView } from "@/components/world/WorldView";

export const metadata: Metadata = {
  title: "Explore — Visual Bible",
  description:
    "One world, one timeline: move through the ages on a 3D map of the biblical world — journeys, the people alive in each moment, located events, and the structures they built, with family trees and step-by-step builds a click away.",
};

export default function ExplorePage() {
  return <WorldView />;
}
