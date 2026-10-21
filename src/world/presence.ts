import { getPersonSync } from "@/data";
import { JOURNEYS, type LngLat } from "@/data/journeys";

/**
 * Where people were, and when: every journey stop names the people standing
 * there (or falls back to the journey's travellers). A person is placed at the
 * latest stop they reached by a given year, for as long as they lived.
 */

type Sighting = { year: number; coord: LngLat; place: string; journeyId: string };

/** sightings per person, in time order */
const SIGHTINGS: Map<string, Sighting[]> = (() => {
  const out = new Map<string, Sighting[]>();
  for (const j of JOURNEYS) {
    for (const stop of j.stops) {
      for (const slug of stop.people ?? j.people) {
        const list = out.get(slug) ?? [];
        list.push({ year: stop.year, coord: stop.coord, place: stop.name, journeyId: j.id });
        out.set(slug, list);
      }
    }
  }
  for (const list of out.values()) list.sort((a, b) => a.year - b.year);
  return out;
})();

/** how long someone with no recorded death stays on the map after their last stop */
const LINGER_YEARS = 25;
/** show someone a little before their first stop, so they're there as a scene opens */
const ARRIVAL_GRACE = 2;

export type Presence = {
  slug: string;
  coord: LngLat;
  place: string;
  journeyId: string;
};

/**
 * Who is where in `year`. Pass the journey on screen and the stop it has
 * reached: its travellers stand there, since a journey's stops often share
 * one year (the whole Exodus to Sinai is 1490 BC).
 */
export function presenceAt(year: number, on?: { journeyId: string; stop: number }): Presence[] {
  const journey = on && JOURNEYS.find((j) => j.id === on.journeyId);
  const stop = journey?.stops[Math.min(on!.stop, journey.stops.length - 1)];
  const out: Presence[] = [];
  for (const [slug, sightings] of SIGHTINGS) {
    const person = getPersonSync(slug);
    const first = sightings[0];
    const last = sightings[sightings.length - 1];
    const died = person?.deathYear ?? last.year + LINGER_YEARS;
    // only from the first place the text puts them: before that we don't know where they were
    if (year < first.year - ARRIVAL_GRACE || year > died) continue;
    let at = first;
    for (const s of sightings) {
      if (s.year <= year) at = s;
      else break;
    }
    if (journey && stop && Math.abs(stop.year - year) < 1 && (stop.people ?? journey.people).includes(slug)) {
      out.push({ slug, coord: stop.coord, place: stop.name, journeyId: journey.id });
      continue;
    }
    out.push({ slug, coord: at.coord, place: at.place, journeyId: at.journeyId });
  }
  return out;
}

/** journeys a person appears in, in time order */
export function journeysOf(slug: string): string[] {
  return [...new Set((SIGHTINGS.get(slug) ?? []).map((s) => s.journeyId))];
}

export function hasPresence(slug: string): boolean {
  return SIGHTINGS.has(slug);
}
