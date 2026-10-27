"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { allEvents, getPersonSync, loadAllPeople, messianicSet } from "@/data";
import { artifactById } from "@/data/artifacts";
import { eraForYear } from "@/data/eras";
import { journeyById, type LngLat } from "@/data/journeys";
import { useJourneyStore } from "@/components/journeys/store";
import { focusFor } from "@/components/journeys/TimelineStrip";
import { presenceAt, type Presence } from "@/world/presence";
import { structuresAt, type StructureAt } from "@/world/structures";
import { DioramaModels } from "@/components/diorama/models";
import { DioramaMarker, type DioramaStage } from "@/components/diorama/stage";
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

function PeopleLayer({ stage }: { stage: DioramaStage }) {
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
      new DioramaMarker(g.el, { anchor: "right", offset: [-16, 0] }).setLngLat(g.coord).addTo(stage),
    );
    return () => markers.forEach((m) => m.remove());
  }, [stage, groups]);

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

function StructuresLayer({ stage }: { stage: DioramaStage }) {
  const year = useWholeYear();
  const selected = useWorldStore((s) => (s.selection?.kind === "structure" ? s.selection.id : null));
  const standing = standingOnMap(year);
  const signature = standing.map((s) => `${s.placement.id}@${s.site.place}`).join("|");
  const items = useMemo(
    () => standing.map((s) => ({ ...s, el: document.createElement("div") })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );

  useEffect(() => {
    const markers = items.map((s) =>
      // under the model, as a museum label sits under the piece
      new DioramaMarker(s.el, { anchor: "top", offset: [0, 22] }).setLngLat(s.site.coord).addTo(stage),
    );
    return () => markers.forEach((m) => m.remove());
  }, [stage, items]);

  return (
    <>
      {items.map((s) => {
        // progress changes every year; read it fresh rather than from the memo
        const now = standing.find((x) => x.placement.id === s.placement.id) ?? s;
        return createPortal(
          <StructureMarker at={now} on={selected === s.placement.id} />,
          s.el,
          s.placement.id,
        );
      })}
    </>
  );
}

function StructureMarker({ at, on }: { at: StructureAt; on: boolean }) {
  const art = artifactById.get(at.placement.id)!;
  const building = at.site.building && at.progress < 1;
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
      {/* close up the model itself marks the place; this is its name plate */}
      <span className={styles.structureName}>
        {art.name}
        <span className={styles.structureSub}>
          {building ? `Being built · ${Math.round(at.progress * 100)}%` : at.site.place}
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
function StructureModels({ stage }: { stage: DioramaStage }) {
  const year = useWholeYear();
  const [models, setModels] = useState<DioramaModels | null>(null);

  useEffect(() => {
    const m = new DioramaModels(stage);
    const offFrame = stage.onFrame(() => m.tick());
    // the models live with the stage; React only needs a handle to feed them the year
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModels(m);
    return () => {
      offFrame();
      m.dispose();
      setModels(null);
    };
  }, [stage]);

  useEffect(() => {
    models?.setStructures(
      standingOnMap(year).map((s) => ({
        id: s.placement.id,
        coord: s.site.coord,
        progress: s.progress,
        resting: s.site.resting,
      })),
    );
  }, [models, year]);

  return null;
}

/* --------------------------------- events --------------------------------- */

const LOCATED = allEvents.filter((e) => focusFor(e));

/** located events close to the year, as glowing dots */
function EventsLayer({ stage }: { stage: DioramaStage }) {
  const year = useWholeYear();
  const focusId = useJourneyStore((s) => s.focus?.id);
  const era = eraForYear(year);
  // a window proportional to the era, so sparse ages still show something
  const span = Math.max(3, (era.endYear - era.startYear) * 0.06);
  const near = LOCATED.filter((e) => Math.abs(e.startYear - year) <= span);
  const signature = near.map((e) => e.id).join("|");
  const items = useMemo(
    () => near.map((e) => ({ e, el: document.createElement("div") })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );

  useEffect(() => {
    const markers = items.map(({ e, el }) =>
      new DioramaMarker(el, { anchor: "center" }).setLngLat(focusFor(e)!.coord).addTo(stage),
    );
    return () => markers.forEach((m) => m.remove());
  }, [stage, items]);

  return (
    <>
      {items.map(({ e, el }) =>
        createPortal(
          <button
            type="button"
            className={`${styles.event} ${focusId === e.id ? styles.eventOn : ""}`}
            title={`${e.title} · ${focusFor(e)!.place}`}
            aria-label={`${e.title}, ${focusFor(e)!.place}`}
            onClick={(ev) => {
              ev.stopPropagation();
              useJourneyStore.getState().setFocus(focusFor(e));
            }}
          />,
          el,
          e.id,
        ),
      )}
    </>
  );
}

/* --------------------------------- layers --------------------------------- */

export function WorldLayers({ stage }: { stage: DioramaStage }) {
  const layers = useWorldStore((s) => s.layers);
  return (
    <>
      {layers.events && <EventsLayer stage={stage} />}
      {layers.people && <PeopleLayer stage={stage} />}
      {layers.structures && <StructuresLayer stage={stage} />}
      {layers.structures && <StructureModels stage={stage} />}
    </>
  );
}
