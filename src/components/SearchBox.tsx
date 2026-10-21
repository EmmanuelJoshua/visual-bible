"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadAllPeople } from "@/data";
import type { Person } from "@/data/types";
import { formatYear } from "@/data/types";
import { revealAndSelect } from "@/lib/reveal";

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // warm the full dataset on first focus
  const warm = () => {
    if (!people) loadAllPeople().then(setPeople);
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !people) return [];
    const scored: { p: Person; score: number }[] = [];
    for (const p of people) {
      const name = p.name.toLowerCase();
      const aka = p.alsoCalled?.toLowerCase() ?? "";
      let score = -1;
      if (name.startsWith(q)) score = 30;
      else if (name.includes(q)) score = 20;
      else if (aka.includes(q)) score = 10;
      if (score < 0) continue;
      // among same-named people, prefer the famous / messianic-line one
      if (p.messianic) score += 5;
      else if (p.core) score += 3;
      scored.push({ p, score });
    }
    return scored
      .sort((a, b) => b.score - a.score || b.p.verseCount - a.p.verseCount)
      .slice(0, 8)
      .map((s) => s.p);
  }, [query, people]);

  // clamp instead of resetting via effect
  const safeHighlight = Math.min(highlight, Math.max(results.length - 1, 0));

  const pick = (p: Person) => {
    setOpen(false);
    setQuery("");
    void revealAndSelect(p.slug);
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        value={query}
        onFocus={() => {
          warm();
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight(Math.min(safeHighlight + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight(Math.max(safeHighlight - 1, 0));
          } else if (e.key === "Enter" && results[safeHighlight]) {
            pick(results[safeHighlight]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search 3,000 people…"
        className="w-56 border border-line-strong bg-paper/90 px-4 py-1.5 text-sm text-foreground placeholder-faint outline-none backdrop-blur transition-colors focus:border-accent"
        aria-label="Search people"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden border border-line-strong bg-paper shadow-[6px_6px_0_rgba(20,18,16,0.08)]">
          {results.map((p, i) => (
            <li key={p.slug}>
              <button
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(p)}
                className={`flex w-full items-baseline justify-between gap-2 border-b border-line px-4 py-2 text-left text-sm last:border-b-0 ${
                  i === safeHighlight
                    ? "bg-accent text-[#f4efe6]"
                    : "text-foreground"
                }`}
              >
                <span className="flex items-baseline gap-2 truncate">
                  {p.name}
                  {p.messianic && (
                    <span
                      className={`text-[9px] uppercase tracking-wider ${
                        i === safeHighlight ? "text-[#f4efe6]/80" : "text-accent"
                      }`}
                    >
                      messianic line
                    </span>
                  )}
                </span>
                <span
                  className={`shrink-0 text-[10px] ${
                    i === safeHighlight ? "text-[#f4efe6]/70" : "text-faint"
                  }`}
                >
                  {p.birthYear !== undefined
                    ? formatYear(p.birthYear)
                    : `${p.verseCount} verses`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
