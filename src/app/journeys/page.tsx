import type { Metadata } from "next";
import { JourneysView } from "@/components/journeys/JourneysView";

export const metadata: Metadata = {
  title: "Journeys — Visual Bible",
  description:
    "Fly the journeys of Scripture over 3D satellite terrain: Abraham, Jacob, Joseph, the Exodus, the Conquest, David, the Exile, Jesus' ministry and Paul's voyages.",
};

export default function JourneysPage() {
  return <JourneysView />;
}
