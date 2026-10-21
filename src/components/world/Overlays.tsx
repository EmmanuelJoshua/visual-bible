"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getPersonSync } from "@/data";
import { artifactById } from "@/data/artifacts";
import { BUILDS } from "@/data/builds";
import { BuildWorkbench } from "@/components/artifacts/BuildWorkbench";
import { DetailPanel } from "@/components/DetailPanel";
import { GraphToolbar } from "@/components/graph/GraphToolbar";
import { useExplorerStore } from "@/store/useExplorerStore";
import { closeOverlay, goToYear, showPerson } from "@/world/actions";
import { useWorldStore, type Overlay } from "@/world/store";

const GenealogyGraph = dynamic(
  () => import("@/components/graph/GenealogyGraph").then((m) => m.GenealogyGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-faint">
        Weaving the generations…
      </div>
    ),
  },
);

function Header({ eyebrow, title, onBack }: { eyebrow: string; title: string; onBack: () => void }) {
  return (
    <div className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-background/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="micro-label flex items-center gap-2 text-muted transition-colors hover:text-accent"
      >
        <span aria-hidden>←</span> Back to the map
      </button>
      <div className="min-w-0 text-right">
        <div className="micro-label !text-[10px] text-faint">{eyebrow}</div>
        <div className="truncate font-display text-[15px] font-extrabold tracking-tight">{title}</div>
      </div>
    </div>
  );
}

function TreeView({ slug }: { slug: string }) {
  const selected = useExplorerStore((s) => s.selected);
  const name = getPersonSync(selected ?? slug)?.name ?? "";
  return (
    <div className="flex h-full flex-col">
      <Header eyebrow="Family tree" title={name} onBack={closeOverlay} />
      {/* the graph, toolbar and panel position themselves under a 56px bar */}
      <div className="relative -mt-14 min-h-0 flex-1">
        <div className="absolute inset-0 pt-14">
          <GenealogyGraph />
        </div>
        <GraphToolbar />
        <DetailPanel
          onShowYear={(year) => {
            const who = useExplorerStore.getState().selected ?? slug;
            closeOverlay();
            goToYear(year);
            showPerson(who, { fly: true });
          }}
        />
      </div>
    </div>
  );
}

function BuildView({ id, step }: { id: Extract<Overlay, { kind: "build" }>["id"]; step?: number }) {
  const artifact = artifactById.get(id)!;
  const info = BUILDS[id]!;
  return (
    <div className="flex h-full flex-col">
      <Header eyebrow="Step-by-step build" title={artifact.name} onBack={closeOverlay} />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6">
        <div className="mx-auto max-w-[1440px]">
          <BuildWorkbench key={id} artifact={artifact} info={info} initialStep={step} syncUrl={false} />
        </div>
      </div>
    </div>
  );
}

/** full views opened from the map: they zoom up out of it and back down into it */
export function Overlays() {
  const overlay = useWorldStore((s) => s.overlay);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!overlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeOverlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [overlay]);

  const key = overlay ? (overlay.kind === "tree" ? `tree-${overlay.slug}` : `build-${overlay.id}`) : "none";

  return (
    <AnimatePresence>
      {overlay && (
        <motion.div
          key={key}
          role="dialog"
          aria-modal="true"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
          className="absolute inset-x-0 bottom-0 top-14 z-40 overflow-hidden bg-background text-foreground"
        >
          {overlay.kind === "tree" ? (
            <TreeView slug={overlay.slug} />
          ) : (
            <BuildView id={overlay.id} step={overlay.step} />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
