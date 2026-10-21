import type { Metadata } from "next";
import { WorldView } from "@/components/world/WorldView";

export const metadata: Metadata = {
  title: "Journeys — Visual Bible",
  description:
    "Fly the journeys of Scripture over 3D satellite terrain: Abraham, Jacob, Joseph, the Exodus, the Conquest, David, the Exile, Jesus' ministry and Paul's voyages.",
};

/** the journeys now live in the explorer; keep old ?journey= links working */
export default function JourneysPage() {
  return <WorldView />;
}
