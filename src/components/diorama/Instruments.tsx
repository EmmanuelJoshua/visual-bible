"use client";

import { useEffect, useRef } from "react";
import type { DioramaStage, Padding } from "./stage";

/**
 * A quiet instrument readout over the model, as on a camera's screen: crop
 * marks at the corners, and where the lens points — the place, how much
 * land is in the frame, which way it faces. Written straight into the DOM
 * each frame, never through React.
 */
export function Instruments({ stage, padding }: { stage: DioramaStage; padding: Padding }) {
  const readout = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let last = "";
    return stage.onFrame(() => {
      const el = readout.current;
      if (!el) return;
      const t = stage.controls.target;
      const [lng, lat] = stage.lngLatOf(t);
      const dist = stage.camera.position.distanceTo(t);
      const field = (2 * dist * Math.tan((stage.camera.fov * Math.PI) / 360) * stage.camera.aspect);
      const off = stage.camera.position.clone().sub(t);
      const heading = ((Math.atan2(-off.x, off.z) * 180) / Math.PI + 360) % 360;
      const text =
        `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}  ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? "E" : "W"}` +
        `   ·   FIELD ${field >= 100 ? Math.round(field / 10) * 10 : Math.round(field)} KM   ·   HDG ${String(Math.round(heading) % 360).padStart(3, "0")}°`;
      if (text !== last) {
        el.textContent = text;
        last = text;
      }
    });
  }, [stage]);

  const mark = "pointer-events-none absolute h-3.5 w-3.5 border-white/30";
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]" aria-hidden>
      <div
        className="absolute inset-x-4"
        style={{ top: (padding.top ?? 0) + 4, bottom: (padding.bottom ?? 0) + 4 }}
      >
        <span className={`${mark} left-0 top-0 border-l border-t`} />
        <span className={`${mark} right-0 top-0 border-r border-t`} />
        <span className={`${mark} bottom-0 left-0 border-b border-l`} />
        <span className={`${mark} bottom-0 right-0 border-b border-r`} />
      </div>
      <div
        ref={readout}
        className="absolute right-5 hidden whitespace-pre font-mono text-[10px] tracking-[0.14em] text-white/40 sm:block"
        style={{ top: (padding.top ?? 0) + 12 }}
      />
    </div>
  );
}
