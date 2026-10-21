"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Marker, type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import { allEvents, getPersonSync, loadAllPeople, messianicSet } from "@/data";
import { artifactById, type ArtifactId } from "@/data/artifacts";
import { eraForYear } from "@/data/eras";
import { journeyById, type LngLat } from "@/data/journeys";
import { useJourneyStore } from "@/components/journeys/store";
import { focusFor } from "@/components/journeys/TimelineStrip";
import { presenceAt, type Presence } from "@/world/presence";
import { structuresAt, type StructureAt } from "@/world/structures";
import { enlargement, MODELS_MIN_ZOOM, StructureModelLayer } from "./modelLayer";
import { showPerson, showStructure } from "@/world/actions";
import { useWorldStore } from "@/world/store";
import styles from "./world.module.css";

/** the year, quantised so markers don't re-render every animation frame */
function useWholeYear() {
  return useWorldStore((s) => Math.round(s.year));
}

const keyOf = (c: LngLat) => `${c[0].toFixed(3)},${c[1].toFixed(3)}`;

function initials(name: string) {
  const words = name.replace(/[()]/g, "").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

function nameOf(slug: string) {
  return getPersonSync(slug)?.name ?? slug.replace(/_\d+$/, "").replace(/_/g, " ");
}

/* --------------------------------- people --------------------------------- */

type Group = { key: string; coord: LngLat; people: Presence[]; el: HTMLDivElement };

function PeopleLayer({ map }: { map: MapLibreMap }) {
  const year = useWholeYear();
  const selected = useWorldStore((s) => (s.selection?.kind === "person" ? s.selection.slug : null));
  const travellers = useJourneyStore((s) => journeyById.get(s.journeyId)!.people);
  const [, setLoaded] = useState(0);
  // names and lifespans of people outside the curated core
  useEffect(() => {
    void loadAllPeople().then(() => setLoaded((n) => n + 1));
  }, []);

  const journeyId = useJourneyStore((s) => s.journeyId);
  const stop = useJourneyStore((s) => Math.floor(s.t + 1e-6));
  const presence = presenceAt(year, { journeyId, stop });
  const signature = presence.map((p) => `${p.slug}@${keyOf(p.coord)}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => groupByPlace(presence), [signature]);

  useEffect(() => {
    const markers = groups.map((g) =>
      // left of the point: the stop's name sits to its right, its card above
      new Marker({ element: g.el, anchor: "right", offset: [-16, 0] }).setLngLat(g.coord).addTo(map),
    );
    return () => markers.forEach((m) => m.remove());
  }, [map, groups]);

  return (
    <>
      {groups.map((g) =>
        createPortal(
          <PeopleMarker group={g} selected={selected} travellers={travellers} />,
          g.el,
          g.key,
        ),
      )}
    </>
  );
}

function groupByPlace(presence: Presence[]): Group[] {
  const byKey = new Map<string, Group>();
  for (const p of presence) {
    const key = keyOf(p.coord);
    const g = byKey.get(key) ?? { key, coord: p.coord, people: [], el: document.createElement("div") };
    g.people.push(p);
    byKey.set(key, g);
  }
  // best-known people first
  for (const g of byKey.values())
    g.people.sort(
      (a, b) => (getPersonSync(b.slug)?.verseCount ?? 0) - (getPersonSync(a.slug)?.verseCount ?? 0),
    );
  return [...byKey.values()];
}

const MAX_AVATARS = 4;

function PeopleMarker({
  group,
  selected,
  travellers,
}: {
  group: Group;
  selected: string | null;
  travellers: string[];
}) {
  const shown = group.people.slice(0, MAX_AVATARS);
  const extra = group.people.length - shown.length;
  const lead = shown[0];
  return (
    <div className={styles.people}>
      <div className={styles.avatars}>
        {shown.map((p) => {
          const ring = messianicSet.has(p.slug)
            ? "#e0533f"
            : (journeyById.get(p.journeyId)?.color ?? "#f4efe6");
          const on = p.slug === selected || travellers.includes(p.slug);
          return (
            <button
              key={p.slug}
              type="button"
              className={`${styles.avatar} ${on ? styles.avatarOn : ""}`}
              style={{ "--ring": ring } as React.CSSProperties}
              title={`${nameOf(p.slug)} · ${p.place}`}
              aria-label={`${nameOf(p.slug)}, at ${p.place}`}
              onClick={(e) => {
                e.stopPropagation();
                showPerson(p.slug);
              }}
            >
              {initials(nameOf(p.slug))}
            </button>
          );
        })}
        {extra > 0 && <span className={styles.more}>+{extra}</span>}
      </div>
      <span className={styles.peopleName}>
        {nameOf(lead.slug)}
        {group.people.length > 1 ? ` & ${group.people.length - 1}` : ""}
      </span>
    </div>
  );
}

/* ------------------------------- structures ------------------------------- */

function StructureGlyph({ id }: { id: ArtifactId }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinejoin: "round" as const,
  };
  if (id === "noahs-ark")
    return (
      <svg {...common} aria-hidden>
        <path d="M1.5 9h13l-1.6 3.5H3.1zM4 9V5.5h8V9M6.5 5.5V3.5h3v2" />
      </svg>
    );
  if (id === "tabernacle")
    return (
      <svg {...common} aria-hidden>
        <path d="M1.5 13h13M3 13V7l5-3.5L13 7v6M6.5 13V9.5h3V13" />
      </svg>
    );
  if (id === "ark")
    return (
      <svg {...common} aria-hidden>
        <path d="M3 7.5h10v5H3zM2.5 7.5h11M5 7.5 4 4.5M11 7.5l1-3M1 10h14" />
      </svg>
    );
  return (
    <svg {...common} aria-hidden>
      <path d="M1.5 13.5h13M3 13.5V6h10v7.5M2 6l6-3.5L14 6M5.5 13.5V9M10.5 13.5V9" />
    </svg>
  );
}

function StructuresLayer({ map }: { map: MapLibreMap }) {
  const year = useWholeYear();
  const zoom = useZoom(map);
  const modelsShown = zoom >= MODELS_MIN_ZOOM;
  const selected = useWorldStore((s) => (s.selection?.kind === "structure" ? s.selection.id : null));
  const standing = standingOnMap(year);
  const signature = standing.map((s) => `${s.placement.id}@${s.site.place}`).join("|");
  const items = useMemo(
    () => standing.map((s) => ({ ...s, el: document.createElement("div") })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );

  useEffect(() => {
    const seen = new Map<string, number>();
    const markers = items.map((s) => {
      // below the point, clear of the stop card and the people beside it;
      // structures sharing a site (the ark inside the tabernacle) stack downwards
      const key = keyOf(s.site.coord);
      const nth = seen.get(key) ?? 0;
      seen.set(key, nth + 1);
      // with the 3D model drawn at the site, the label sits below it
      const below = modelsShown ? 95 : 16;
      return new Marker({ element: s.el, anchor: "top", offset: [0, below + nth * 74] })
        .setLngLat(s.site.coord)
        .addTo(map);
    });
    return () => markers.forEach((m) => m.remove());
  }, [map, items, modelsShown]);

  return (
    <>
      {items.map((s) => {
        // progress changes every year; read it fresh rather than from the memo
        const now = standing.find((x) => x.placement.id === s.placement.id) ?? s;
        const k = modelsShown ? enlargement(SPANS[s.placement.id] ?? 50, s.site.coord[1], zoom) : 1;
        return createPortal(
          <StructureMarker at={now} on={selected === s.placement.id} near={modelsShown} enlarged={k} />,
          s.el,
          s.placement.id,
        );
      })}
    </>
  );
}

/** rough footprints in cubits, for the "drawn larger" note under each model */
const SPANS: Partial<Record<ArtifactId, number>> = {
  temple: 160,
  tabernacle: 100,
  "noahs-ark": 300,
  ark: 4,
};

function StructureMarker({
  at,
  on,
  near,
  enlarged,
}: {
  at: StructureAt;
  on: boolean;
  /** the 3D model is drawn at the site: just the label */
  near: boolean;
  enlarged: number;
}) {
  const art = artifactById.get(at.placement.id)!;
  const building = at.site.building && at.progress < 1;
  const scaleNote = near && enlarged > 1.5 ? ` · drawn ×${Math.round(enlarged)}` : "";
  return (
    <button
      type="button"
      className={`${styles.structure} ${on ? styles.structureOn : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        showStructure(at.placement.id);
      }}
      aria-label={`${art.name} at ${at.site.place}`}
    >
      {!near && (
        <span className={styles.structurePin}>
          <StructureGlyph id={at.placement.id} />
        </span>
      )}
      <span className={styles.structureName}>
        {art.name}
        <span className={styles.structureSub}>
          {building ? `Being built · ${Math.round(at.progress * 100)}%` : at.site.place}
          {scaleNote}
        </span>
        {building && (
          <span className={styles.progress}>
            <span style={{ width: `${at.progress * 100}%` }} />
          </span>
        )}
      </span>
    </button>
  );
}

