"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  Controls,
  JourneyChips,
  JourneyTitle,
  useJourneyUrl,
  useKeyboard,
  useMapPadding,
  usePlayback,
  useReducedMotionPreference,
  useWorldClock,
} from "@/components/journeys/controls";
import { TimelineStrip } from "@/components/journeys/TimelineStrip";
import { storyById } from "@/story";
import { useStoryDirector } from "@/story/director";
import { useStoryStore } from "@/story/store";
import { useWorldStore, type Layers } from "@/world/store";
import { Inspector } from "./Inspector";
import { Overlays } from "./Overlays";
import { StoryLauncher, StoryOverlay } from "./StoryOverlay";

// WebGL + window access: never prerender the map or its marker layers
const JourneyMap = dynamic(() => import("@/components/journeys/JourneyMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#07090d]">
      <span className="micro-label text-white/40">Loading the world…</span>
    </div>
  ),
});
const WorldLayers = dynamic(() => import("./WorldLayers").then((m) => m.WorldLayers), {
  ssr: false,
});

const LAYER_LABELS: [keyof Layers, string][] = [
  ["journeys", "Journeys"],
  ["people", "People"],
  ["structures", "Structures"],
  ["events", "Events"],
];

function LayerToggles() {
  const layers = useWorldStore((s) => s.layers);
  const toggle = useWorldStore((s) => s.toggleLayer);
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Map layers">
      {LAYER_LABELS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={layers[id]}
          onClick={() => toggle(id)}
          className={`rounded-sm border px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] backdrop-blur-md transition-colors ${
            layers[id]
              ? "border-white/35 bg-[#0d0b09]/75 text-white"
              : "border-white/10 bg-[#0d0b09]/45 text-white/40 line-through"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** ?story=dwelling&scene=3 starts a story (also from the nav while already here) */
function StoryParam() {
  const params = useSearchParams();
  const id = params.get("story");
  const scene = params.get("scene");
  useEffect(() => {
    const s = useStoryStore.getState();
    if (!id || !storyById.has(id) || s.storyId === id) return;
    s.start(id, Math.max(0, Number(scene ?? 1) - 1));
  }, [id, scene]);
  return null;
}

/** the story and scene are mirrored into the URL; leaving a story drops them */
function useStoryUrl() {
  useEffect(() => {
    return useStoryStore.subscribe((s, prev) => {
      if (s.storyId === prev.storyId && s.index === prev.index) return;
      const url = new URL(window.location.href);
      if (s.storyId) {
        url.searchParams.set("story", s.storyId);
        url.searchParams.set("scene", String(s.index + 1));
      } else {
        url.searchParams.delete("story");
        url.searchParams.delete("scene");
      }
      window.history.replaceState(window.history.state, "", url);
    });
  }, []);
}

/**
 * One world, one timeline: the map is the stage, the ages along the bottom
 * drive it, and people, journeys, events and structures are layers on it.
 * Family trees and step-by-step builds open over the map and return to it.
 */
export function WorldView() {
  usePlayback();
  useReducedMotionPreference();
  useJourneyUrl();
  useKeyboard();
  useWorldClock();
  useStoryDirector();
  useStoryUrl();
  const { dockRef, panelRef, padding } = useMapPadding();
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const inStory = useStoryStore((s) => s.storyId !== null && s.status !== "exploring");

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#07090d] text-white">
      <div className="absolute inset-x-0 bottom-0 top-14">
        <JourneyMap padding={padding} onMap={setMap} />
      </div>
      {map && <WorldLayers map={map} />}

      {/* top: journeys, layers and stories — or the story's narration */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-10 bg-gradient-to-b from-black/55 via-black/20 to-transparent pb-10 pt-3">
        {!inStory && (
          <div className="pointer-events-auto mr-[110px] sm:mr-[60px]">
            <JourneyChips />
          </div>
        )}
        <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-2 px-4 sm:px-6">
          <StoryLauncher />
          {!inStory && <LayerToggles />}
        </div>
        <div className="mt-3 px-4 sm:px-6">
          <div className="pointer-events-auto inline-block">
            <StoryOverlay />
          </div>
        </div>
        {/* on phones the selected chip names the journey; the title would cover the map */}
        {!inStory && (
          <div className="mt-1 hidden sm:block">
            <JourneyTitle />
          </div>
        )}
      </div>

      {/* desktop: what's selected, or the stop you're at */}
      <div
        ref={panelRef}
        className="absolute right-4 top-[120px] z-10 hidden w-[360px] flex-col justify-start lg:flex"
        style={{ bottom: (padding.bottom ?? 0) + 40 }}
      >
        <Inspector />
      </div>

      {/* bottom dock: (mobile) the same panel, compact + the ages */}
      <div ref={dockRef} className="absolute inset-x-0 bottom-0 z-20 px-2 pb-2 sm:px-4 sm:pb-4">
        <div className="mb-2 lg:hidden">
          <Inspector compact />
        </div>
        <div className="rounded-md border border-white/12 bg-[#0d0b09]/88 px-3 pb-3 pt-3 shadow-2xl backdrop-blur-md sm:px-4">
          <div className="mb-2.5 flex items-center justify-between gap-4">
            <Controls />
            <p className="hidden text-right text-[11px] leading-snug text-white/45 md:block">
              Drag the ages to move through time · click people, ◆ events and structures on the map
              <br />
              Space plays · ← → step between stops
            </p>
          </div>
          <TimelineStrip />
        </div>
      </div>

      <Overlays />
      <Suspense fallback={null}>
        <StoryParam />
      </Suspense>
    </div>
  );
}
