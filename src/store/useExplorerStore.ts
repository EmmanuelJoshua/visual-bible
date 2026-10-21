"use client";

import { create } from "zustand";
import type { EraId } from "@/data/types";

type ExplorerState = {
  /** slug of the currently selected person (drives the detail panel) */
  selected: string | null;
  /** slug whose lineage is isolated in the graph (dims everything else) */
  isolated: string | null;
  /** era filter for the graph; null = all */
  eraFilter: EraId | null;
  /** slugs the user expanded beyond the curated core */
  expanded: string[];
  select: (slug: string | null) => void;
  isolate: (slug: string | null) => void;
  setEraFilter: (era: EraId | null) => void;
  expand: (slugs: string[]) => void;
  reset: () => void;
};

export const useExplorerStore = create<ExplorerState>((set) => ({
  selected: null,
  isolated: null,
  eraFilter: null,
  expanded: [],
  select: (slug) => set({ selected: slug }),
  isolate: (slug) => set({ isolated: slug }),
  setEraFilter: (era) => set({ eraFilter: era }),
  expand: (slugs) =>
    set((s) => ({ expanded: [...new Set([...s.expanded, ...slugs])] })),
  reset: () => set({ isolated: null, eraFilter: null, expanded: [] }),
}));
