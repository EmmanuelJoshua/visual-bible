"use client";

import { corePeople } from "@/data";
import type { Era } from "@/data/eras";
import { formatYear } from "@/data/types";
import Link from "next/link";

/**
 * KAIRO-style stat rows: hairline-ruled index of the era's major figures,
 * each with a red bar spanning the years they lived within the era.
 */
export function LifespanStrip({ era }: { era: Era }) {
  const span = era.endYear - era.startYear;
  const figures = corePeople
    .filter(
      (p) =>
        p.birthYear !== undefined &&
        p.deathYear !== undefined &&
        p.birthYear < era.endYear &&
        p.deathYear > era.startYear,
    )
    .sort((a, b) => b.verseCount - a.verseCount)
    .slice(0, 7)
    .sort((a, b) => (a.birthYear ?? 0) - (b.birthYear ?? 0));

  if (figures.length < 2) return null;

  return (
    <div className="mx-auto mb-16 w-full max-w-3xl px-6">
      <div className="micro-label mb-2 flex items-baseline justify-between !text-[10px] text-faint">
        <span>Lives of this era</span>
        <span>
          {formatYear(era.startYear)} — {formatYear(era.endYear)}
        </span>
      </div>
      <div>
        {figures.map((p, i) => {
          const start = Math.max(p.birthYear!, era.startYear);
          const end = Math.min(p.deathYear!, era.endYear);
          const left = ((start - era.startYear) / span) * 100;
          const width = Math.max(((end - start) / span) * 100, 1.5);
          return (
            <Link
              key={p.slug}
              href={`/genealogy?person=${p.slug}`}
              className="group flex items-center gap-4 border-t border-line py-2 last:border-b"
              title={`${p.name}: ${formatYear(p.birthYear!)} – ${formatYear(p.deathYear!)}`}
            >
              <span className="w-6 shrink-0 text-[9px] font-semibold tracking-[0.1em] text-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`w-24 shrink-0 truncate font-display text-[12px] font-bold tracking-tight group-hover:text-accent ${
                  p.messianic ? "text-accent" : "text-foreground"
                }`}
              >
                {p.name}
              </span>
              <span className="relative h-3 flex-1">
                <span className="absolute top-1/2 h-px w-full bg-line" />
                <span
                  className={`absolute top-1/2 h-[3px] -translate-y-1/2 transition-opacity group-hover:opacity-100 ${
                    p.messianic ? "bg-accent" : "bg-accent-dim opacity-70"
                  }`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </span>
              <span className="micro-label hidden w-28 shrink-0 text-right !text-[9px] text-faint sm:block">
                {formatYear(p.birthYear!)} – {formatYear(p.deathYear!)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
