"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Artifact } from "@/data/artifacts";
import type { BuildInfo } from "@/data/builds";
import { BlueprintView } from "./BlueprintView";
import type { BuildMeta } from "./BuildStage";

const BuildStage = dynamic(() => import("./BuildStage").then((m) => m.BuildStage), {
  ssr: false,
});

const STEP_MS = 3400;
const STOP_MS = 5600;

const pad = (n: number) => String(n).padStart(2, "0");

export function BuildWorkbench({
  artifact,
  info,
  initialStep = 0,
}: {
  artifact: Artifact;
  info: BuildInfo;
  initialStep?: number;
}) {
  const steps = info.steps;
  const last = steps.length - 1;
  const [step, setStep] = useState(() => Math.min(Math.max(0, initialStep), last));
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<"scene" | "blueprint">("scene");
  const [walk, setWalk] = useState<number | null>(null);
  const [walkPlaying, setWalkPlaying] = useState(false);
  const [meta, setMeta] = useState<BuildMeta | null>(null);
  const [fitNonce, setFitNonce] = useState(0);
  const cur = steps[step];
  const stops = info.walk;

  const go = useCallback(
    (s: number) => {
      setWalk(null);
      setWalkPlaying(false);
      setStep(Math.min(Math.max(0, s), last));
    },
    [last],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("object", artifact.id);
    url.searchParams.set("step", String(step + 1));
    history.replaceState(null, "", url);
  }, [artifact.id, step]);

  // auto-advance
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      const next = Math.min(step + 1, last);
      setStep(next);
      if (next >= last) setPlaying(false);
    }, STEP_MS);
    return () => clearTimeout(t);
  }, [playing, step, last]);

  useEffect(() => {
    if (!walkPlaying || walk === null || !stops) return;
    const t = setTimeout(() => {
      const next = Math.min(walk + 1, stops.length - 1);
      setWalk(next);
      if (next >= stops.length - 1) setWalkPlaying(false);
    }, STOP_MS);
    return () => clearTimeout(t);
  }, [walkPlaying, walk, stops]);

  const startWalk = (i = 0) => {
    setPlaying(false);
    setStep(last);
    setWalk(i);
  };

  const togglePlay = useCallback(() => {
    setWalk(null);
    setWalkPlaying(false);
    if (!playing && step >= last) setStep(0);
    setPlaying(!playing);
  }, [playing, step, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlaying(false);
        if (walk !== null && stops) setWalk(Math.min(walk + 1, stops.length - 1));
        else go(step + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlaying(false);
        if (walk !== null) setWalk(Math.max(walk - 1, 0));
        else go(step - 1);
      } else if (e.key === " " && tag !== "BUTTON") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step, walk, stops, togglePlay]);

  const counts = useMemo(() => {
    if (!meta) return null;
    let placed = 0;
    let total = 0;
    const tally: Record<string, number> = {};
    const all: Record<string, number> = {};
    meta.steps.forEach((s, i) => {
      total += s.parts;
      for (const [k, v] of Object.entries(s.tally)) {
        all[k] = (all[k] ?? 0) + (v ?? 0);
        if (i <= step) tally[k] = (tally[k] ?? 0) + (v ?? 0);
      }
      if (i <= step) placed += s.parts;
    });
    const fams = Object.keys(all).sort((a, b) => all[b] - all[a]);
    return { placed, total, tally, all, fams, added: meta.steps[step]?.parts ?? 0 };
  }, [meta, step]);

  // scrub by dragging across the segmented bar
  const barRef = useRef<HTMLDivElement>(null);
  const scrubbing = useRef(false);
  const scrubTo = (clientX: number) => {
    const el = barRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const k = Math.min(0.9999, Math.max(0, (clientX - r.left) / r.width));
    const s = Math.floor(k * steps.length);
    if (s !== step) {
      setPlaying(false);
      go(s);
    }
  };

  const stop = walk !== null && stops ? stops[walk] : null;

  return (
    <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="theme-ink relative h-[64vh] min-h-[420px] overflow-hidden lg:h-[min(80vh,780px)]">
        <BuildStage
          key={artifact.id}
          id={artifact.id}
          info={info}
          step={step}
          walk={walk}
          hidden={view === "blueprint"}
          fitNonce={fitNonce}
          onReady={setMeta}
        />
        {view === "blueprint" && (
          <BlueprintView
            bp={info.blueprint}
            step={step}
            walk={stops}
            activeStop={walk}
            onStop={(i) => {
              setView("scene");
              startWalk(i);
            }}
          />
        )}

        {!meta && view === "scene" && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="micro-label animate-pulse text-[#f4efe6]/60">
              Laying out the parts…
            </span>
          </div>
        )}

        {/* top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3 sm:p-4">
          <div className="pointer-events-auto flex border border-[#f4efe6]/30 bg-[#141210]/70 backdrop-blur-sm">
            {(["scene", "blueprint"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`micro-label px-3 py-1.5 !text-[10px] transition-colors ${
                  view === v
                    ? "bg-[#f4efe6] text-[#141210]"
                    : "text-[#f4efe6]/70 hover:text-[#f4efe6]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="pointer-events-auto flex gap-2">
            {stops && (
              <button
                onClick={() => {
                  setView("scene");
                  if (walk === null) {
                    startWalk(0);
                    setWalkPlaying(true);
                  } else {
                    setWalk(null);
                    setWalkPlaying(false);
                  }
                }}
                className={`micro-label border px-3 py-1.5 !text-[10px] backdrop-blur-sm ${
                  walk !== null
                    ? "border-[#e2b850] bg-[#e2b850] text-[#141210]"
                    : "border-[#e2b850]/70 bg-[#141210]/70 text-[#e2b850] hover:border-[#e2b850]"
                }`}
              >
                {walk !== null ? "Exit walk" : "Walk through"}
              </button>
            )}
            {view === "scene" && walk === null && (
              <button
                onClick={() => setFitNonce((n) => n + 1)}
                className="micro-label border border-[#f4efe6]/30 bg-[#141210]/70 px-3 py-1.5 !text-[10px] text-[#f4efe6]/70 backdrop-blur-sm hover:text-[#f4efe6]"
              >
                Fit
              </button>
            )}
          </div>
        </div>

        {/* walk caption */}
        {stop && view === "scene" && stops && (
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-[#141210]/90 to-transparent p-4 pt-12">
            <div>
              <div className="micro-label !text-[10px] text-[#e2b850]">
                Stop {stop.n} of {stops.length}
              </div>
              <div className="font-display text-xl font-extrabold text-[#f4efe6]">
                {stop.name}
              </div>
              <div className="max-w-md text-[13px] text-[#f4efe6]/75">{stop.note}</div>
            </div>
            <div className="flex gap-2">
              <CtlButton
                label="Previous stop"
                onClick={() => {
                  setWalkPlaying(false);
                  setWalk(Math.max(0, (walk ?? 0) - 1));
                }}
              >
                ‹
              </CtlButton>
              <CtlButton label={walkPlaying ? "Pause" : "Play"} onClick={() => setWalkPlaying((p) => !p)}>
                {walkPlaying ? "❚❚" : "▶"}
              </CtlButton>
              <CtlButton
                label="Next stop"
                onClick={() => {
                  setWalkPlaying(false);
                  setWalk(Math.min(stops.length - 1, (walk ?? 0) + 1));
                }}
              >
                ›
              </CtlButton>
            </div>
          </div>
        )}

        {/* stepper */}
        {walk === null && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#141210]/90 via-[#141210]/55 to-transparent px-3 pb-3 pt-10 sm:px-4 sm:pb-4">
            <div
              ref={barRef}
              className="flex h-5 cursor-pointer touch-none items-center gap-[3px]"
              onPointerDown={(e) => {
                scrubbing.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                scrubTo(e.clientX);
              }}
              onPointerMove={(e) => scrubbing.current && scrubTo(e.clientX)}
              onPointerUp={() => (scrubbing.current = false)}
              onPointerCancel={() => (scrubbing.current = false)}
              role="slider"
              aria-label="Build step"
              aria-valuemin={1}
              aria-valuemax={steps.length}
              aria-valuenow={step + 1}
              aria-valuetext={`Step ${step + 1}: ${cur.title}`}
              tabIndex={0}
            >
              {steps.map((s, i) => (
                <span
                  key={s.id}
                  title={`${i + 1}. ${s.title}`}
                  className={`h-1.5 flex-1 transition-colors duration-300 ${
                    i < step
                      ? "bg-[#f4efe6]/80"
                      : i === step
                        ? "h-2.5 bg-[#e2b850]"
                        : "bg-[#f4efe6]/20"
                  }`}
                />
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <CtlButton label="Previous step" onClick={() => { setPlaying(false); go(step - 1); }} disabled={step === 0}>
                ‹
              </CtlButton>
              <CtlButton label={playing ? "Pause" : "Play"} onClick={togglePlay} primary>
                {playing ? "❚❚" : "▶"}
              </CtlButton>
              <CtlButton label="Next step" onClick={() => { setPlaying(false); go(step + 1); }} disabled={step === last}>
                ›
              </CtlButton>
              <div className="ml-2 min-w-0 flex-1">
                <div className="micro-label !text-[10px] text-[#f4efe6]/55">
                  Step {step + 1} of {steps.length}
                </div>
                <div className="truncate font-display text-[15px] font-bold text-[#f4efe6]">
                  {cur.title}
                </div>
              </div>
              <span className="hidden text-[10px] text-[#f4efe6]/40 sm:block">← → to step · space to play</span>
            </div>
          </div>
        )}
      </div>

      {/* side panel */}
      <aside className="flex flex-col border border-line-strong bg-paper lg:h-[min(80vh,780px)]">
        <div className="border-b border-line px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="micro-label text-faint">Step-by-step build</span>
            <span className="text-[13px] font-medium text-accent" dir="rtl">
              {artifact.hebrew}
            </span>
          </div>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight">{info.title}</h2>
        </div>

        <div className="grid grid-cols-3 border-b border-line text-center">
          <Stat k="Step" v={`${pad(step + 1)}/${pad(steps.length)}`} />
          <Stat
            k="Parts placed"
            v={counts ? `${counts.placed}` : "—"}
            sub={counts ? `of ${counts.total}` : undefined}
          />
          <Stat k="This step" v={counts ? `+${counts.added}` : "—"} sub="parts" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="micro-label text-accent">Step {pad(step + 1)}</div>
          <h3 className="mt-1 font-display text-xl font-extrabold leading-tight tracking-tight">
            {cur.title}
          </h3>
          {"measure" in cur && cur.measure && (
            <div className="mt-2 inline-block border border-line-strong px-2 py-0.5 text-[11px] font-semibold">
              {cur.measure}
            </div>
          )}
          <p className="mt-3 text-[14px] leading-relaxed text-foreground/85">{cur.description}</p>

          <div className="mt-4 space-y-3">
            {cur.verses.map((v) => (
              <blockquote key={v.ref} className="border-l-2 border-accent pl-3">
                <p className="font-serif text-[14px] italic leading-relaxed text-foreground/90">
                  “{v.text}”
                </p>
                <cite className="micro-label mt-1 block !text-[10px] not-italic text-faint">
                  {v.ref} · KJV
                </cite>
              </blockquote>
            ))}
          </div>

          {"interpretive" in cur && cur.interpretive && (
            <p className="mt-4 text-[11px] text-faint">
              <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                Interpretive
              </span>
              {cur.interpretive}
            </p>
          )}

          {counts && counts.fams.length > 0 && (
            <div className="mt-5 border-t border-line pt-3">
              <div className="micro-label mb-2 !text-[10px] text-faint">Materials placed</div>
              <div className="space-y-1.5">
                {counts.fams.map((f) => {
                  const n = counts.tally[f] ?? 0;
                  const of = counts.all[f];
                  return (
                    <div key={f} className="flex items-center gap-2 text-[12px]">
                      <span className="w-20 shrink-0">{f}</span>
                      <span className="relative h-1.5 flex-1 bg-line">
                        <span
                          className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-500"
                          style={{ width: `${(n / of) * 100}%` }}
                        />
                      </span>
                      <span className="w-14 shrink-0 text-right tabular-nums text-faint">
                        {n}/{of}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] text-faint">Counted in pieces, not weight.</p>
            </div>
          )}

          <details className="mt-5 border-t border-line pt-3 text-[13px]">
            <summary className="micro-label cursor-pointer !text-[10px] text-faint">
              Measurements · {artifact.refs.join(" · ")}
            </summary>
            <dl className="mt-2">
              {artifact.dims.map((d) => (
                <div key={d.label} className="flex items-baseline gap-3 border-t border-line py-1.5">
                  <dt className="micro-label !text-[10px] text-faint">{d.label}</dt>
                  <dd className="ml-auto text-right">
                    {d.cubits ?? <span className="text-faint">see note</span>}
                    {d.cubits && (d.unit ?? "cubits") !== "" && (
                      <span className="text-faint"> {d.unit ?? "cubits"}</span>
                    )}
                    {d.interpretive && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-accent">
                        interpretive
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </aside>
    </section>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="border-r border-line px-2 py-3 last:border-r-0">
      <div className="micro-label !text-[9px] text-faint">{k}</div>
      <div className="font-display text-xl font-extrabold tabular-nums">{v}</div>
      {sub && <div className="text-[10px] text-faint">{sub}</div>}
    </div>
  );
}

function CtlButton({
  children,
  label,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 shrink-0 place-items-center border text-[15px] leading-none transition-colors disabled:opacity-30 ${
        primary
          ? "border-[#e2b850] bg-[#e2b850] text-[#141210] hover:bg-[#f0c860]"
          : "border-[#f4efe6]/40 bg-[#141210]/60 text-[#f4efe6] hover:border-[#f4efe6]"
      }`}
    >
      {children}
    </button>
  );
}
