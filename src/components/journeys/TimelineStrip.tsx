"use client";

import { useRef, useState } from "react";
import { allEvents } from "@/data";
import { ERAS } from "@/data/eras";
import { JOURNEYS, journeyById, journeySpan, type Journey } from "@/data/journeys";
import type { BibleEvent } from "@/data/types";
import eventPlaces from "./event-places.json";
import { useWorldStore } from "@/world/store";
import { useJourneyStore, type FocusEvent } from "./store";
import { approxYear, fracToYear, tForYear, yearToFrac } from "./geometry";

const PLACES = eventPlaces as unknown as Record<string, [number, number, string]>;

const ERA_SHORT: Record<string, string> = {
  creation: "Creation",
  patriarchs: "Patriarchs",
  exodus: "Exodus",
  judges: "Judges",
  united: "Kingdom",
  divided: "Divided",
  exile: "Exile",
  silence: "Silence",
  christ: "Christ",
  church: "Church",
};

export function focusFor(e: BibleEvent): FocusEvent | null {
  const p = PLACES[e.id];
  if (!p) return null;
  return { id: e.id, title: e.title, year: e.startYear, ref: e.ref, place: p[2], coord: [p[0], p[1]] };
}

/** journey whose span holds the year (current one wins), else the nearest */
export function journeyForYear(year: number, currentId: string): Journey {
  const dist = (j: Journey) => {
    const [a, b] = journeySpan(j);
    return year < a ? a - year : year > b ? year - b : 0;
  };
  const current = journeyById.get(currentId)!;
  if (dist(current) === 0) return current;
  return JOURNEYS.reduce((best, j) => (dist(j) < dist(best) ? j : best));
}

/** greedy lanes so overlapping journeys (Jacob / Joseph) don't collide */
const LANES = (() => {
  const lanes: number[] = [];
  const out = new Map<string, number>();
  for (const j of [...JOURNEYS].sort((a, b) => a.stops[0].year - b.stops[0].year)) {
    const [a, b] = journeySpan(j);
    const fa = yearToFrac(a);
    let lane = lanes.findIndex((end) => end < fa - 0.004);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = yearToFrac(b) + 0.006;
    out.set(j.id, lane);
  }
  return out;
})();

function Playhead() {
  const frac = useWorldStore((s) => yearToFrac(s.year));
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-10 w-0"
      style={{ left: `${frac * 100}%` }}
    >
      <div className="absolute inset-y-0 -left-px w-[2px] bg-[#d9b45a] shadow-[0_0_10px_rgba(217,180,90,0.9)]" />
      <div className="absolute -top-1 -left-[5px] h-[10px] w-[10px] rotate-45 bg-[#d9b45a]" />
    </div>
  );
}

/** stop-by-stop scrubber for the active journey */
function StopScrubber({ journey }: { journey: Journey }) {
  const t = useJourneyStore((s) => s.t);
  const setT = useJourneyStore((s) => s.setT);
  const setPlaying = useJourneyStore((s) => s.setPlaying);
  const reduced = useJourneyStore((s) => s.reducedMotion);
  const trackRef = useRef<HTMLDivElement>(null);
  const last = journey.stops.length - 1;

  const tFromPointer = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const raw = f * last;
    // snap onto stops when close, so labels pop while dragging
    const k = Math.round(raw);
    return reduced || Math.abs(raw - k) < 0.12 ? k : raw;
  };

  return (
    <div className="flex items-center gap-3">
      <span className="micro-label hidden w-16 shrink-0 text-[#d9b45a] sm:block">Route</span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={`${journey.name} progress`}
        aria-valuemin={1}
        aria-valuemax={last + 1}
        aria-valuenow={Math.round(t) + 1}
        aria-valuetext={journey.stops[Math.round(t)].name}
        className="relative h-8 flex-1 cursor-pointer touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setPlaying(false);
          setT(tFromPointer(e.clientX));
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) setT(tFromPointer(e.clientX));
        }}
        onKeyDown={(e) => {
          const { goTo } = useJourneyStore.getState();
          if (e.key === "ArrowRight") goTo(Math.min(last, Math.floor(t + 1e-6) + 1));
          else if (e.key === "ArrowLeft") goTo(Math.max(0, Math.ceil(t - 1e-6) - 1));
          else return;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-white/15" />
        <div
          className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2"
          style={{ width: `${(t / last) * 100}%`, background: journey.color }}
        />
        {journey.stops.map((s, i) => (
          <div
            key={i}
            title={`${s.name} — ${s.title}`}
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{
              left: `${(i / last) * 100}%`,
              borderColor: i <= t + 1e-6 ? journey.color : "rgba(255,255,255,0.45)",
              background: i <= t + 1e-6 ? journey.color : "#14110d",
            }}
          />
        ))}
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_12px_rgba(255,255,255,0.6)]"
          style={{ left: `${(t / last) * 100}%`, background: journey.color }}
        />
      </div>
    </div>
  );
}

