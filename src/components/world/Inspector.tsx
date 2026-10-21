"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { eventById, getPerson, getPersonSync, loadAllPeople, messianicSet } from "@/data";
import { artifactById, type ArtifactId } from "@/data/artifacts";
import { BUILDS } from "@/data/builds";
import { journeyById } from "@/data/journeys";
import { lifespanLabel, type Person } from "@/data/types";
import { StopPanel } from "@/components/journeys/StopPanel";
import { focusFor } from "@/components/journeys/TimelineStrip";
import { useJourneyStore } from "@/components/journeys/store";
import { approxYear } from "@/components/journeys/geometry";
import { goToYear, openBuild, openTree, showPerson, stepNow } from "@/world/actions";
import { journeysOf, presenceAt } from "@/world/presence";
import { structureById, structuresAt } from "@/world/structures";
import { useWorldStore } from "@/world/store";

const GOLD = "#d9b45a";

const shell =
  "flex max-h-full flex-col overflow-hidden rounded-md border border-white/12 bg-[#0d0b09]/88 text-white shadow-2xl backdrop-blur-md";
const primary =
  "micro-label rounded-sm bg-[#d9b45a] px-3.5 py-2 !text-[10.5px] text-[#0d0b09] transition-colors hover:bg-[#e8c46a]";
const secondary =
  "micro-label rounded-sm border border-white/25 px-3.5 py-2 !text-[10.5px] text-white/80 transition-colors hover:border-white/60 hover:text-white";

