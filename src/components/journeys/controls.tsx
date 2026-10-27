"use client";

import { useEffect, useRef, useState } from "react";
import type { Padding } from "@/components/diorama/stage";
import { eraForYear } from "@/data/eras";
import { JOURNEYS, journeyById } from "@/data/journeys";
import { useWorldStore } from "@/world/store";
import { useJourneyStore } from "./store";
import { approxYear, legSeconds, pathOf, yearAt } from "./geometry";

export const CHRONO = [...JOURNEYS].sort((a, b) => a.stops[0].year - b.stops[0].year);

/** advances progress along legs, pausing at each stop, then on to the next journey */
export function usePlayback() {
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let dwell = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = useJourneyStore.getState();
      if (s.target !== null && !s.cameraBusy) {
        // a single step: walk the leg a little quicker than playback
        const j = journeyById.get(s.journeyId)!;
        const seg = Math.min(Math.floor(Math.min(s.t, s.target)), j.stops.length - 2);
        const secs = legSeconds(pathOf(j).segments[seg].km) / 1.6;
        const dir = Math.sign(s.target - s.t);
        const t = s.t + (dir * dt) / secs;
        const done = dir === 0 || (dir > 0 ? t >= s.target : t <= s.target);
        useJourneyStore.setState(done ? { t: s.target, target: null } : { t });
      } else if (s.playing && !s.cameraBusy) {
        const j = journeyById.get(s.journeyId)!;
        const end = Math.min(s.stopAt ?? Infinity, j.stops.length - 1);
        if (dwell > 0) {
          dwell -= dt;
        } else if (s.t >= end) {
          const next = s.autoNext && s.stopAt === null && CHRONO[CHRONO.indexOf(j) + 1];
          if (next) {
            s.select(next.id, 0);
            dwell = 1.6;
          } else {
            s.setPlaying(false);
          }
        } else {
          const seg = Math.floor(s.t);
          const secs = s.reducedMotion ? 0.001 : legSeconds(pathOf(j).segments[seg].km);
          let t = s.t + dt / secs;
          if (Math.floor(t) > seg) {
            t = seg + 1;
            dwell = s.reducedMotion ? 3.5 : t === end ? 3.4 : 2.4;
          }
          useJourneyStore.setState({ t });
        }
      } else if (!s.playing) {
        dwell = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export function useReducedMotionPreference() {
  const setReducedMotion = useJourneyStore((s) => s.setReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setReducedMotion]);
}

/** ?journey=paul-2 deep links, kept in sync without adding history entries */
export function useJourneyUrl() {
  const select = useJourneyStore((s) => s.select);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("journey");
    if (id && journeyById.has(id)) select(id, 0);
    const write = (journeyId: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set("journey", journeyId);
      window.history.replaceState(window.history.state, "", url);
    };
    write(useJourneyStore.getState().journeyId);
    return useJourneyStore.subscribe((s, prev) => {
      if (s.journeyId !== prev.journeyId) write(s.journeyId);
    });
  }, [select]);
}

