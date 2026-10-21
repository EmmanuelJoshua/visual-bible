"use client";

import { Fragment, useMemo } from "react";
import type { Blueprint, BlueprintEl, WalkStop } from "@/data/builds";

const INK = {
  white: "#e8eef9",
  gold: "#e2b850",
  faint: "rgba(232, 238, 249, 0.5)",
} as const;

/**
 * Navy drawing-sheet view of a build: white and gold linework, labels,
 * numbered stops. Elements up to the current step are inked; later ones
 * are ghosted so the whole plan is always readable.
 */
export function BlueprintView({
  bp,
  step,
  walk,
  activeStop,
  onStop,
}: {
  bp: Blueprint;
  step: number;
  walk?: readonly WalkStop[];
  activeStop: number | null;
  onStop?: (i: number) => void;
}) {
  const [vx, vy, vw, vh] = bp.viewBox;
  // longest side = 1000 drawing units, so text sizes are comparable across sheets
  const U = 1000 / Math.max(vw, vh);
  const X = (x: number) => (x - vx) * U;
  const Y = (y: number) => (y - vy) * U;
  const W = vw * U;
  const H = vh * U;
  const fs = (s = 14) => s * 1.45;

  const grid = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = [];
    const g = bp.grid;
    for (let x = Math.ceil(vx / g) * g; x <= vx + vw; x += g) {
      const major = Math.round(x / g) % 5 === 0;
      lines.push({ x1: X(x), y1: 0, x2: X(x), y2: H, major });
    }
    for (let y = Math.ceil(vy / g) * g; y <= vy + vh; y += g) {
      const major = Math.round(y / g) % 5 === 0;
      lines.push({ x1: 0, y1: Y(y), x2: W, y2: Y(y), major });
    }
    return lines;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bp]);

  const render = (el: BlueprintEl, i: number) => {
    const built = el.step <= step;
    const current = el.step === step;
    const tone = "tone" in el && el.tone ? el.tone : "white";
    const color = INK[tone];
    const opacity = built ? 1 : 0.13;
    const glow = current ? "url(#bp-glow)" : undefined;
    const common = {
      opacity,
      filter: glow,
      style: { transition: "opacity 400ms ease" },
    };
    switch (el.kind) {
      case "rect":
        return (
          <rect
            key={i}
            x={X(el.x)}
            y={Y(el.y)}
            width={el.w * U}
            height={el.h * U}
            fill={el.fill ? color : "none"}
            fillOpacity={el.fill ? (tone === "gold" ? 0.32 : 0.22) : 0}
            stroke={current ? INK.gold : color}
            strokeWidth={1.4}
            strokeDasharray={el.dashed ? "6 5" : undefined}
            vectorEffect="non-scaling-stroke"
            {...common}
          />
        );
      case "circle":
        return (
          <circle
            key={i}
            cx={X(el.cx)}
            cy={Y(el.cy)}
            r={el.r * U}
            fill={el.fill ? color : "none"}
            fillOpacity={el.fill ? 0.4 : 0}
            stroke={current ? INK.gold : color}
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
            {...common}
          />
        );
      case "line":
        return (
          <polyline
            key={i}
            points={el.pts.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ")}
            fill="none"
            stroke={current ? INK.gold : color}
            strokeWidth={el.width ?? 1.2}
            strokeDasharray={el.dashed ? "7 6" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            {...common}
          />
        );
      case "text":
        return (
          <text
            key={i}
            x={X(el.x)}
            y={Y(el.y)}
            fill={color}
            fontSize={fs(el.size)}
            textAnchor={el.anchor ?? "middle"}
            dominantBaseline="middle"
            fontStyle={el.italic ? "italic" : undefined}
            fontWeight={el.italic ? 400 : 700}
            letterSpacing={el.italic ? 0 : "0.14em"}
            transform={el.rotate ? `rotate(${el.rotate} ${X(el.x)} ${Y(el.y)})` : undefined}
            className="font-display"
            {...common}
          >
            {el.text}
          </text>
        );
      case "dim": {
        const [ax, ay] = el.a;
        const [bx, by] = el.b;
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const nx = -(by - ay) / len;
        const ny = (bx - ax) / len;
        const o = el.offset ?? 4;
        const p1 = [X(ax + nx * o), Y(ay + ny * o)];
        const p2 = [X(bx + nx * o), Y(by + ny * o)];
        const tick = 6;
        const tx = nx * tick;
        const ty = ny * tick;
        const mx = (p1[0] + p2[0]) / 2;
        const my = (p1[1] + p2[1]) / 2;
        const vertical = Math.abs(bx - ax) < Math.abs(by - ay);
        return (
          <g key={i} {...common} stroke={INK.faint} fill="none">
            <line x1={X(ax)} y1={Y(ay)} x2={p1[0]} y2={p1[1]} strokeWidth={0.8} strokeDasharray="2 3" />
            <line x1={X(bx)} y1={Y(by)} x2={p2[0]} y2={p2[1]} strokeWidth={0.8} strokeDasharray="2 3" />
            <line x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} strokeWidth={1} />
            <line x1={p1[0] - tx} y1={p1[1] - ty} x2={p1[0] + tx} y2={p1[1] + ty} strokeWidth={1.2} />
            <line x1={p2[0] - tx} y1={p2[1] - ty} x2={p2[0] + tx} y2={p2[1] + ty} strokeWidth={1.2} />
            <text
              x={mx}
              y={my}
              fill={INK.white}
              stroke="#0e1d3a"
              strokeWidth={5}
              paintOrder="stroke"
              fontSize={fs(12)}
              textAnchor="middle"
              dominantBaseline="middle"
              transform={vertical ? `rotate(-90 ${mx} ${my})` : undefined}
              className="font-display"
              fontWeight={600}
            >
              {el.text}
            </text>
          </g>
        );
      }
    }
  };

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 40%, #16305e 0%, #0e1d3a 62%, #0a1530 100%)",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-x-0 bottom-[92px] top-12 h-[calc(100%-140px)] w-full px-4 sm:px-8"
        role="img"
        aria-label={`${bp.title} — ${bp.view}`}
      >
        <defs>
          <filter id="bp-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g>
          {grid.map(({ major, ...l }, i) => (
            <line
              key={i}
              {...l}
              stroke="#cfe0ff"
              strokeOpacity={major ? 0.14 : 0.06}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g>{bp.els.map(render)}</g>
        {walk && (
          <g>
            {walk.map((w, i) => {
              const cx = X(w.plan[0]);
              const cy = Y(w.plan[1]);
              const on = activeStop === i;
              return (
                <g
                  key={w.n}
                  onClick={() => onStop?.(i)}
                  className="cursor-pointer"
                  role="button"
                  aria-label={`Walk to stop ${w.n}: ${w.name}`}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={fs(11)}
                    fill={on ? INK.gold : "#0e1d3a"}
                    stroke={INK.gold}
                    strokeWidth={1.6}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={cx}
                    y={cy}
                    fill={on ? "#0e1d3a" : INK.gold}
                    fontSize={fs(12)}
                    fontWeight={800}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-display"
                  >
                    {w.n}
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute right-4 top-16 flex items-center gap-2 sm:right-6">
        {bp.up && (
          <div className="flex flex-col items-center text-[#e2b850]">
            <span className="text-[10px] font-bold tracking-[0.2em]">{bp.up}</span>
            <svg width="12" height="22" viewBox="0 0 12 22" aria-hidden>
              <path d="M6 0 L12 12 L6 9 L0 12 Z" fill="currentColor" />
              <line x1="6" y1="9" x2="6" y2="22" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </div>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-[100px] right-4 border border-[#e8eef9]/40 bg-[#0e1d3a]/80 px-3 py-2 text-right sm:right-6">
        <div className="font-display text-[13px] font-extrabold tracking-[0.16em] text-[#e8eef9]">
          {bp.title}
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#e2b850]">
          {bp.view}
        </div>
        <div className="mt-0.5 text-[10px] text-[#e8eef9]/60">{bp.subtitle}</div>
      </div>

      {walk && (
        <ol className="absolute left-4 top-16 hidden max-w-[220px] space-y-1 border border-[#e8eef9]/25 bg-[#0e1d3a]/80 p-3 text-[11px] text-[#e8eef9]/80 md:block">
          <li className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#e2b850]">
            Walk-through
          </li>
          {walk.map((w, i) => (
            <Fragment key={w.n}>
              <li>
                <button
                  onClick={() => onStop?.(i)}
                  className={`flex w-full gap-2 text-left hover:text-white ${
                    activeStop === i ? "text-[#e2b850]" : ""
                  }`}
                >
                  <span className="w-3 shrink-0 font-bold">{w.n}</span>
                  <span>{w.name}</span>
                </button>
              </li>
            </Fragment>
          ))}
        </ol>
      )}
    </div>
  );
}