function CloseButton() {
  const select = useWorldStore((s) => s.select);
  return (
    <button
      type="button"
      onClick={() => select(null)}
      className="-mr-1 -mt-1 shrink-0 p-1.5 text-white/50 transition-colors hover:text-white"
      aria-label="Back to the journey"
    >
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function usePerson(slug: string) {
  const [person, setPerson] = useState<Person | undefined>(() => getPersonSync(slug));
  useEffect(() => {
    let live = true;
    void getPerson(slug).then((p) => live && setPerson(p));
    void loadAllPeople();
    return () => {
      live = false;
    };
  }, [slug]);
  return person?.slug === slug ? person : getPersonSync(slug);
}

function PersonChip({ slug }: { slug: string }) {
  const p = getPersonSync(slug);
  return (
    <button
      type="button"
      onClick={() => showPerson(slug, { fly: true })}
      className="rounded-full border border-white/20 px-2.5 py-1 text-[11.5px] font-medium text-white/85 transition-colors hover:border-[#d9b45a] hover:text-white"
    >
      {p?.name ?? slug.replace(/_\d+$/, "").replace(/_/g, " ")}
    </button>
  );
}

function PersonCard({ slug, compact }: { slug: string; compact: boolean }) {
  const person = usePerson(slug);
  const year = useWorldStore((s) => Math.round(s.year));
  const [open, setOpen] = useState(false);
  const journeyId = useJourneyStore((s) => s.journeyId);
  const stop = useJourneyStore((s) => Math.floor(s.t + 1e-6));
  const here = presenceAt(year, { journeyId, stop }).find((p) => p.slug === slug);
  const journeys = journeysOf(slug).map((id) => journeyById.get(id)!);
  const events = (person?.eventIds ?? [])
    .map((id) => eventById.get(id))
    .filter((e) => !!e)
    .sort((a, b) => a.sortKey - b.sortKey);
  const family = [person?.father, person?.mother, ...(person?.partners ?? []), ...(person?.children ?? [])].filter(
    (s): s is string => !!s,
  );
  const showDetail = !compact || open;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="micro-label" style={{ color: GOLD }}>
            {here ? `${here.place} · ${approxYear(year)}` : "Person"}
          </div>
          <h2 className="font-display mt-1.5 text-[19px] font-extrabold leading-tight sm:text-[22px]">
            {person?.name ?? slug}
          </h2>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-white/60">
            {messianicSet.has(slug) && (
              <span className="rounded-sm bg-[#b4261a] px-1.5 py-px text-[10px] uppercase tracking-[0.12em] text-white">
                Line of the Messiah
              </span>
            )}
            {person && lifespanLabel(person) && <span>{lifespanLabel(person)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {compact && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="micro-label shrink-0 text-white/60 hover:text-white"
              aria-expanded={open}
            >
              {open ? "Less" : "More"}
            </button>
          )}
          <CloseButton />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={primary} onClick={() => openTree(slug)}>
          Family tree
        </button>
        {journeys.map((j) => (
          <button
            key={j.id}
            type="button"
            className={secondary}
            onClick={() => {
              useWorldStore.getState().select(null);
              useJourneyStore.getState().select(j.id, 0);
            }}
          >
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: j.color }} />
            {j.short}
          </button>
        ))}
      </div>

      {showDetail && (
        <>
          {person?.bio && (
            <p className="mt-4 line-clamp-6 text-[13.5px] leading-relaxed text-white/80">{person.bio}</p>
          )}
          {family.length > 0 && (
            <div className="mt-4">
              <div className="micro-label mb-2 text-white/45">Family</div>
              <div className="flex flex-wrap gap-1.5">
                {family.slice(0, 12).map((s) => (
                  <PersonChip key={s} slug={s} />
                ))}
              </div>
            </div>
          )}
          {events.length > 0 && (
            <div className="mt-4">
              <div className="micro-label mb-1.5 text-white/45">Events</div>
              <ul className="space-y-0.5">
                {events.slice(0, 10).map((e) => {
                  const f = focusFor(e);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (f) useJourneyStore.getState().setFocus(f);
                          else goToYear(e.startYear);
                        }}
                        className="flex w-full items-baseline justify-between gap-2 text-left text-[12.5px] text-white/70 hover:text-white"
                      >
                        <span className="truncate">
                          <span style={{ color: f ? GOLD : "rgba(255,255,255,0.3)" }}>◆</span> {e.title}
                        </span>
                        <span className="shrink-0 text-[10.5px] text-white/40">{approxYear(e.startYear)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}

function StructureCard({ id, compact }: { id: ArtifactId; compact: boolean }) {
  const year = useWorldStore((s) => Math.round(s.year));
  const art = artifactById.get(id)!;
  const placement = structureById.get(id)!;
  const build = BUILDS[id];
  const now = structuresAt(year).find((s) => s.placement.id === id);
  const [open, setOpen] = useState(false);
  const showDetail = !compact || open;
  const step = build ? stepNow(id) : 0;
  const building = now?.site.building && now.progress < 1;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="micro-label" style={{ color: GOLD }}>
            {now ? `${now.site.place} · ${approxYear(year)}` : "Not standing in this year"}
          </div>
          <h2 className="font-display mt-1.5 text-[19px] font-extrabold leading-tight sm:text-[22px]">
            {art.name}
          </h2>
          <div className="mt-0.5 text-[13px] text-white/55" dir="rtl">
            {art.hebrew}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {compact && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="micro-label shrink-0 text-white/60 hover:text-white"
              aria-expanded={open}
            >
              {open ? "Less" : "More"}
            </button>
          )}
          <CloseButton />
        </div>
      </div>

      {build && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={() => openBuild(id)}>
            {building ? `Watch it go up · step ${step + 1}` : "Build it step by step"}
          </button>
          {building && (
            <button type="button" className={secondary} onClick={() => openBuild(id, 0)}>
              From the start
            </button>
          )}
        </div>
      )}

      {showDetail && (
        <>
          {now && (
            <p className="mt-4 text-[13.5px] leading-relaxed text-white/85">
              {now.site.note} <span style={{ color: GOLD }}>{now.site.ref}</span>
            </p>
          )}
          <p className="mt-3 text-[13px] leading-relaxed text-white/65">{art.summary}</p>
          <div className="mt-4">
            <div className="micro-label mb-1.5 text-white/45">Where it stood</div>
            <ol className="space-y-px">
              {placement.sites.map((s) => {
                const here = now?.site === s;
                return (
                  <li key={`${s.place}-${s.from}`}>
                    <button
                      type="button"
                      onClick={() => {
                        goToYear(s.from);
                        useWorldStore.getState().fly({ center: s.coord, zoom: placement.zoom, pitch: 62, bearing: -18 });
                      }}
                      className={`flex w-full items-baseline justify-between gap-2 rounded-sm px-1.5 py-1 text-left text-[12.5px] transition-colors ${
                        here ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="truncate font-semibold">
                        {s.place}
                        {s.building && <span className="font-normal text-white/45"> — built</span>}
                      </span>
                      <span className="shrink-0 text-[10.5px] text-white/40">
                        {approxYear(s.from)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </>
  );
}

/** the panel beside the map: what you picked, or the journey you're on */
export function Inspector({ compact = false }: { compact?: boolean }) {
  const selection = useWorldStore((s) => s.selection);
  const reduceMotion = useReducedMotion();
  if (!selection) return <StopPanel compact={compact} />;
  const key = selection.kind === "person" ? `p-${selection.slug}` : `s-${selection.id}`;
  return (
    <div className={shell}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className={`min-h-0 overflow-y-auto ${compact ? "px-4 py-3" : "p-5"}`}
        >
          {selection.kind === "person" ? (
            <PersonCard slug={selection.slug} compact={compact} />
          ) : (
            <StructureCard id={selection.id} compact={compact} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
