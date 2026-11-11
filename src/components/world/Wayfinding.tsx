"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PILL, usePopover } from "@/components/journeys/controls";
import { approxYear } from "@/components/journeys/geometry";
import { findStructure, goToYear, showOverview, showTown } from "@/world/actions";
import { useWorldStore } from "@/world/store";
import { STRUCTURES } from "@/world/structures";
import { TOWNS, type Town } from "@/world/towns";
import { useStoryStore } from "@/story/store";

/**
 * Finding your way about a map that runs from the whole Near East down to a
 * single courtyard: a search for any town or structure (which takes the
 * clock to its time as well as the camera to its place), a way back to the
 * whole model, and, on arriving, a few places worth beginning at.
 */

type Hit = { key: string; name: string; note: string; go: () => void };

const STRUCTURE_NAMES: Record<string, string> = {
  temple: "Solomon’s Temple",
  tabernacle: "The Tabernacle",
  "noahs-ark": "Noah’s Ark",
  ark: "Ark of the Covenant",
};

function years(t: Town) {
  return t.to === undefined ? `from ${approxYear(t.from).replace("c. ", "")}` : `${approxYear(t.from).replace("c. ", "")} – ${approxYear(t.to).replace("c. ", "")}`;
}

function useHits(query: string): Hit[] {
  const all = useMemo<Hit[]>(() => {
    const structures = STRUCTURES.filter((s) => STRUCTURE_NAMES[s.id]).map((s) => ({
      key: `s:${s.id}`,
      name: STRUCTURE_NAMES[s.id],
      note: "Structure",
      go: () => findStructure(s.id),
    }));
    const towns = [...TOWNS]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => ({ key: `t:${t.name}`, name: t.name, note: years(t), go: () => showTown(t.name) }));
    return [...structures, ...towns];
  }, []);
  const q = query.trim().toLowerCase();
  if (!q) return all;
  // names that begin with it first, then those that hold it
  return [...all.filter((h) => h.name.toLowerCase().startsWith(q)), ...all.filter((h) => !h.name.toLowerCase().startsWith(q) && h.name.toLowerCase().includes(q))];
}