export function TimelineStrip() {
  const journeyId = useJourneyStore((s) => s.journeyId);
  const focusId = useJourneyStore((s) => s.focus?.id);
  const select = useJourneyStore((s) => s.select);
  const setT = useJourneyStore((s) => s.setT);
  const setPlaying = useJourneyStore((s) => s.setPlaying);
  const setFocus = useJourneyStore((s) => s.setFocus);
  const journey = journeyById.get(journeyId)!;
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<BibleEvent | null>(null);

  const scrubTo = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const year = fracToYear((clientX - r.left) / r.width);
    const s = useJourneyStore.getState();
    const j = journeyForYear(year, s.journeyId);
    const t = tForYear(j, year);
    if (j.id !== s.journeyId) select(j.id, t);
    else setT(t);
    // the ages run on past a journey's ends; the world keeps the scrubbed year
    useWorldStore.getState().setYear(year);
  };

  return (
    <div className="space-y-1.5">
      <StopScrubber journey={journey} />

      <div className="flex items-start gap-3">
        <span className="micro-label hidden w-16 shrink-0 pt-1 text-white/45 sm:block">Ages</span>
        <div className="relative flex-1">
          {/* era bands */}
          <div
            ref={trackRef}
            className="relative h-[54px] cursor-pointer touch-none select-none overflow-hidden rounded-sm border border-white/10"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("[data-hit]")) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              setPlaying(false);
              scrubTo(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) scrubTo(e.clientX);
            }}
          >
            <div className="absolute inset-0 flex">
              {ERAS.map((era, i) => (
                <div
                  key={era.id}
                  className={`relative flex-1 border-r border-white/10 last:border-r-0 ${
                    i % 2 ? "bg-white/[0.035]" : "bg-white/[0.07]"
                  }`}
                  title={`${era.name} (${era.range})`}
                >
                  <span className="absolute inset-x-1 top-0.5 truncate text-[8.5px] font-semibold uppercase tracking-[0.12em] text-white/50 sm:left-1.5 sm:text-[9.5px]">
                    <span className="sm:hidden">{ERA_SHORT[era.id].slice(0, 5)}</span>
                    <span className="hidden sm:inline">{ERA_SHORT[era.id]}</span>
                  </span>
                </div>
              ))}
            </div>

            {/* journey bars */}
            {JOURNEYS.map((j) => {
              const [a, b] = journeySpan(j);
              const left = yearToFrac(a);
              const width = Math.max(yearToFrac(b) - left, 0.006);
              const active = j.id === journeyId;
              return (
                <button
                  key={j.id}
                  type="button"
                  data-hit
                  title={j.name}
                  aria-label={`Show ${j.name}`}
                  onClick={() => {
                    setPlaying(false);
                    if (j.id !== journeyId) select(j.id, 0);
                  }}
                  className="absolute h-[7px] rounded-full transition-opacity"
                  style={{
                    left: `${left * 100}%`,
                    width: `max(${width * 100}%, 7px)`,
                    top: 17 + (LANES.get(j.id) ?? 0) * 9,
                    background: j.color,
                    opacity: active ? 1 : 0.55,
                    boxShadow: active ? `0 0 0 2px #0d0b09, 0 0 0 3px ${j.color}` : undefined,
                  }}
                />
              );
            })}

            {/* events */}
            {allEvents.map((e) => {
              const located = !!PLACES[e.id];
              const left = `${yearToFrac(e.startYear) * 100}%`;
              if (!located)
                return (
                  <span
                    key={e.id}
                    className="pointer-events-none absolute bottom-0 h-[6px] w-px bg-white/25"
                    style={{ left }}
                  />
                );
              const f = focusFor(e)!;
              return (
                <button
                  key={e.id}
                  type="button"
                  data-hit
                  aria-label={`${e.title}, ${approxYear(e.startYear)}`}
                  className="group absolute bottom-0 h-[14px] w-[7px] -translate-x-1/2"
                  style={{ left }}
                  onPointerEnter={() => setHover(e)}
                  onPointerLeave={() => setHover((h) => (h?.id === e.id ? null : h))}
                  onClick={() => setFocus(f)}
                >
                  <span
                    className={`absolute bottom-0 left-1/2 w-px -translate-x-1/2 transition-[height,background] group-hover:h-[14px] group-hover:bg-white ${
                      focusId === e.id ? "h-[14px] bg-[#d9b45a]" : "h-[9px] bg-white/60"
                    }`}
                  />
                </button>
              );
            })}

            <Playhead />
          </div>

          {hover && (
            <div
              className="pointer-events-none absolute bottom-full z-20 mb-2 w-max max-w-[220px] -translate-x-1/2 rounded-sm border border-[#d9b45a]/60 bg-[#0d0b09]/95 px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-xl"
              style={{
                left: `clamp(110px, ${yearToFrac(hover.startYear) * 100}%, calc(100% - 110px))`,
              }}
            >
              <div className="font-semibold">{hover.title}</div>
              <div className="text-white/60">
                {approxYear(hover.startYear)} · {PLACES[hover.id]?.[2]}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
