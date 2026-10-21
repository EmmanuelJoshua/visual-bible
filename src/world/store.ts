"use client";

import { create } from "zustand";
import type { ArtifactId } from "@/data/artifacts";
import type { LngLat } from "@/data/journeys";

/**
 * The world: one clock and one selection shared by every layer of /explore.
 *
 * The journey layer keeps its own playback state (`components/journeys/store`)
 * and writes its year here as it moves; scrubbing the ages writes here first.
 * Everything else (people, structures, events, story mode) reads `year`.
 */

export type Selection =
  | { kind: "person"; slug: string }
  | { kind: "structure"; id: ArtifactId }
  | null;

/** full-screen views opened from the map */
export type Overlay =
  | { kind: "tree"; slug: string }
  | { kind: "build"; id: ArtifactId; step?: number }
  | null;

export type CameraCommand = {
  center: LngLat;
  zoom: number;
  pitch?: number;
  bearing?: number;
  /** bumps so the same pose can be requested twice */
  nonce: number;
};

export type Layers = {
  journeys: boolean;
  people: boolean;
  structures: boolean;
  events: boolean;
};

type WorldState = {
  year: number;
  selection: Selection;
  overlay: Overlay;
  camera: CameraCommand | null;
  layers: Layers;
  setYear: (year: number) => void;
  select: (selection: Selection) => void;
  open: (overlay: Overlay) => void;
  fly: (pose: Omit<CameraCommand, "nonce">) => void;
  toggleLayer: (layer: keyof Layers) => void;
};

export const useWorldStore = create<WorldState>()((set, get) => ({
  year: -2399,
  selection: null,
  overlay: null,
  camera: null,
  layers: { journeys: true, people: true, structures: true, events: true },
  setYear: (year) => set({ year }),
  select: (selection) => set({ selection }),
  open: (overlay) => set({ overlay }),
  fly: (pose) => set({ camera: { ...pose, nonce: (get().camera?.nonce ?? 0) + 1 } }),
  toggleLayer: (layer) =>
    set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),
}));
