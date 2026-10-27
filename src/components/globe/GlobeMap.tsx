"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { journeyById, type Journey, type LngLat } from "@/data/journeys";
import { useJourneyStore } from "@/components/journeys/store";
import {
  cameraAt,
  markerAt,
  partialLine,
  pathOf,
  stopPose,
  type CameraPose,
} from "@/components/journeys/geometry";
import styles from "@/components/journeys/journeys.module.css";
import { useWorldStore, type CameraCommand } from "@/world/store";
import { GlobeMarker, GlobeStage, type LoadProgress, type Padding } from "./stage";
import { IMAGERY_CREDIT } from "./tiles";

/**
 * The journeys on the globe: routes along the land, the stops, the traveller
 * and the stop card, and a camera that follows the journey store (and the
 * world's camera requests).
 */

/** names of lands and seas, quietly, in the period's terms */
const REGIONS: { name: string; at: LngLat; sea?: boolean }[] = [
  { name: "The Great Sea", at: [20.5, 34.6], sea: true },
  { name: "Red Sea", at: [37.2, 23.6], sea: true },
  { name: "Persian Gulf", at: [51.0, 27.2], sea: true },
  { name: "Black Sea", at: [34.5, 43.2], sea: true },
  { name: "Egypt", at: [29.5, 26.5] },
  { name: "Canaan", at: [35.0, 31.0] },
  { name: "Mesopotamia", at: [43.6, 33.8] },
  { name: "Assyria", at: [43.4, 36.6] },
  { name: "Persia", at: [52.5, 31.0] },
  { name: "Anatolia", at: [33.0, 39.0] },
  { name: "Arabia", at: [42.0, 27.5] },
  { name: "Achaia", at: [22.0, 38.0] },
  { name: "Italia", at: [15.5, 41.0] },
  { name: "Urartu", at: [43.0, 39.6] },
];

function routeCoords(j: Journey): LngLat[][] {
  return pathOf(j)
    .segments.filter((s) => !s.jump)
    .map((s) => s.pts);
}

function travelled(j: Journey, t: number, reduced: boolean) {
  const done: LngLat[][] = [];
  const jumps: LngLat[][] = [];
  const upTo = reduced ? Math.round(t) : t;
  pathOf(j).segments.forEach((seg, i) => {
    if (upTo <= i) return;
    const u = Math.min(1, upTo - i);
    const pts = u >= 1 ? seg.pts : partialLine(seg, 0.5 - Math.cos(Math.PI * u) / 2);
    (seg.jump ? jumps : done).push(pts);
  });
  return { done, jumps };
}

/** unique places along a journey (Jerusalem appears once, not six times) */
function placesOf(j: Journey) {
  const byKey = new Map<string, { key: string; name: string; coord: LngLat; indices: number[] }>();
  j.stops.forEach((s, i) => {
    const key = `${s.coord[0].toFixed(3)},${s.coord[1].toFixed(3)}`;
    const hit = byKey.get(key);
    if (hit) hit.indices.push(i);
    else byKey.set(key, { key, name: s.name, coord: s.coord, indices: [i] });
  });
  return [...byKey.values()];
}

type Props = {
  padding: Padding;
  /** hands the stage to the world's other layers */
  onStage?: (stage: GlobeStage | null) => void;
};

