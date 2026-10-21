"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type PaddingOptions,
  type StyleSpecification,
} from "maplibre-gl";
import { JOURNEYS, journeyById, type Journey, type LngLat } from "@/data/journeys";
import { useJourneyStore } from "./store";
import {
  approxYear,
  cameraAt,
  markerAt,
  partialLine,
  pathOf,
  stopPose,
  type CameraPose,
} from "./geometry";
import styles from "./journeys.module.css";

setWorkerUrl("/journeys/maplibre-worker.mjs");

const ESRI_ATTRIBUTION =
  'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics, and the GIS User Community';
const TERRAIN_ATTRIBUTION =
  'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen Terrain Tiles</a> (SRTM, GMTED, ETOPO1)';
const TERRARIUM =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

const STYLE: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  sources: {
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: ESRI_ATTRIBUTION,
    },
    // terrain and hillshade each get their own DEM source (MapLibre advice)
    dem: {
      type: "raster-dem",
      tiles: [TERRARIUM],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 14,
      attribution: TERRAIN_ATTRIBUTION,
    },
    "dem-shade": {
      type: "raster-dem",
      tiles: [TERRARIUM],
      encoding: "terrarium",
      tileSize: 256,
      maxzoom: 14,
    },
  },
  layers: [
    { id: "space", type: "background", paint: { "background-color": "#07090d" } },
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      paint: {
        "raster-saturation": -0.12,
        "raster-contrast": 0.08,
        "raster-brightness-max": 0.94,
      },
    },
    {
      id: "hillshade",
      type: "hillshade",
      source: "dem-shade",
      paint: {
        "hillshade-exaggeration": 0.32,
        "hillshade-shadow-color": "#140d06",
        "hillshade-highlight-color": "#fff3d6",
        "hillshade-accent-color": "#3a2a18",
      },
    },
  ],
  terrain: { source: "dem", exaggeration: 1.5 },
  sky: {
    "sky-color": "#0c1626",
    "horizon-color": "#e9c98f",
    "fog-color": "#d8c4a0",
    "fog-ground-blend": 0.6,
    "horizon-fog-blend": 0.55,
    "sky-horizon-blend": 0.7,
    "atmosphere-blend": [
      "interpolate",
      ["linear"],
      ["zoom"],
      0, 1,
      6, 0.6,
      9, 0,
    ],
  },
};

type Line = { type: "Feature"; properties: Record<string, unknown>; geometry: { type: "LineString"; coordinates: LngLat[] } };
const line = (coordinates: LngLat[], properties: Record<string, unknown> = {}): Line => ({
  type: "Feature",
  properties,
  geometry: { type: "LineString", coordinates },
});
const collection = (features: Line[]) => ({ type: "FeatureCollection" as const, features });

function plannedRoute(j: Journey) {
  return collection(
    pathOf(j).segments.filter((s) => !s.jump).map((s) => line(s.pts)),
  );
}

function travelledRoute(j: Journey, t: number, reduced: boolean) {
  const segs = pathOf(j).segments;
  const features: Line[] = [];
  const done = reduced ? Math.round(t) : t;
  segs.forEach((seg, i) => {
    if (done <= i) return;
    const u = Math.min(1, done - i);
    const pts = u >= 1 ? seg.pts : partialLine(seg, 0.5 - Math.cos(Math.PI * u) / 2);
    features.push(line(pts, { jump: seg.jump }));
  });
  return collection(features);
}

const allRoutes = collection(
  JOURNEYS.flatMap((j) =>
    pathOf(j)
      .segments.filter((s) => !s.jump)
      .map((s) => line(s.pts, { id: j.id, color: j.color })),
  ),
);

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

type Props = { padding: PaddingOptions };

