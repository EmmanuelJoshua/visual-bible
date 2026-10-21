"use client";

import { create } from "zustand";
import { flatten, storyById } from "./index";

/**
 * Where the viewer is in a story.
 * - `playing`: scenes run and move on by themselves
 * - `paused`: the scene is staged, waiting for next
 * - `exploring`: the viewer stepped off into the world; resume re-stages the scene
 */
export type StoryStatus = "playing" | "paused" | "exploring";

type StoryState = {
  storyId: string | null;
  index: number;
  status: StoryStatus;
  /** bumps whenever the current scene should be (re-)staged */
  stage: number;
  start: (id: string, index?: number) => void;
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  setStatus: (status: StoryStatus) => void;
  resume: () => void;
  exit: () => void;
};

const length = (id: string | null) => {
  const story = id ? storyById.get(id) : undefined;
  return story ? flatten(story).length : 0;
};

export const useStoryStore = create<StoryState>()((set, get) => ({
  storyId: null,
  index: 0,
  status: "paused",
  stage: 0,
  start: (id, index = 0) => {
    if (!storyById.has(id)) return;
    set({ storyId: id, index: Math.min(index, length(id) - 1), status: "playing", stage: get().stage + 1 });
  },
  goTo: (index) => {
    const { storyId, stage, status } = get();
    const n = length(storyId);
    if (!n) return;
    set({
      index: Math.max(0, Math.min(n - 1, index)),
      status: status === "exploring" ? "paused" : status,
      stage: stage + 1,
    });
  },
  next: () => {
    const { index, storyId } = get();
    if (index >= length(storyId) - 1) set({ status: "paused" });
    else get().goTo(index + 1);
  },
  prev: () => get().goTo(get().index - 1),
  setStatus: (status) => set({ status }),
  resume: () => set({ status: "playing", stage: get().stage + 1 }),
  exit: () => set({ storyId: null, index: 0, status: "paused" }),
}));
