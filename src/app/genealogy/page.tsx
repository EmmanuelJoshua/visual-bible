import type { Metadata } from "next";
import { GenealogyView } from "@/components/graph/GenealogyView";

export const metadata: Metadata = {
  title: "Genealogy — Visual Bible",
  description:
    "A zoomable genealogy graph of the Bible, from Adam to the apostles, with the messianic line traced as a scarlet thread.",
};

export default function GenealogyPage() {
  return <GenealogyView />;
}