export default function GlobeMap({ padding, onStage }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<GlobeStage | null>(null);
  const [progress, setProgress] = useState<LoadProgress>({ fraction: 0, phase: "map", sharpening: 0 });
  const onStageRef = useRef(onStage);
  const paddingRef = useRef(padding);
  /** the last world camera request flown, so a remount doesn't replay it */
  const cameraNonce = useRef(0);
  useEffect(() => {
    onStageRef.current = onStage;
  }, [onStage]);

  const journeyId = useJourneyStore((s) => s.journeyId);
  const focus = useJourneyStore((s) => s.focus);
  const reached = useJourneyStore((s) => Math.floor(s.t + 1e-6));
  const current = useJourneyStore((s) => Math.round(s.t));
  const nearStop = useJourneyStore((s) => {
    const k = Math.round(s.t);
    return Math.abs(s.t - k) < 0.06 ? k : -1;
  });
  const journey = journeyById.get(journeyId)!;

  const places = useMemo(
    () => placesOf(journey).map((p) => ({ ...p, el: document.createElement("div") })),
    [journey],
  );
  const labelEl = useMemo(() => document.createElement("div"), []);
  const travellerEl = useMemo(() => document.createElement("div"), []);

  /* ----------------------------------------------------------------- stage */
  useEffect(() => {
    const s = new GlobeStage(containerRef.current!);
    s.setPadding(paddingRef.current);
    setStage(s);
    onStageRef.current?.(s);
    // the quiet names of lands and seas, only while the view takes in a region
    const regions = REGIONS.map((r) => {
      const el = document.createElement("div");
      el.className = r.sea ? styles.regionSea : styles.region;
      el.textContent = r.name;
      el.style.transition = "opacity 400ms";
      return new GlobeMarker(el, { anchor: "center", interactive: false }).setLngLat(r.at).addTo(s);
    });
    let regionsOn: boolean | null = null;
    const offFrame = s.onFrame(() => {
      const z = s.getZoom();
      const on = z > 3.6 && z < 7.6;
      if (on === regionsOn) return;
      regionsOn = on;
      for (const m of regions) m.element.style.opacity = on ? "1" : "0";
    });
    return () => {
      offFrame();
      regions.forEach((m) => m.remove());
      onStageRef.current?.(null);
      s.dispose();
      setStage(null);
    };
  }, []);

  useEffect(() => {
    paddingRef.current = padding;
    stage?.setPadding(padding);
  }, [stage, padding]);

  useEffect(() => stage?.onProgress(setProgress), [stage]);

  /* ---------------------- camera, route and marker sync -------------------- */
  useEffect(() => {
    if (!stage) return;
    const store = useJourneyStore;
    let userMoved = false;
    let flying = false;
    let lastStop = -1;

    const traveller = new GlobeMarker(travellerEl, { anchor: "center", interactive: false })
      .setLngLat(markerAt(journeyById.get(store.getState().journeyId)!, 0))
      .addTo(stage);
    const offUserMove = stage.onUserMove(() => {
      userMoved = true;
      if (flying) {
        flying = false;
        store.getState().setCameraBusy(false);
      }
    });

    const pose = (j: Journey, t: number, reducedMotion: boolean): CameraPose =>
      reducedMotion ? stopPose(j, Math.round(t)) : cameraAt(j, t);

    const flyTo = (p: CameraPose, reducedMotion: boolean, after?: () => void) => {
      flying = true;
      userMoved = false;
      store.getState().setCameraBusy(true);
      stage.flyTo(p, {
        duration: reducedMotion ? 0 : 2600,
        onEnd: () => {
          if (!flying) return;
          flying = false;
          store.getState().setCameraBusy(false);
          // re-sync to wherever playback/scrubbing got to, unless the user took over
          if (!userMoved) after?.();
        },
      });
    };

    const drawRoute = (j: Journey, t: number, reducedMotion: boolean) => {
      const { done, jumps } = travelled(j, t, reducedMotion);
      stage.setLines("route-glow", done, { color: j.color, width: 10, opacity: 0.3 });
      stage.setLines("route-done", done, { color: j.color, width: 3.4 });
      stage.setLines("route-jump", jumps, { color: "#f4efe6", width: 1.6, opacity: 0.6, dashed: true, dash: [2, 10] });
    };

    const sync = (journeyChanged: boolean, needFly = false) => {
      const { journeyId: id, t, focus: f, reducedMotion } = store.getState();
      const j = journeyById.get(id)!;
      if (journeyChanged) {
        stage.setLines("route-plan", routeCoords(j), { color: "#f4efe6", width: 2, opacity: 0.55, dashed: true, dash: [6, 8] });
      }
      drawRoute(j, t, reducedMotion);
      traveller.setLngLat(reducedMotion ? j.stops[Math.round(t)].coord : markerAt(j, t));
      if (f) return;

      const stop = Math.round(t);
      if (journeyChanged || needFly || userMoved) {
        lastStop = stop;
        flyTo(pose(j, t, reducedMotion), reducedMotion, () => sync(false));
      } else if (!flying) {
        if (reducedMotion) {
          if (stop !== lastStop) stage.jumpTo(stopPose(j, stop));
        } else {
          stage.jumpTo(cameraAt(j, t));
        }
        lastStop = stop;
      }
    };

    sync(true);
    // lines are draped once the heights arrive
    void stage.ready.then(() => sync(false));
    const unsub = store.subscribe((s, prev) => {
      if (s.focus && s.focus !== prev.focus) {
        flyTo({ center: s.focus.coord, zoom: 9.2, pitch: 55, bearing: 0 }, s.reducedMotion);
        return;
      }
      if (s.journeyId !== prev.journeyId) sync(true);
      else if ((prev.focus && !s.focus) || s.flight !== prev.flight) sync(false, true);
      else if (s.t !== prev.t) sync(false);
    });
    // people, structures and story scenes ask for the camera through the world
    const flyToCommand = (c: CameraCommand) => {
      cameraNonce.current = c.nonce;
      const { center, zoom, pitch = 55, bearing = 0 } = c;
      flyTo({ center, zoom, pitch, bearing }, store.getState().reducedMotion);
    };
    const pending = useWorldStore.getState().camera;
    if (pending && pending.nonce !== cameraNonce.current) flyToCommand(pending);
    const unsubWorld = useWorldStore.subscribe((w, prev) => {
      if (w.camera && w.camera !== prev.camera) flyToCommand(w.camera);
      if (w.layers.journeys !== prev.layers.journeys) {
        for (const k of ["route-plan", "route-glow", "route-done", "route-jump"]) stage.setLinesVisible(k, w.layers.journeys);
      }
    });
    return () => {
      unsub();
      unsubWorld();
      offUserMove();
      traveller.remove();
    };
  }, [stage, travellerEl]);

  /* ------------------------------ stop markers ----------------------------- */
  useEffect(() => {
    if (!stage) return;
    const markers = places.map((p) => new GlobeMarker(p.el, { anchor: "center" }).setLngLat(p.coord).addTo(stage));
    void stage.ready.then(() => markers.forEach((m) => m.setLngLat(m.lngLat)));
    return () => markers.forEach((m) => m.remove());
  }, [stage, places]);

  // the cinematic label: at the stop we are standing on, or the focused event
  const labelAt: LngLat | null = focus ? focus.coord : nearStop >= 0 ? journey.stops[nearStop].coord : null;
  useEffect(() => {
    if (!stage || !labelAt) return;
    const marker = new GlobeMarker(labelEl, { anchor: "bottom", offset: [0, 11], interactive: false })
      .setLngLat(labelAt)
      .addTo(stage);
    return () => marker.remove();
  }, [stage, labelEl, labelAt?.[0], labelAt?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const routeVar = { "--route": journey.color } as React.CSSProperties;
  const btn =
    "flex h-8 w-8 items-center justify-center rounded-sm border border-white/15 bg-[#0d0b09]/75 text-white/80 backdrop-blur-md transition-colors hover:text-white";

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 bg-black" />

      {/* the first load: the sky's tables and the whole Earth at its coarsest */}
      <div
        className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black transition-opacity duration-1000 ${
          progress.phase === "ready" ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden={progress.phase === "ready"}
      >
        <div className="w-[min(320px,70vw)] text-center">
          <div className="micro-label text-[#d9b45a]">The world of the Bible</div>
          <div className="font-display mt-2 text-[22px] font-extrabold text-white">Bringing the world into view…</div>
          <div className="mt-5 h-[3px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-[#d9b45a] transition-[width] duration-200"
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>
          <div className="mt-2 text-[11px] tabular-nums text-white/45">
            {Math.round(progress.fraction * 100)}%
          </div>
        </div>
      </div>
      {/* zoom and north, above the dock */}
      <div
        className="absolute left-3 z-10 hidden flex-col gap-1 sm:flex"
        style={{ bottom: (padding.bottom ?? 0) + 12 }}
      >
        <button type="button" className={btn} onClick={() => stage?.zoomBy(0.6)} aria-label="Zoom in">
          +
        </button>
        <button type="button" className={btn} onClick={() => stage?.zoomBy(1 / 0.6)} aria-label="Zoom out">
          −
        </button>
        <button type="button" className={btn} onClick={() => stage?.resetNorth()} aria-label="North up">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
            <path d="M8 1 12 13 8 10.5 4 13Z" />
          </svg>
        </button>
      </div>
      <div
        className="pointer-events-none absolute right-3 z-10 hidden text-right text-[9.5px] leading-tight text-white/35 sm:block"
        style={{ bottom: (padding.bottom ?? 0) + 8 }}
      >
        {IMAGERY_CREDIT} · Terrain: Mapzen / AWS Terrain Tiles · Natural Earth
      </div>

      {places.map((p) =>
        createPortal(
          <button
            type="button"
            className={`${styles.stop} ${p.indices[0] <= reached ? styles.stopReached : ""} ${
              p.indices.includes(current) ? styles.stopCurrent : ""
            }`}
            style={routeVar}
            onClick={() => {
              const s = useJourneyStore.getState();
              // jump to the visit of this place nearest to where we are
              const target = p.indices.reduce((best, i) => (Math.abs(i - s.t) < Math.abs(best - s.t) ? i : best));
              s.goTo(target);
            }}
            aria-label={`Go to ${p.name}`}
          >
            <span className={styles.stopDot} />
            <span className={styles.stopName}>{p.name}</span>
          </button>,
          p.el,
          p.key,
        ),
      )}

      {createPortal(
        <div className={styles.traveller} style={routeVar}>
          <span className={styles.travellerDot} />
        </div>,
        travellerEl,
      )}

      {createPortal(
        // where you are: a ring on the place (the dock says what happened there); an event adds its name
        focus ? (
          <div className={styles.label} key={`event-${focus.id}`}>
            <div className={styles.chip}>
              <span style={{ color: "#d9b45a" }}>◆</span> {focus.title}
            </div>
            <div className={styles.ring} />
          </div>
        ) : nearStop >= 0 ? (
          <div className={styles.label} key={`${journey.id}-${nearStop}`}>
            <div className={styles.ring} />
          </div>
        ) : null,
        labelEl,
      )}
    </>
  );
}
