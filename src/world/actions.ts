"use client";

import { corePersonBySlug } from "@/data";
import type { ArtifactId } from "@/data/artifacts";
import { BUILDS } from "@/data/builds";
import { revealAndSelect } from "@/lib/reveal";
import { useExplorerStore } from "@/store/useExplorerStore";
import { useJourneyStore } from "@/components/journeys/store";
import { journeyForYear } from "@/components/journeys/TimelineStrip";
import { tForYear } from "@/components/journeys/geometry";
import { presenceAt } from "./presence";
import { siteNear, structureById, structuresAt } from "./structures";
import { useWorldStore } from "./store";
import { TOWNS, townAt } from "./towns";
import type { LngLat } from "@/data/journeys";

/**
 * The verbs of the world. Map clicks, panels and story scenes all go through
 * these, so every way into a person, a structure or a moment behaves the same.
 */

/** move the clock; the journey layer follows to whichever journey holds the year */
export function goToYear(year: number) {
  const js = useJourneyStore.getState();
  js.setPlaying(false);
  const j = journeyForYear(year, js.journeyId);
  const t = tForYear(j, year);
  if (j.id !== js.journeyId) js.select(j.id, t);
  else js.setT(t);
  useWorldStore.getState().setYear(year);
}

export function showPerson(slug: string, { fly = false } = {}) {
  const world = useWorldStore.getState();
  world.select({ kind: "person", slug });
  if (!fly) return;
  const here = presenceAt(world.year).find((p) => p.slug === slug);
  if (here) world.fly({ center: here.coord, zoom: 9, pitch: 50 });
}

export function showStructure(id: ArtifactId, { fly = true } = {}) {
  const world = useWorldStore.getState();
  const placement = structureById.get(id);
  world.select({ kind: "structure", id });
  if (!placement || !fly) return;
  useJourneyStore.getState().setPlaying(false);
  const site = siteNear(placement, world.year);
  world.fly({ center: site.coord, zoom: placement.zoom, pitch: 64, bearing: -40 });
}

/** the whole model on its plinth, as the map opens */
export const OVERVIEW = { center: [33, 33.4] as LngLat, zoom: 3.85, pitch: 54, bearing: -10 };

export function showOverview() {
  useJourneyStore.getState().setPlaying(false);
  useWorldStore.getState().fly(OVERVIEW);
}

/**
 * Go to a town: to its own time if it isn't standing in this one (the year
 * nearest to now that it stood in), and down to where the whole of it fills
 * the view.
 */
export function showTown(name: string) {
  const town = TOWNS.find((t) => t.name === name);
  if (!town) return;
  const world = useWorldStore.getState();
  useJourneyStore.getState().setPlaying(false);
  const last = town.to ?? Math.max(town.from, 100);
  let year = Math.round(world.year);
  if (year <= town.from || year >= last) {
    // not standing now: to the year it had most to show (its landmarks and streets built), the nearest such
    const starts = [town.from, ...(town.phases ?? []).map((p) => p.from), ...(town.landmarks ?? []).map((l) => l.from ?? town.from), ...(town.lines ?? []).map((l) => l.from ?? town.from)];
    const standing = (y: number) => [...(town.landmarks ?? []), ...(town.lines ?? [])].filter((x) => (x.from ?? -1e5) <= y && (x.to ?? 1e5) >= y).length;
    const tries = starts.map((y) => y + 1).filter((y) => y > town.from && y < last && townAt(town, y)?.houses !== false);
    year = tries.sort((a, b) => standing(b) - standing(a) || Math.abs(a - world.year) - Math.abs(b - world.year))[0] ?? town.from + 1;
  }
  const now = townAt(town, year) ?? townAt(town, null)!;
  const km = Math.min(40, Math.max(0.5, (Math.max(now.radius, 120) / 1000) * 5.5));
  // the camera first: the clock's own move must not take it to the journey
  world.select(null);
  world.fly({ center: now.at, zoom: Math.log2(72000 / km), pitch: 60, bearing: -30 });
  if (year !== Math.round(world.year)) goToYear(year);
}

/** go to a structure: to a year it stood in, if it doesn't in this one */
export function findStructure(id: ArtifactId) {
  const placement = structureById.get(id);
  if (!placement) return;
  const world = useWorldStore.getState();
  let site = placement.sites.find((s) => world.year >= s.from && world.year < s.to + 1);
  let year = world.year;
  if (!site) {
    // its finished state: the last site that isn't one of building
    site = [...placement.sites].reverse().find((s) => !s.building) ?? placement.sites[placement.sites.length - 1];
    year = Math.min(site.to, site.from + 5);
  }
  useJourneyStore.getState().setPlaying(false);
  world.select({ kind: "structure", id });
  world.fly({ center: site.coord, zoom: placement.zoom, pitch: 64, bearing: -40 });
  if (year !== world.year) goToYear(year);
}

/** the step a structure has reached in the current year (last step once built) */
export function stepNow(id: ArtifactId): number {
  const steps = BUILDS[id]?.steps.length ?? 1;
  const at = structuresAt(useWorldStore.getState().year).find((s) => s.placement.id === id);
  if (!at || !at.site.building) return steps - 1;
  return Math.min(steps - 1, Math.floor(at.progress * steps));
}

export function openBuild(id: ArtifactId, step?: number) {
  useJourneyStore.getState().setPlaying(false);
  useWorldStore.getState().open({ kind: "build", id, step: step ?? stepNow(id) });
}

export function openTree(slug: string) {
  useJourneyStore.getState().setPlaying(false);
  if (corePersonBySlug.has(slug)) useExplorerStore.getState().select(slug);
  else void revealAndSelect(slug);
  useWorldStore.getState().open({ kind: "tree", slug });
}

export function closeOverlay() {
  useWorldStore.getState().open(null);
}
