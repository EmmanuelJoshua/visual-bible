/**
 * Step-by-step construction sequences. Text lives here (pure data); the
 * geometry for each step id lives in `src/lib/artifacts/build/<id>.ts`.
 *
 * Verse text is the King James Version (public domain), trimmed with an
 * ellipsis where a verse runs long.
 */

export type Verse = { ref: string; text: string };

export type BuildStepInfo = {
  id: string;
  title: string;
  description: string;
  verses: readonly Verse[];
  /** floating 3D label pinned to the part that just arrived */
  label: string;
  /** the headline measure for this step, e.g. "20 × 20 × 20 cubits" */
  measure?: string;
  /** what in this step is a reading rather than a stated measure */
  interpretive?: string;
};

/** Blueprint linework, in plan units (cubits), y down, already oriented. */
export type BlueprintEl =
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      step: number;
      tone?: Tone;
      fill?: boolean;
      dashed?: boolean;
    }
  | {
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      step: number;
      tone?: Tone;
      fill?: boolean;
    }
  | {
      kind: "line";
      pts: readonly (readonly [number, number])[];
      step: number;
      tone?: Tone;
      dashed?: boolean;
      width?: number;
    }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      step: number;
      tone?: Tone;
      size?: number;
      anchor?: "start" | "middle" | "end";
      rotate?: number;
      italic?: boolean;
    }
  | {
      /** dimension line with end ticks and a centred label */
      kind: "dim";
      a: readonly [number, number];
      b: readonly [number, number];
      text: string;
      step: number;
      offset?: number;
    };

export type Tone = "white" | "gold" | "faint";

export type Blueprint = {
  title: string;
  subtitle: string;
  /** "plan" or "section"/"elevation" — shown in the title block */
  view: string;
  viewBox: readonly [number, number, number, number];
  /** compass: which way is up in this drawing ("" for none) */
  up: string;
  /** grid spacing in cubits */
  grid: number;
  els: readonly BlueprintEl[];
};

export type WalkStop = {
  n: number;
  name: string;
  note: string;
  /** standing point, world cubits (x east→west, z south→north) */
  at: readonly [number, number];
  /** eye height above y = 0, cubits */
  eye: number;
  /** look-at target, world cubits */
  look: readonly [number, number, number];
  /** same point in blueprint coordinates */
  plan: readonly [number, number];
};

export type BuildInfo = {
  title: string;
  steps: readonly BuildStepInfo[];
  blueprint: Blueprint;
  walk?: readonly WalkStop[];
  /** per-structure environment mood */
  env: "jerusalem" | "deluge" | "desert" | "sanctuary";
};