/* ------------------------------ 3D structures ----------------------------- */

/**
 * What stands this year, less the ark wherever it rests inside the tabernacle
 * or the temple: it is drawn (and found) inside them there.
 */
function standingOnMap(year: number) {
  const standing = structuresAt(year);
  const homes = new Set(standing.filter((s) => s.placement.id !== "ark").map((s) => keyOf(s.site.coord)));
  return standing.filter((s) => !(s.placement.id === "ark" && homes.has(keyOf(s.site.coord))));
}

/** the builds' 3D models, standing at their sites in the year */
function StructureModels({ map }: { map: MapLibreMap }) {
  const year = useWholeYear();
  const [layer] = useState(() => new StructureModelLayer());

  useEffect(() => {
    map.addLayer(layer);
    return () => {
      if (map.getStyle() && map.getLayer(layer.id)) map.removeLayer(layer.id);
    };
  }, [map, layer]);

  useEffect(() => {
    layer.setStructures(
      standingOnMap(year).map((s) => ({ id: s.placement.id, coord: s.site.coord, progress: s.progress })),
    );
  }, [layer, year]);

  return null;
}

/** the map's zoom, quantised, for things drawn differently up close */
function useZoom(map: MapLibreMap) {
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const on = () => setZoom(Math.round(map.getZoom() * 4) / 4);
    map.on("zoom", on);
    return () => {
      map.off("zoom", on);
    };
  }, [map]);
  return zoom;
}

