import type { Metadata } from "next";
import { TimelineView } from "@/components/timeline/TimelineView";

export const metadata: Metadata = {
  title: "Timeline — Visual Bible",
  description:
    "A cinematic timeline of biblical events from Creation to the early church, era by era.",
};

export default function TimelinePage() {
  return <TimelineView />;
}
