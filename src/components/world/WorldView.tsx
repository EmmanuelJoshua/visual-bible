"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DioramaStage } from "@/components/diorama/stage";
import {
  Chevron,
  Controls,
  JourneyPicker,
  PILL,
  StopLine,
  useJourneyUrl,
  useKeyboard,
  useMapPadding,
  usePlayback,
  usePopover,
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
const DioramaMap = dynamic(() => import("@/components/diorama/DioramaMap"), {
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

/** what's drawn on the map, behind one button */
function LayersMenu() {
  const layers = useWorldStore((s) => s.layers);
  const toggle = useWorldStore((s) => s.toggleLayer);
  const { open, setOpen, ref } = usePopover();
  const on = LAYER_LABELS.filter(([id]) => layers[id]).length;
  return (
    <div ref={ref} className="relative">
      <button type="button" className={PILL} onClick={() => setOpen(!open)} aria-expanded={open}>
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
          <path d="M8 2 14.5 5.5 8 9 1.5 5.5Z" />
          <path d="M1.5 8.5 8 12l6.5-3.5" />
        </svg>
        Layers
        <span className="tabular-nums text-white/45">{on}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-48 rounded-md border border-white/15 bg-[#0d0b09]/95 p-1.5 shadow-2xl backdrop-blur-md">
          {LAYER_LABELS.map(([id, label]) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] text-white/85 hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={layers[id]}
                onChange={() => toggle(id)}
                className="h-3.5 w-3.5 accent-[#d9b45a]"
              />
              {label}
            </label>
          ))}
        </div>
      )}
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
  const [stage, setStage] = useState<DioramaStage | null>(null);
  const inStory = useStoryStore((s) => s.storyId !== null && s.status !== "exploring");
  // the side panel only when asked for: a selection, or the stop's full text
  const panelOpen = useWorldStore((s) => s.selection !== null || s.details);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#07090d] text-white">
      <div className="absolute inset-x-0 bottom-0 top-14">
        <DioramaMap padding={padding} onStage={setStage} />
      </div>
      {stage && <WorldLayers stage={stage} />}

      {/* top: one bar — the journey, stories, layers — or the story's narration */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-10 bg-gradient-to-b from-black/35 to-transparent pb-8 pt-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 px-4 sm:px-6">
          {!inStory && <JourneyPicker />}
          <StoryLauncher />
          {!inStory && <LayersMenu />}
        </div>
        <div className="mt-3 px-4 sm:px-6">
          <div className="pointer-events-auto inline-block">
            <StoryOverlay />
          </div>
        </div>
      </div>

      {/* desktop: what's selected, or the stop's full text */}
      <div
        ref={panelRef}
        className={`absolute right-4 top-[76px] z-10 w-[360px] flex-col justify-start ${panelOpen ? "hidden lg:flex" : "hidden"}`}
        style={{ bottom: (padding.bottom ?? 0) + 40 }}
      >
        <Inspector />
      </div>

      {/* bottom dock: the clock, where you are, and the ages */}
      <div ref={dockRef} className="absolute inset-x-0 bottom-0 z-20 px-2 pb-2 sm:px-4 sm:pb-4">
        {panelOpen && (
          <div className="mb-2 lg:hidden">
            <Inspector compact />
          </div>
        )}
        <div
          className="rounded-md border border-white/12 bg-[#0d0b09]/85 px-3 pb-3 pt-3 shadow-2xl backdrop-blur-md sm:px-4"
          title="Space plays · ← → step between stops · drag the ages to move through time"
        >
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <Controls />
            <StopLine />
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
