import { DWELLING } from "./stories/dwelling";
import type { Story } from "./types";

/** every story, in the order the launcher lists them */
export const STORIES: Story[] = [DWELLING];

export const storyById = new Map(STORIES.map((s) => [s.id, s]));

export { flatten } from "./types";
export type { Story, Chapter, Scene, SceneAction, Advance, ScenePosition } from "./types";
