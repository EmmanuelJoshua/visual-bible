"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { allEvents, getPersonSync, loadAllPeople } from "@/data";
import { journeyById } from "@/data/journeys";
import { showPerson } from "@/world/actions";
import { useWorldStore } from "@/world/store";
import { useJourneyStore } from "./store";
import { focusFor } from "./TimelineStrip";
import { approxYear } from "./geometry";

const GOLD = "#d9b45a";

function nameFromSlug(slug: string) {
  const base = slug.replace(/_\d+$/, "");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function usePeopleLoaded() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    void loadAllPeople().then(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, []);
  return loaded;
}

function PeopleLinks({ slugs }: { slugs: string[] }) {
  usePeopleLoaded();
  return (
    <div className="flex flex-wrap gap-1.5">
      {slugs.map((slug) => {
        const p = getPersonSync(slug);
        return (
          <button
            key={slug}
            type="button"
            onClick={() => showPerson(slug)}
            className="rounded-full border border-white/20 px-2.5 py-1 text-[11.5px] font-medium text-white/85 transition-colors hover:border-[#d9b45a] hover:text-white"
          >
            {p?.name ?? nameFromSlug(slug)}
          </button>
        );
      })}
    </div>
  );
}

/** detail for the current stop (or the clicked timeline event) */
export function StopPanel({ compact = false }: { compact?: boolean }) {
  const journeyId = useJourneyStore((s) => s.journeyId);
  const stopIndex = useJourneyStore((s) => Math.floor(s.t + 1e-6));
  const focus = useJourneyStore((s) => s.focus);
  const goTo = useJourneyStore((s) => s.goTo);
  const setFocus = useJourneyStore((s) => s.setFocus);
  const reduceMotion = useReducedMotion();

  const journey = journeyById.get(journeyId)!;
  const stop = journey.stops[stopIndex];
  const last = journey.stops.length - 1;
  const focusEvent = focus ? allEvents.find((e) => e.id === focus.id) : undefined;

  // located events from roughly the same moment, as extra places to visit
  const nearby = allEvents
    .filter((e) => Math.abs(e.startYear - stop.year) <= 2 && focusFor(e))
    .slice(0, 4);

  const go = (i: number) => goTo(Math.max(0, Math.min(last, i)));

  const people = focusEvent
    ? (focusEvent.participants ?? []).filter((p) => !/^(god|holy_spirit)(_|$)/.test(p))
    : (stop.people ?? journey.people);
  // it opens only when asked for, so it opens in full
  const showDetail = true;
  const key = focus ? `event-${focus.id}` : `${journey.id}-${stopIndex}`;

  return (
    <div className="flex max-h-full flex-col overflow-hidden rounded-md border border-white/12 bg-[#0d0b09]/88 text-white shadow-2xl backdrop-blur-md">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className={`min-h-0 overflow-y-auto ${compact ? "px-4 py-3" : "p-5"}`}
        >
          {focus ? (
            <>
              <div className="micro-label" style={{ color: GOLD }}>
                Event · {approxYear(focus.year)}
              </div>
              <h2 className="font-display mt-1.5 text-[19px] font-extrabold leading-tight sm:text-[22px]">
                {focus.title}
              </h2>
              <div className="mt-1 text-[12.5px] text-white/65">
                {focus.place}
                {focus.ref && (
                  <>
                    {" · "}
                    <span style={{ color: GOLD }}>{focus.ref}</span>
                  </>
                )}
              </div>
              {showDetail && (
                <>
                  {people.length > 0 && (
                    <div className="mt-4">
                      <PeopleLinks slugs={people.slice(0, 8)} />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setFocus(null)}
                    className="micro-label mt-4 text-white/60 hover:text-white"
                  >
                    ← Back to {journey.name}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="micro-label" style={{ color: GOLD }}>
                  Stop {stopIndex + 1} of {last + 1} · {approxYear(stop.year)}
                </div>
                <button
                  type="button"
                  onClick={() => useWorldStore.getState().setDetails(false)}
                  className="-mr-1 -mt-1 shrink-0 p-1.5 text-white/50 transition-colors hover:text-white"
                  aria-label="Close"
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <h2 className="font-display mt-1.5 text-[19px] font-extrabold leading-tight sm:text-[22px]">
                {stop.title}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-white/65">
                <span className="font-semibold text-white/90">{stop.name}</span>
                <span>·</span>
                <span style={{ color: GOLD }}>{stop.ref}</span>
                {stop.interpretive && (
                  <span
                    className="rounded-sm border border-white/25 px-1.5 py-px text-[10px] uppercase tracking-[0.12em] text-white/60"
                    title="The location is traditional or debated"
                  >
                    Traditional site
                  </span>
                )}
              </div>
              {showDetail && (
                <>
                  <p className="mt-3 text-[14px] leading-relaxed text-white/85">{stop.note}</p>
                  <div className="mt-4">
                    <div className="micro-label mb-2 text-white/45">People</div>
                    <PeopleLinks slugs={people} />
                  </div>
                  {journey.caveat && (
                    <p className="mt-4 border-l-2 border-white/20 pl-3 text-[12px] italic leading-relaxed text-white/55">
                      {journey.caveat}
                    </p>
                  )}
                  {nearby.length > 0 && (
                    <div className="mt-4">
                      <div className="micro-label mb-1.5 text-white/45">Around this time</div>
                      <ul className="space-y-0.5">
                        {nearby.map((e) => (
                          <li key={e.id}>
                            <button
                              type="button"
                              onClick={() => setFocus(focusFor(e))}
                              className="w-full truncate text-left text-[12.5px] text-white/70 hover:text-white"
                            >
                              <span style={{ color: GOLD }}>◆</span> {e.title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!compact && (
                    <ol className="mt-5 space-y-px border-t border-white/10 pt-3">
                      {journey.stops.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => go(i)}
                            className={`flex w-full items-baseline gap-2.5 rounded-sm px-1.5 py-1 text-left text-[12.5px] transition-colors ${
                              i === stopIndex
                                ? "bg-white/10 text-white"
                                : i < stopIndex
                                  ? "text-white/70 hover:bg-white/5"
                                  : "text-white/45 hover:bg-white/5 hover:text-white/80"
                            }`}
                          >
                            <span
                              className="w-4 shrink-0 text-right text-[10px] tabular-nums"
                              style={{ color: i <= stopIndex ? journey.color : undefined }}
                            >
                              {i + 1}
                            </span>
                            <span className="truncate">
                              <span className="font-semibold">{s.name}</span>
                              <span className="text-white/50"> — {s.title}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