export default function JourneyMap({ padding }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);
  const paddingRef = useRef(padding);

  const journeyId = useJourneyStore((s) => s.journeyId);
  const focus = useJourneyStore((s) => s.focus);
  const reached = useJourneyStore((s) => Math.floor(s.t + 1e-6));
  const nearStop = useJourneyStore((s) => {
    const k = Math.round(s.t);
    return Math.abs(s.t - k) < 0.06 ? k : -1;
  });
  const journey = journeyById.get(journeyId)!;

  // DOM hosts for markers; React renders into them through portals
  const places = useMemo(
    () => placesOf(journey).map((p) => ({ ...p, el: document.createElement("div") })),
    [journey],
  );
  const labelEl = useMemo(() => document.createElement("div"), []);
  const travellerEl = useMemo(() => document.createElement("div"), []);

  /* ------------------------------- map setup ------------------------------ */
  useEffect(() => {
    const map = new MapLibreMap({
      container: containerRef.current!,
      style: STYLE,
      center: [38.5, 33.5],
      zoom: 3.2,
      pitch: 20,
      maxPitch: 72,
      attributionControl: false,
      fadeDuration: 150,
    });
    mapRef.current = map;
    map.addControl(new AttributionControl({ compact: true }), "bottom-right");
    map.addControl(
      new NavigationControl({ visualizePitch: true, showZoom: true }),
      "bottom-left",
    );
    map.on("load", () => {
      // compact attribution starts expanded; keep it to the (i) button
      containerRef.current
        ?.querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show");
      map.addSource("all-routes", { type: "geojson", data: allRoutes });
      map.addSource("route-plan", { type: "geojson", data: collection([]) });
      map.addSource("route-done", { type: "geojson", data: collection([]) });
      map.addLayer({
        id: "all-routes",
        type: "line",
        source: "all-routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 1.6, "line-opacity": 0.3 },
      });
      map.addLayer({
        id: "all-routes-hit",
        type: "line",
        source: "all-routes",
        paint: { "line-color": "#000", "line-width": 16, "line-opacity": 0 },
      });
      map.addLayer({
        id: "route-plan",
        type: "line",
        source: "route-plan",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#f4efe6",
          "line-width": 2,
          "line-opacity": 0.55,
          "line-dasharray": [1.5, 2],
        },
      });
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route-done",
        filter: ["!", ["get", "jump"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#d9b45a", "line-width": 12, "line-blur": 8, "line-opacity": 0.45 },
      });
      map.addLayer({
        id: "route-done",
        type: "line",
        source: "route-done",
        filter: ["!", ["get", "jump"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#d9b45a", "line-width": 3.4 },
      });
      map.addLayer({
        id: "route-jump",
        type: "line",
        source: "route-done",
        filter: ["get", "jump"],
        layout: { "line-cap": "round" },
        paint: {
          "line-color": "#f4efe6",
          "line-width": 1.6,
          "line-opacity": 0.6,
          "line-dasharray": [0.5, 3],
        },
      });
      map.on("click", "all-routes-hit", (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined;
        const s = useJourneyStore.getState();
        if (id && id !== s.journeyId) {
          s.setPlaying(false);
          s.select(id, 0);
        }
      });
      map.on("mouseenter", "all-routes-hit", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "all-routes-hit", () => (map.getCanvas().style.cursor = ""));
      setReady(true);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    paddingRef.current = padding;
    mapRef.current?.setPadding(padding);
  }, [padding]);

  /* ---------------------- camera, route and marker sync -------------------- */
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current!;
    const store = useJourneyStore;
    let userMoved = false;
    let flying = false;
    let lastStop = -1;

    const traveller = new Marker({ element: travellerEl, anchor: "center" })
      .setLngLat(markerAt(journeyById.get(store.getState().journeyId)!, 0))
      .addTo(map);

    const onMoveStart = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) userMoved = true;
    };
    map.on("movestart", onMoveStart);

    const pose = (j: Journey, t: number, reducedMotion: boolean): CameraPose =>
      reducedMotion ? stopPose(j, Math.round(t)) : cameraAt(j, t);

    let flight = 0;
    const flyTo = (p: CameraPose, reducedMotion: boolean, after?: () => void) => {
      const id = ++flight;
      map.stop(); // ends an earlier flight; its handler sees a stale id
      flying = true;
      userMoved = false;
      store.getState().setCameraBusy(true);
      map.once("moveend", () => {
        if (id !== flight) return;
        flying = false;
        store.getState().setCameraBusy(false);
        // re-sync to wherever playback/scrubbing got to, unless the user took over
        if (!userMoved) after?.();
      });
      map.flyTo({
        ...p,
        padding: paddingRef.current,
        duration: reducedMotion ? 0 : 2600,
        curve: 1.6,
      });
    };

    const sync = (journeyChanged: boolean, needFly = false) => {
      const { journeyId: id, t, focus: f, reducedMotion } = store.getState();
      const j = journeyById.get(id)!;
      if (journeyChanged) {
        (map.getSource("route-plan") as GeoJSONSource).setData(plannedRoute(j));
        map.setFilter("all-routes", ["!=", ["get", "id"], id]);
        map.setPaintProperty("route-glow", "line-color", j.color);
        map.setPaintProperty("route-done", "line-color", j.color);
      }
      (map.getSource("route-done") as GeoJSONSource).setData(
        travelledRoute(j, t, reducedMotion),
      );
      traveller.setLngLat(reducedMotion ? j.stops[Math.round(t)].coord : markerAt(j, t));
      if (f) return;

      const stop = Math.round(t);
      if (journeyChanged || needFly || userMoved) {
        lastStop = stop;
        flyTo(pose(j, t, reducedMotion), reducedMotion, () => sync(false));
      } else if (!flying) {
        if (reducedMotion) {
          if (stop !== lastStop) map.jumpTo(stopPose(j, stop));
        } else {
          map.jumpTo(cameraAt(j, t));
        }
        lastStop = stop;
      }
    };

    sync(true);
    const unsub = store.subscribe((s, prev) => {
      if (s.focus && s.focus !== prev.focus) {
        flyTo(
          { center: s.focus.coord, zoom: 9.2, pitch: 55, bearing: 0 },
          s.reducedMotion,
        );
        return;
      }
      if (s.journeyId !== prev.journeyId) sync(true);
      else if ((prev.focus && !s.focus) || s.flight !== prev.flight) sync(false, true);
      else if (s.t !== prev.t) sync(false);
    });
    return () => {
      unsub();
      map.off("movestart", onMoveStart);
      traveller.remove();
    };
  }, [ready, travellerEl]);

  /* ------------------------------ stop markers ----------------------------- */
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current!;
    const markers = places.map((p) =>
      new Marker({ element: p.el, anchor: "center" }).setLngLat(p.coord).addTo(map),
    );
    return () => markers.forEach((m) => m.remove());
  }, [ready, places]);

  // the cinematic label: at the stop we are standing on, or the focused event
  const labelAt: LngLat | null = focus
    ? focus.coord
    : nearStop >= 0
      ? journey.stops[nearStop].coord
      : null;
  useEffect(() => {
    if (!ready || !labelAt) return;
    const marker = new Marker({ element: labelEl, anchor: "bottom", offset: [0, 11] })
      .setLngLat(labelAt)
      .addTo(mapRef.current!);
    return () => {
      marker.remove();
    };
  }, [ready, labelEl, labelAt?.[0], labelAt?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastIndex = journey.stops.length - 1;
  const routeVar = { "--route": journey.color } as React.CSSProperties;
  const nextStop = journey.stops[Math.min(reached + 1, lastIndex)];

  return (
    <>
      {/* maplibre's own CSS makes its container position: relative */}
      <div
        className={`absolute inset-0 ${styles.map}`}
        style={{ "--dock": `${padding.bottom ?? 0}px` } as React.CSSProperties}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {places.map((p) =>
        createPortal(
          <button
            type="button"
            className={`${styles.stop} ${p.indices[0] <= reached ? styles.stopReached : ""}`}
            style={routeVar}
            onClick={() => {
              const s = useJourneyStore.getState();
              // jump to the visit of this place nearest to where we are
              const target = p.indices.reduce((best, i) =>
                Math.abs(i - s.t) < Math.abs(best - s.t) ? i : best,
              );
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
          {nearStop < 0 && !focus && (
            <span className={styles.travellerLabel}>→ {nextStop.name}</span>
          )}
        </div>,
        travellerEl,
      )}

      {createPortal(
        focus ? (
          <div className={styles.label} key={`event-${focus.id}`}>
            <div className={styles.card}>
              <div className={styles.eyebrow}>Event · {approxYear(focus.year)}</div>
              <div className={styles.title}>{focus.title}</div>
              <div className={styles.sub}>
                <b>{focus.place}</b>
                {focus.ref ? ` · ${focus.ref}` : ""}
              </div>
            </div>
            <div className={styles.stem} />
            <div className={styles.ring} />
          </div>
        ) : nearStop >= 0 ? (
          <div className={styles.label} key={`${journey.id}-${nearStop}`}>
            <div className={styles.card}>
              <div className={styles.eyebrow}>
                {journey.short} · {nearStop + 1} of {lastIndex + 1}
              </div>
              <div className={styles.title}>{journey.stops[nearStop].title}</div>
              <div className={styles.sub}>
                <b>{journey.stops[nearStop].name}</b>{" "}
                {nearStop === 0 ? "departs" : "arrives"} ·{" "}
                {approxYear(journey.stops[nearStop].year)}
              </div>
            </div>
            <div className={styles.stem} />
            <div className={styles.ring} />
          </div>
        ) : null,
        labelEl,
      )}
    </>
  );
}