export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [role=slider]") || e.metaKey || e.ctrlKey) return;
      if (useWorldStore.getState().overlay) return;
      const s = useJourneyStore.getState();
      const end = journeyById.get(s.journeyId)!.stops.length - 1;
      if (e.key === " " && !el.closest("button, a")) {
        e.preventDefault();
        s.setPlaying(!s.playing);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const at = s.target ?? s.t;
        s.goTo(
          e.key === "ArrowRight"
            ? Math.min(end, Math.floor(at + 1e-6) + 1)
            : Math.max(0, Math.ceil(at - 1e-6) - 1),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** keep the camera's focal point clear of the panel and the timeline dock */
export function useMapPadding() {
  const dockRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [padding, setPadding] = useState<Padding>({ top: 0, bottom: 0, left: 0, right: 0 });
  useEffect(() => {
    const measure = () => {
      const dock = dockRef.current?.getBoundingClientRect().height ?? 0;
      const panel = panelRef.current;
      const panelW = panel && panel.offsetParent ? panel.getBoundingClientRect().width + 24 : 0;
      setPadding({ top: 64, bottom: dock + 8, left: 0, right: panelW });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (dockRef.current) ro.observe(dockRef.current);
    if (panelRef.current) ro.observe(panelRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return { dockRef, panelRef, padding };
}

function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
      <rect x="3" y="2" width="3.5" height="12" rx="1" />
      <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M4 2.5v11a.8.8 0 0 0 1.2.7l9-5.5a.8.8 0 0 0 0-1.4l-9-5.5A.8.8 0 0 0 4 2.5Z" />
    </svg>
  );
}

export function Controls() {
  const playing = useJourneyStore((s) => s.playing);
  const setPlaying = useJourneyStore((s) => s.setPlaying);
  const setT = useJourneyStore((s) => s.setT);
  const journeyId = useJourneyStore((s) => s.journeyId);
  const year = useWorldStore((s) => Math.round(s.year));
  const journey = journeyById.get(journeyId)!;
  const end = journey.stops.length - 1;
  const era = eraForYear(year);

  const step = (dir: 1 | -1) => {
    const s = useJourneyStore.getState();
    const at = s.target ?? s.t;
    s.goTo(
      dir > 0
        ? Math.min(end, Math.floor(at + 1e-6) + 1)
        : Math.max(0, Math.ceil(at - 1e-6) - 1),
    );
  };

  const btn =
    "flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-white/60 hover:text-white";

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button type="button" className={btn} onClick={() => step(-1)} aria-label="Previous stop">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M3 2h2v12H3zM14 2.8v10.4a.6.6 0 0 1-.9.5L6 8.5a.6.6 0 0 1 0-1l7.1-5.2a.6.6 0 0 1 .9.5Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => {
          const s = useJourneyStore.getState();
          if (!s.playing && s.t >= end) setT(0);
          setPlaying(!s.playing);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d9b45a] text-[#0d0b09] shadow-[0_0_20px_rgba(217,180,90,0.45)] transition-transform hover:scale-105"
        aria-label={playing ? "Pause" : "Play journeys"}
      >
        <PlayIcon playing={playing} />
      </button>
      <button type="button" className={btn} onClick={() => step(1)} aria-label="Next stop">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M11 2h2v12h-2zM2 2.8v10.4a.6.6 0 0 0 .9.5L10 8.5a.6.6 0 0 0 0-1L2.9 2.3a.6.6 0 0 0-.9.5Z" />
        </svg>
      </button>
      <div className="ml-1 min-w-0 sm:ml-2">
        <div className="font-display text-[20px] font-extrabold leading-none tabular-nums text-white sm:text-[24px]">
          {approxYear(year)}
        </div>
        <div className="micro-label mt-1 truncate text-white/45">{era?.name}</div>
      </div>
    </div>
  );
}

/** the pill the explorer's top bar is made of */
export const PILL =
  "flex items-center gap-2 rounded-full border border-white/15 bg-[#0d0b09]/75 px-3.5 py-1.5 text-[12px] font-semibold text-white/90 backdrop-blur-md transition-colors hover:border-white/40 hover:text-white";

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
      <path d="M2 4.5 6 8l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** a popover that closes on a click outside it or Escape */
export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** the journey you're on, and the list of the others */
export function JourneyPicker() {
  const journeyId = useJourneyStore((s) => s.journeyId);
  const select = useJourneyStore((s) => s.select);
  const setPlaying = useJourneyStore((s) => s.setPlaying);
  const { open, setOpen, ref } = usePopover();
  const journey = journeyById.get(journeyId)!;
  return (
    <div ref={ref} className="relative">
      <button type="button" className={PILL} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: journey.color }} />
        <span className="max-w-[22ch] truncate">{journey.name}</span>
        <Chevron open={open} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Journeys"
          className="absolute left-0 top-full z-30 mt-2 max-h-[min(70vh,520px)] w-[min(320px,calc(100vw-32px))] overflow-y-auto rounded-md border border-white/15 bg-[#0d0b09]/95 p-1.5 shadow-2xl backdrop-blur-md"
        >
          {CHRONO.map((j) => {
            const active = j.id === journeyId;
            return (
              <button
                key={j.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setOpen(false);
                  setPlaying(false);
                  if (!active) select(j.id, 0);
                }}
                className={`flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors ${
                  active ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: j.color }} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{j.name}</span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-white/40">{approxYear(j.stops[0].year)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** the stop you're at (or the event in focus), in one line, with the way to its full text */
export function StopLine() {
  const journeyId = useJourneyStore((s) => s.journeyId);
  const stopIndex = useJourneyStore((s) => Math.floor(s.t + 1e-6));
  const focus = useJourneyStore((s) => s.focus);
  const setFocus = useJourneyStore((s) => s.setFocus);
  const details = useWorldStore((s) => s.details);
  const selection = useWorldStore((s) => s.selection);
  const journey = journeyById.get(journeyId)!;
  const stop = journey.stops[stopIndex];
  const open = details && !selection;
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:w-auto sm:flex-1 sm:justify-end">
      <div className="min-w-0 truncate text-[13px] text-white/70 sm:text-right">
        {focus ? (
          <>
            <span className="text-[#d9b45a]">◆</span> <span className="font-semibold text-white">{focus.title}</span>
            <span className="hidden sm:inline"> · {focus.place}</span>
          </>
        ) : (
          <>
            <span className="tabular-nums" style={{ color: journey.color }}>
              {stopIndex + 1}/{journey.stops.length}
            </span>{" "}
            <span className="font-semibold text-white">{stop.title}</span>
            <span className="hidden sm:inline"> · {stop.name}</span>
          </>
        )}
      </div>
      {focus ? (
        <button type="button" className="micro-label shrink-0 text-white/55 hover:text-white" onClick={() => setFocus(null)}>
          Back
        </button>
      ) : (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            const w = useWorldStore.getState();
            if (w.selection) w.select(null);
            w.setDetails(!open);
          }}
          className="micro-label shrink-0 rounded-sm border border-white/20 px-2.5 py-1.5 !text-[10px] text-white/75 transition-colors hover:border-white/50 hover:text-white"
        >
          {open ? "Close" : "Read"}
        </button>
      )}
    </div>
  );
}

/** journey playback, steps and focused events move the world's clock */
export function useWorldClock() {
  useEffect(() => {
    const write = (s: ReturnType<typeof useJourneyStore.getState>) =>
      useWorldStore
        .getState()
        .setYear(s.focus ? s.focus.year : yearAt(journeyById.get(s.journeyId)!, s.t));
    write(useJourneyStore.getState());
    return useJourneyStore.subscribe((s, prev) => {
      if (s.t !== prev.t || s.journeyId !== prev.journeyId || s.focus !== prev.focus) write(s);
    });
  }, []);
}
