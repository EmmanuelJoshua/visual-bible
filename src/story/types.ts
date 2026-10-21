import type { ArtifactId } from "@/data/artifacts";
import type { LngLat } from "@/data/journeys";
import type { EraId } from "@/data/types";

/**
 * Story mode: a narrated path through the world. A story is chapters of
 * scenes; each scene is narration plus a list of actions on the same world
 * the explorer uses, so pausing a story leaves you exactly where it was.
 */

export type SceneAction =
  /** move the clock (the journey layer follows) */
  | { do: "year"; year: number }
  /** show a journey at a stop; with `play`, travel on to `until` (default: its end) */
  | { do: "journey"; id: string; at?: number; play?: boolean; until?: number }
  /** frame a place */
  | { do: "camera"; center: LngLat; zoom: number; pitch?: number; bearing?: number }
  /** pop a located timeline event's card and fly to it */
  | { do: "event"; id: string }
  /** open a person's card; `tree` opens their family tree over the map */
  | { do: "person"; slug: string; tree?: boolean }
  /** select a structure and fly to it; `build` opens its build at `step` */
  | { do: "structure"; id: ArtifactId; build?: boolean; step?: number }
  /** close cards and full views */
  | { do: "clear" };

/** when a playing story moves on from a scene */
export type Advance =
  /** after this many seconds */
  | { after: number }
  /** when the journey this scene set travelling stops */
  | "journey"
  /** only when the viewer presses next */
  | "manual";

export type Scene = {
  id: string;
  title: string;
  /** a few sentences, read while the scene plays */
  narration: string;
  ref?: string;
  actions: SceneAction[];
  /** default: `{ after: 9 }` */
  advance?: Advance;
};

export type Chapter = {
  id: string;
  title: string;
  era: EraId;
  scenes: Scene[];
};

export type Story = {
  id: string;
  title: string;
  subtitle: string;
  chapters: Chapter[];
};

/** a scene with its place in the story, for flat next/previous navigation */
export type ScenePosition = { chapter: Chapter; chapterIndex: number; scene: Scene; index: number };

export function flatten(story: Story): ScenePosition[] {
  const out: ScenePosition[] = [];
  story.chapters.forEach((chapter, chapterIndex) =>
    chapter.scenes.forEach((scene) => out.push({ chapter, chapterIndex, scene, index: out.length })),
  );
  return out;
}
