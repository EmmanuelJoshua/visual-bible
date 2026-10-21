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
  world.fly({ center: site.coord, zoom: placement.zoom, pitch: 62, bearing: -18 });
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
