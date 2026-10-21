"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { GraphToolbar } from "./GraphToolbar";
import { DetailPanel } from "@/components/DetailPanel";
import { revealAndSelect } from "@/lib/reveal";
import { corePersonBySlug } from "@/data";
import { useExplorerStore } from "@/store/useExplorerStore";

const GenealogyGraph = dynamic(
  () => import("./GenealogyGraph").then((m) => m.GenealogyGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-faint">
        Weaving the generations…
      </div>
    ),
  },
);

function DeepLink() {
  const params = useSearchParams();
  const select = useExplorerStore((s) => s.select);
  useEffect(() => {
    const slug = params.get("person");
    if (!slug) return;
    if (corePersonBySlug.has(slug)) select(slug);
    else void revealAndSelect(slug);
  }, [params, select]);
  return null;
}

export function GenealogyView() {
  return (
    <div className="relative h-[calc(100dvh)] pt-14">
      <Suspense fallback={null}>
        <DeepLink />
      </Suspense>
      <div className="absolute inset-0 pt-14">
        <GenealogyGraph />
      </div>
      <GraphToolbar />
      <DetailPanel />
    </div>
  );
}
