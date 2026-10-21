"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";

export type SceneKind =
  | "nebula"
  | "storm"
  | "horizon"
  | "embers"
  | "drift"
  | "constellation"
  | "tree";

/**
 * Every ThreeUI component is a self-contained iframe scene; each entry is
 * dynamically imported so a scene's ~100-200 KB only loads when it is about
 * to be shown.
 */
const SCENES: Record<SceneKind, ComponentType<Record<string, unknown>>> = {
  nebula: dynamic(
    () =>
      import("@designcodeio/threeui/components/NebulaBackground").then(
        (m) => m.NebulaBackground,
      ),
    { ssr: false },
  ),
  storm: dynamic(
    () =>
      import("@designcodeio/threeui/components/ElementsBackground").then(
        (m) => m.ElementsBackground,
      ),
    { ssr: false },
  ),
  horizon: dynamic(
    () =>
      import("@designcodeio/threeui/components/EmeraldHorizonBackground").then(
        (m) => m.EmeraldHorizonBackground,
      ),
    { ssr: false },
  ),
  embers: dynamic(
    () =>
      import("@designcodeio/threeui/components/EmberStorm").then(
        (m) => m.EmberStorm,
      ),
    { ssr: false },
  ),
  drift: dynamic(
    () =>
      import("@designcodeio/threeui/components/ParticleDrift").then(
        (m) => m.ParticleDrift,
      ),
    { ssr: false },
  ),
  constellation: dynamic(
    () =>
      import("@designcodeio/threeui/components/ConstellationField").then(
        (m) => m.ConstellationField,
      ),
    { ssr: false },
  ),
  tree: dynamic(
    () =>
      import("@designcodeio/threeui/components/GenerativeTree").then(
        (m) => m.GenerativeTree,
      ),
    { ssr: false },
  ),
};

/** per-scene props tuned for the dark ink panels these scenes render inside */
const SCENE_PROPS: Record<SceneKind, Record<string, unknown>> = {
  nebula: { mode: "dark", speed: 0.6 },
  storm: { variant: "lightning", speed: 0.7, opacity: 0.9 },
  horizon: { hue: -95, glow: 0.8, speed: 0.6 }, // shift emerald toward warm gold
  embers: { mode: "dark", speed: 0.7 },
  drift: { mode: "dark", speed: 0.6, opacity: 0.9 },
  constellation: { mode: "dark", speed: 0.5, opacity: 0.9 },
  tree: { speed: 0.9, particleAmount: 0.8 },
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

export function ThreeUIScene({
  kind,
  className = "",
  opacity = 1,
  interactive = false,
}: {
  kind: SceneKind;
  className?: string;
  opacity?: number;
  /** leave pointer events on for pointer-reactive scenes (e.g. hero tree) */
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // static-gradient fallback for reduced motion (and during SSR)
  const allowed = useSyncExternalStore(
    subscribeToReducedMotion,
    () => !window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );

  useEffect(() => {
    if (!allowed || !ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "300px 0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [allowed]);

  const Scene = SCENES[kind];

  return (
    <div
      ref={ref}
      aria-hidden
      className={`absolute inset-0 overflow-hidden ${
        interactive ? "" : "pointer-events-none"
      } ${className}`}
    >
      {allowed && visible && (
        <div
          className="absolute inset-0 animate-[fadeIn_1.6s_ease_forwards] opacity-0"
          style={{
            opacity: undefined,
            // blend the iframe's own dark stage into the page background
            maskImage:
              "radial-gradient(ellipse 95% 90% at 50% 45%, black 55%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 95% 90% at 50% 45%, black 55%, transparent 100%)",
          }}
        >
          <Scene
            {...SCENE_PROPS[kind]}
            className="h-full w-full"
            style={{ width: "100%", height: "100%", opacity }}
          />
        </div>
      )}
    </div>
  );
}
