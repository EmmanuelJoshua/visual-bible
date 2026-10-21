import { create } from "zustand";
import { JOURNEYS } from "@/data/journeys";

/** A located timeline event the user clicked; overrides the journey camera. */
export type FocusEvent = {
  id: string;
  title: string;
  year: number;
  ref?: string;
  place: string;
  coord: [number, number];
};

type JourneyState = {
  journeyId: string;
  /** fractional progress along the journey: 0 = first stop, n-1 = last */
  t: number;
  playing: boolean;
  /** a camera flight is in progress; playback waits for it */
  cameraBusy: boolean;
  focus: FocusEvent | null;
  reducedMotion: boolean;
  /** a stop the traveller is walking to (set by goTo, consumed by playback) */
  target: number | null;
  /** bumps when the camera should fly rather than cut to the new t */
  flight: number;
  /** playback halts on reaching this stop instead of running on (story mode) */
  stopAt: number | null;
  /** at a journey's end, playback carries on into the next one */
  autoNext: boolean;
  select: (id: string, t?: number) => void;
  setT: (t: number) => void;
  /** step to a stop: travel the leg when adjacent, fly the camera when far */
  goTo: (stop: number) => void;
  setPlaying: (playing: boolean) => void;
  setCameraBusy: (busy: boolean) => void;
  setFocus: (focus: FocusEvent | null) => void;
  setReducedMotion: (reduced: boolean) => void;
  /** play a journey (or part of it) and halt at `until`, as story mode does */
  playLeg: (id: string, from: number, until: number | null) => void;
  setAutoNext: (autoNext: boolean) => void;
};

export const useJourneyStore = create<JourneyState>()((set, get) => ({
  journeyId: JOURNEYS[0].id,
  t: 0,
  playing: false,
  cameraBusy: false,
  focus: null,
  reducedMotion: false,
  target: null,
  flight: 0,
  stopAt: null,
  autoNext: true,
  select: (journeyId, t = 0) => set({ journeyId, t, focus: null, target: null, stopAt: null }),
  setT: (t) => set({ t, focus: null, target: null }),
  goTo: (stop) => {
    const { t, reducedMotion, focus, flight } = get();
    if (reducedMotion) set({ t: stop, focus: null, target: null, playing: false });
    else if (Math.abs(stop - t) <= 1.001 && !focus)
      set({ target: stop, playing: false });
    else set({ t: stop, focus: null, target: null, playing: false, flight: flight + 1 });
  },
  setPlaying: (playing) =>
    set((s) => ({
      playing,
      focus: playing ? null : s.focus,
      target: null,
      stopAt: playing ? s.stopAt : null,
    })),
  setCameraBusy: (cameraBusy) => set({ cameraBusy }),
  setFocus: (focus) => set({ focus, playing: false }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  playLeg: (journeyId, from, until) => {
    const { journeyId: current, flight } = get();
    set({
      journeyId,
      t: from,
      focus: null,
      target: null,
      stopAt: until,
      playing: true,
      flight: journeyId === current ? flight + 1 : flight,
    });
  },
  setAutoNext: (autoNext) => set({ autoNext }),
}));
