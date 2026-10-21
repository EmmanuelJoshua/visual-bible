"use client";

import { useEffect } from "react";
import { allEvents } from "@/data";
import { journeyById } from "@/data/journeys";
import { useJourneyStore } from "@/components/journeys/store";
import { focusFor } from "@/components/journeys/TimelineStrip";
import { goToYear, openBuild, openTree, showPerson, showStructure } from "@/world/actions";
import { useWorldStore } from "@/world/store";
import { flatten, storyById, type Scene, type SceneAction } from "./index";
import { useStoryStore } from "./store";

/** carry out one action on the world, through the same verbs the explorer uses */
function perform(action: SceneAction) {
  const world = useWorldStore.getState();
  const journeys = useJourneyStore.getState();
  switch (action.do) {
    case "year":
      goToYear(action.year);
      break;
    case "journey": {
      const j = journeyById.get(action.id);
      if (!j) break;
      const at = action.at ?? 0;
      if (action.play) journeys.playLeg(j.id, at, action.until ?? j.stops.length - 1);
      else {
        journeys.setPlaying(false);
        journeys.select(j.id, at);
        // a cut, not a crawl: fly the camera to the stop
        useJourneyStore.setState((s) => ({ flight: s.flight + 1 }));
      }
      break;
    }
    case "camera":
      world.fly(action);
      break;
    case "event": {
      const e = allEvents.find((x) => x.id === action.id);
      const f = e && focusFor(e);
      if (f) journeys.setFocus(f);
      else if (e) goToYear(e.startYear);
      break;
    }
    case "person":
      if (action.tree) openTree(action.slug);
      else showPerson(action.slug, { fly: false });
      break;
    case "structure":
      showStructure(action.id);
      if (action.build) openBuild(action.id, action.step);
      break;
    case "clear":
      world.select(null);
      world.open(null);
      journeys.setFocus(null);
      break;
  }
}

export function stageScene(scene: Scene) {
  scene.actions.forEach(perform);
}

/** a scene's year, for the story's own timeline (first year/journey action wins) */
export function sceneYear(scene: Scene): number | null {
  for (const a of scene.actions) {
    if (a.do === "year") return a.year;
    if (a.do === "journey") {
      const j = journeyById.get(a.id);
      if (j) return j.stops[Math.min(a.at ?? 0, j.stops.length - 1)].year;
    }
  }
  return null;
}

/**
 * Runs the active story: stages each scene on the world and, while playing,
 * moves on when the scene's advance condition is met. Mounted once by the world.
 */
export function useStoryDirector() {
  const storyId = useStoryStore((s) => s.storyId);
  const index = useStoryStore((s) => s.index);
  const stage = useStoryStore((s) => s.stage);
  const status = useStoryStore((s) => s.status);

  const story = storyId ? storyById.get(storyId) : undefined;
  const scene = story ? flatten(story)[index]?.scene : undefined;

  // stage the scene whenever it changes or is resumed
  useEffect(() => {
    if (!scene) return;
    useJourneyStore.getState().setAutoNext(false);
    stageScene(scene);
  }, [scene, stage]);

  // leaving a story hands playback back to the explorer
  useEffect(() => {
    if (!storyId) useJourneyStore.getState().setAutoNext(true);
  }, [storyId]);

  // auto-advance while playing
  useEffect(() => {
    if (!scene || status !== "playing") return;
    const advance = scene.advance ?? { after: 9 };
    const { next } = useStoryStore.getState();
    if (advance === "manual") return;
    if (advance === "journey") {
      let timer: ReturnType<typeof setTimeout> | undefined;
      // playLeg has already set playing; wait for it to stop on its own
      const unsub = useJourneyStore.subscribe((s, prev) => {
        if (prev.playing && !s.playing && !timer) timer = setTimeout(next, 2200);
      });
      return () => {
        unsub();
        clearTimeout(timer);
      };
    }
    const timer = setTimeout(next, advance.after * 1000);
    return () => clearTimeout(timer);
  }, [scene, stage, status]);

  // the viewer reaching into the world pauses the story
  useEffect(() => {
    if (!storyId) return;
    return useWorldStore.subscribe((w, prev) => {
      const s = useStoryStore.getState();
      if (s.status !== "playing") return;
      // building / tree views pause narration until the viewer comes back
      if (w.overlay && !prev.overlay) s.setStatus("paused");
    });
  }, [storyId]);
}