/** "Find a place": every town and structure on the map, by name */
export function FindPlace() {
  const { open, setOpen, ref } = usePopover();
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const hits = useHits(query);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  // "/" opens it from anywhere on the map
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key !== "/" || el.closest("input, textarea, select") || useWorldStore.getState().overlay) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${at}"]`)?.scrollIntoView({ block: "nearest" });
  }, [at]);

  const choose = (h: Hit | undefined) => {
    if (!h) return;
    h.go();
    setOpen(false);
    setQuery("");
    setAt(0);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" className={PILL} onClick={() => setOpen(!open)} aria-expanded={open} title="Find a place ( / )">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <circle cx="7" cy="7" r="4.5" />
          <path d="m10.5 10.5 3.5 3.5" strokeLinecap="round" />
        </svg>
        Find a place
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-md border border-white/15 bg-[#0d0b09]/95 shadow-2xl backdrop-blur-md">
          <input
            ref={input}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setAt((i) => Math.min(hits.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setAt((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") choose(hits[at]);
            }}
            placeholder="Jerusalem, Babylon, the Temple…"
            aria-label="Find a place"
            className="w-full border-b border-white/10 bg-transparent px-3.5 py-2.5 text-[13px] text-white placeholder:text-white/35 focus:outline-none"
          />
          <ul ref={list} className="max-h-72 overflow-y-auto p-1.5" role="listbox">
            {hits.map((h, i) => (
              <li key={h.key} role="option" aria-selected={i === at}>
                <button
                  type="button"
                  data-i={i}
                  onClick={() => choose(h)}
                  onPointerMove={() => setAt(i)}
                  className={`flex w-full items-baseline justify-between gap-3 rounded-sm px-2.5 py-1.5 text-left text-[13px] ${i === at ? "bg-white/10 text-white" : "text-white/85"}`}
                >
                  <span className="truncate">{h.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-white/40">{h.note}</span>
                </button>
              </li>
            ))}
            {hits.length === 0 && <li className="px-2.5 py-2 text-[13px] text-white/45">Nothing on the map by that name.</li>}
          </ul>
          <p className="border-t border-white/10 px-3.5 py-2 text-[11px] leading-snug text-white/40">Going to a place also moves the clock to a year it stood in.</p>
        </div>
      )}
    </div>
  );
}

/** back to the whole model */
export function OverviewButton() {
  return (
    <button type="button" className={PILL} onClick={showOverview} title="Back to the whole map">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
        <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Whole map
    </button>
  );
}

const STARTS: { title: string; when: string; line: string; go: () => void }[] = [
  { title: "Solomon’s Temple", when: "Jerusalem · c. 950 BC", line: "The house of cedar and gold on its mount.", go: () => findStructure("temple") },
  { title: "Noah’s Ark", when: "Ararat · c. 2347 BC", line: "At rest on the mountain after the flood.", go: () => findStructure("noahs-ark") },
  {
    title: "Babylon",
    when: "The exile · c. 560 BC",
    line: "Nebuchadnezzar’s city: the ziggurat and the Ishtar Gate.",
    go: () => {
      goToYear(-560);
      showTown("Babylon");
    },
  },
  {
    title: "Antioch",
    when: "The early church · AD 50",
    line: "Where the disciples were first called Christians.",
    go: () => {
      goToYear(50);
      showTown("Antioch");
    },
  },
];

const SEEN = "vb:welcomed";

/**
 * On arriving with nothing asked for (no story, no journey in the link): a
 * few places to begin at, since the map opens on the whole Near East in the
 * days before the flood, when little yet stands on it.
 */
export function Welcome() {
  const [show, setShow] = useState(false);
  const inStory = useStoryStore((s) => s.storyId !== null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === "1";
    } catch {
      // private windows: just show it
    }
    // the map and its markers are client-only too: this reads the link once, on arriving
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.has("welcome") || (!seen && !q.has("story") && !q.has("debug"))) setShow(true);
  }, []);
  const close = () => {
    setShow(false);
    try {
      sessionStorage.setItem(SEEN, "1");
    } catch {
      // nothing to remember it in
    }
  };
  useEffect(() => {
    if (!show) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [show]);
  if (!show || inStory) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-[25] flex items-center justify-center px-4">
      <div role="dialog" aria-label="Where to begin" className="pointer-events-auto w-full max-w-xl rounded-md border border-white/15 bg-[#0d0b09]/92 p-5 shadow-2xl backdrop-blur-md sm:p-6">
        <p className="micro-label text-[#d9b45a]">The world of the Bible</p>
        <h2 className="mt-1.5 font-display text-[22px] font-bold leading-tight text-white">Where would you like to begin?</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-white/60">
          One map, from the flood to the early church. Scroll to come down to the land, drag the ages along the bottom to move through time, or start at one of these.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {STARTS.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => {
                s.go();
                close();
              }}
              className="rounded-sm border border-white/12 bg-white/[0.03] px-3.5 py-3 text-left transition-colors hover:border-[#d9b45a]/70 hover:bg-white/[0.07]"
            >
              <span className="block text-[14px] font-semibold text-white">{s.title}</span>
              <span className="mt-0.5 block text-[11px] uppercase tracking-[0.12em] text-[#d9b45a]/90">{s.when}</span>
              <span className="mt-1.5 block text-[12.5px] leading-snug text-white/55">{s.line}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-white/40">Press / to find any place by name.</span>
          <button type="button" onClick={close} className="rounded-full border border-white/20 px-4 py-1.5 text-[12px] font-semibold text-white/85 hover:border-white/45 hover:text-white">
            Just explore
          </button>
        </div>
      </div>
    </div>
  );
}
