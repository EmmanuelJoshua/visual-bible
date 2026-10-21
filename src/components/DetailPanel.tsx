"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { eventById, getPerson, getPersonSync, loadAllPeople } from "@/data";
import type { BibleEvent, Person } from "@/data/types";
import { formatYear, lifespanLabel } from "@/data/types";
import { revealAndSelect } from "@/lib/reveal";
import { useExplorerStore } from "@/store/useExplorerStore";

function prettifySlug(slug: string): string {
  const base = slug.replace(/_\d+$/, "").replace(/_/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function RelativeChip({ slug }: { slug: string }) {
  const p = getPersonSync(slug);
  return (
    <button
      onClick={() => void revealAndSelect(slug)}
      className="border border-line-strong bg-paper px-2.5 py-0.5 text-xs text-muted transition-colors hover:border-accent hover:text-accent"
    >
      {p?.name ?? prettifySlug(slug)}
    </button>
  );
}

function RelativeGroup({
  label,
  slugs,
}: {
  label: string;
  slugs: (string | undefined)[];
}) {
  const present = slugs.filter((s): s is string => !!s);
  if (!present.length) return null;
  return (
    <div>
      <div className="micro-label mb-1 !text-[10px] text-faint">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {present.map((s) => (
          <RelativeChip key={s} slug={s} />
        ))}
      </div>
    </div>
  );
}

export function DetailPanel() {
  const selected = useExplorerStore((s) => s.selected);
  const select = useExplorerStore((s) => s.select);
  const [loaded, setLoaded] = useState<Person | null>(null);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    getPerson(selected).then((p) => {
      if (!cancelled) setLoaded(p ?? null);
    });
    // relatives of non-core people need the full dataset for names
    void loadAllPeople();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // avoid flashing a stale person while the async lookup resolves
  const person = selected
    ? loaded?.slug === selected
      ? loaded
      : (getPersonSync(selected) ?? null)
    : null;

  const events: BibleEvent[] = (person?.eventIds ?? [])
    .map((id) => eventById.get(id))
    .filter((e): e is BibleEvent => !!e)
    .sort((a, b) => a.sortKey - b.sortKey);

  return (
    <AnimatePresence>
      {person && (
        <motion.aside
          key={person.slug}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="absolute right-3 top-16 bottom-3 z-20 flex w-[340px] max-w-[calc(100vw-24px)] flex-col overflow-hidden border border-line-strong bg-paper shadow-[8px_8px_0_rgba(20,18,16,0.08)]"
        >
          <div className="border-b border-line px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-foreground">
                  {person.name}
                </h2>
                {person.alsoCalled && (
                  <p className="mt-0.5 text-xs italic text-faint">
                    also called {person.alsoCalled}
                  </p>
                )}
              </div>
              <button
                onClick={() => select(null)}
                className="p-1.5 text-faint transition-colors hover:text-accent"
                aria-label="Close panel"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M1 1l12 12M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {person.messianic && (
                <span className="bg-accent px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#f4efe6]">
                  Line of the Messiah
                </span>
              )}
              {lifespanLabel(person) && (
                <span className="border border-line px-2 py-0.5 text-[10px] text-muted">
                  {lifespanLabel(person)}
                </span>
              )}
              {(person.groups ?? []).slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="border border-line px-2 py-0.5 text-[10px] text-muted"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {person.bio && (
              <p className="text-[13px] leading-relaxed text-foreground/85">
                {person.bio}
                {person.dictLink && (
                  <>
                    {" "}
                    <a
                      href={person.dictLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline decoration-dotted underline-offset-2 hover:text-accent-bright"
                    >
                      Easton&apos;s ↗
                    </a>
                  </>
                )}
              </p>
            )}

            <RelativeGroup label="Father" slugs={[person.father]} />
            <RelativeGroup label="Mother" slugs={[person.mother]} />
            <RelativeGroup label="Partners" slugs={person.partners ?? []} />
            <RelativeGroup label="Children" slugs={person.children ?? []} />

            {events.length > 0 && (
              <div>
                <div className="micro-label mb-2 !text-[10px] text-faint">
                  Events
                </div>
                <ul>
                  {events.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/timeline?event=${e.id}`}
                        className="group -mx-2 flex items-baseline justify-between gap-2 border-t border-line px-2 py-1.5 transition-colors hover:bg-surface"
                      >
                        <span className="text-[13px] text-foreground/85 group-hover:text-accent">
                          {e.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-faint">
                          {formatYear(e.startYear)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pb-1 text-[11px] text-faint">
              Mentioned in {person.verseCount} verse
              {person.verseCount === 1 ? "" : "s"}
              {" · "}first appears ≈ {formatYear(person.minYear)}
            </div>
          </div>

          <div className="border-t border-line p-3">
            <Link
              href={`/timeline?year=${person.birthYear ?? person.minYear}`}
              className="micro-label block w-full bg-accent px-4 py-2.5 text-center !text-[11px] text-[#f4efe6] transition-colors hover:bg-accent-bright"
            >
              View this era on the timeline&ensp;→
            </Link>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