/* --------------------------------- events --------------------------------- */

const LOCATED = allEvents.filter((e) => focusFor(e));

/** located events close to the year, as glowing dots */
function EventsLayer({ map }: { map: MapLibreMap }) {
  const year = useWholeYear();

  useEffect(() => {
    map.addSource("world-events", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "world-events-glow",
      type: "circle",
      source: "world-events",
      paint: { "circle-radius": 11, "circle-color": "#d9b45a", "circle-opacity": 0.18, "circle-blur": 0.8 },
    });
    map.addLayer({
      id: "world-events",
      type: "circle",
      source: "world-events",
      paint: {
        "circle-radius": 4.5,
        "circle-color": "#f4efe6",
        "circle-stroke-color": "#d9b45a",
        "circle-stroke-width": 2,
      },
    });
    const onClick = (e: { features?: { properties: Record<string, unknown> }[] }) => {
      const id = e.features?.[0]?.properties.id as string | undefined;
      const ev = LOCATED.find((x) => x.id === id);
      const f = ev && focusFor(ev);
      if (f) useJourneyStore.getState().setFocus(f);
    };
    const enter = () => (map.getCanvas().style.cursor = "pointer");
    const leave = () => (map.getCanvas().style.cursor = "");
    map.on("click", "world-events", onClick);
    map.on("mouseenter", "world-events", enter);
    map.on("mouseleave", "world-events", leave);
    return () => {
      map.off("click", "world-events", onClick);
      map.off("mouseenter", "world-events", enter);
      map.off("mouseleave", "world-events", leave);
      if (!map.getStyle()) return;
      map.removeLayer("world-events");
      map.removeLayer("world-events-glow");
      map.removeSource("world-events");
    };
  }, [map]);

  useEffect(() => {
    const era = eraForYear(year);
    // a window proportional to the era, so sparse ages still show something
    const span = Math.max(3, (era.endYear - era.startYear) * 0.06);
    const features = LOCATED.filter((e) => Math.abs(e.startYear - year) <= span).map((e) => {
      const f = focusFor(e)!;
      return {
        type: "Feature" as const,
        properties: { id: e.id, title: e.title },
        geometry: { type: "Point" as const, coordinates: f.coord },
      };
    });
    (map.getSource("world-events") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features,
    });
  }, [map, year]);

  return null;
}

/* --------------------------------- layers --------------------------------- */

export function WorldLayers({ map }: { map: MapLibreMap }) {
  const layers = useWorldStore((s) => s.layers);

  // the journey routes are drawn by the journey map; toggling only hides them
  useEffect(() => {
    const v = layers.journeys ? "visible" : "none";
    for (const id of ["all-routes", "all-routes-hit", "route-plan", "route-glow", "route-done", "route-jump"])
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
  }, [map, layers.journeys]);

  return (
    <>
      {layers.events && <EventsLayer map={map} />}
      {layers.people && <PeopleLayer map={map} />}
      {layers.structures && <StructuresLayer map={map} />}
      {layers.structures && <StructureModels map={map} />}
    </>
  );
}
