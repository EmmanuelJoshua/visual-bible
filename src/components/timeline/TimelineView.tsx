"use client";

import { Suspense, useEffect, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useScroll, useSpring } from "framer-motion";
import { allEvents, loadAllPeople } from "@/data";
import { ERAS, type Era } from "@/data/eras";
import type { BibleEvent } from "@/data/types";
import { EventCard } from "./EventCard";
import { LifespanStrip } from "./LifespanStrip";
import { EraBackdrop } from "./EraBackdrop";

const THEME_CLASS: Record<Era["theme"], string> = {
  cream: "",
  ink: "theme-ink",
  red: "theme-red",
};

function EraSection({
  era,
  index,
  events,
  highlightedEvent,
}: {
  era: Era;
  index: number;
  events: BibleEvent[];
  highlightedEvent: string | null;
}) {
  const number = String(index + 1).padStart(2, "0");
  return (
    <section
      id={`era-${era.id}`}
      className={`relative ${THEME_CLASS[era.theme]}`}
    >
      {/* chapter header — editorial, left-aligned */}
      <div className="relative overflow-hidden">
        <EraBackdrop era={era} />
        <div className="relative mx-auto flex min-h-[52vh] max-w-6xl flex-col justify-center px-4 py-20 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line-strong text-[10px] font-semibold text-muted">
                {number}
              </span>
              <span className="micro-label text-muted">{era.range}</span>
              <span className="text-[13px] font-medium text-accent" dir="auto">
                {era.script}
              </span>
            </div>
            <h2 className="display-tight max-w-4xl text-[13vw] text-foreground sm:text-6xl lg:text-7xl">
              {era.name}
            </h2>
            <div className="mt-6 flex items-center gap-4">
              <span className="hairline w-12 shrink-0" />
              <p className="max-w-md text-[14px] leading-relaxed text-muted">
                {era.tagline}
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <LifespanStrip era={era} />

      {/* events on the spine */}
      {events.length > 0 && (
        <div className="relative mx-auto max-w-5xl space-y-6 px-6 pb-24">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line max-md:left-4" />
          {events.map((e, i) => (
            <EventCard
              key={e.id}
              event={e}
              index={i}
              side={i % 2 === 0 ? "left" : "right"}
              highlighted={highlightedEvent === e.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function EraNav() {
  return (
    <nav className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-end gap-1 lg:flex">
      {ERAS.map((era, i) => (
        <a
          key={era.id}
          href={`#era-${era.id}`}
          className="group flex items-center gap-2 py-0.5"
          aria-label={era.name}
        >
          <span className="pointer-events-none whitespace-nowrap border border-[#141210]/20 bg-[#fffcf6] px-2 py-0.5 text-[10px] text-[#141210]/70 opacity-0 transition-opacity group-hover:opacity-100">
            {era.name}
          </span>
          <span className="text-[9px] font-semibold tracking-[0.1em] text-[#f4efe6]/60 mix-blend-difference transition-colors group-hover:text-[#f4efe6]">
            {String(i + 1).padStart(2, "0")}
          </span>
        </a>
      ))}
    </nav>
  );
}

function DeepLink({ eventsByEra }: { eventsByEra: Map<string, BibleEvent[]> }) {
  const params = useSearchParams();
  useEffect(() => {
    const eventId = params.get("event");
    const year = params.get("year");
    let target: string | null = null;
    if (eventId) target = `event-${eventId}`;
    else if (year !== null) {
      const y = Number(year);
      const era = ERAS.find((e) => y <= e.endYear) ?? ERAS[ERAS.length - 1];
      target = `era-${era.id}`;
    }
    if (target) {
      // allow the sections to mount first
      requestAnimationFrame(() => {
        document.getElementById(target!)?.scrollIntoView({
          behavior: "instant",
          block: "center",
        });
      });
    }
  }, [params, eventsByEra]);
  return null;
}

export function TimelineView() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 28 });

  // participant chips want real names
  useEffect(() => {
    void loadAllPeople();
  }, []);

  const eventsByEra = useMemo(() => {
    const map = new Map<string, BibleEvent[]>();
    for (const era of ERAS) map.set(era.id, []);
    for (const e of allEvents) map.get(e.era)?.push(e);
    return map;
  }, []);

  // read once on the client; null during SSR so hydration stays consistent
  const highlightedEvent = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("event"),
    () => null,
  );

  return (
    <div className="relative pt-14">
      <motion.div
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-14 z-40 h-0.5 origin-left bg-accent"
      />
      <Suspense fallback={null}>
        <DeepLink eventsByEra={eventsByEra} />
      </Suspense>
      <EraNav />

      <header className="mx-auto flex min-h-[38vh] max-w-6xl flex-col justify-center px-4 pt-14 sm:px-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="hairline w-10" />
          <span className="micro-label text-faint">
            Every dated event · Creation to AD 100
          </span>
        </div>
        <h1 className="display-tight text-[13vw] text-foreground sm:text-6xl lg:text-7xl">
          Four millennia.
          <br />
          <span className="text-accent">Ten movements.</span>
        </h1>
        <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted">
          Scroll through the whole arc of Scripture — every dated event from the
          creation to the early church, drawn from the Theographic knowledge
          graph.
        </p>
      </header>

      {ERAS.map((era, i) => (
        <EraSection
          key={era.id}
          era={era}
          index={i}
          events={eventsByEra.get(era.id) ?? []}
          highlightedEvent={highlightedEvent}
        />
      ))}

      <footer className="theme-ink px-6 py-20 text-center">
        <div className="micro-label mb-3 text-faint">Revelation 22:13</div>
        <p className="font-display text-xl font-bold tracking-tight text-foreground">
          “I am the Alpha and the Omega, the beginning and the end.”
        </p>
      </footer>
    </div>
  );
}
