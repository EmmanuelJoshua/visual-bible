import coreGraphJson from "./generated/core-graph.json";
import eventsJson from "./generated/events.json";
import type { BibleEvent, Person } from "./types";

export const corePeople = coreGraphJson.people as Person[];
export const messianicLine = coreGraphJson.messianicLine as string[];
export const messianicSet = new Set(messianicLine);
export const allEvents = eventsJson as BibleEvent[];

export const corePersonBySlug = new Map(corePeople.map((p) => [p.slug, p]));
export const eventById = new Map(allEvents.map((e) => [e.id, e]));

let allPeoplePromise: Promise<Person[]> | null = null;
let allPeopleCache: Person[] | null = null;
let allBySlugCache: Map<string, Person> | null = null;

/** Lazily fetches the full ~3,000-person dataset (search / expand-on-demand). */
export function loadAllPeople(): Promise<Person[]> {
  if (!allPeoplePromise) {
    allPeoplePromise = fetch("/data/people-all.json")
      .then((r) => r.json())
      .then((people: Person[]) => {
        allPeopleCache = people;
        allBySlugCache = new Map(people.map((p) => [p.slug, p]));
        return people;
      });
  }
  return allPeoplePromise;
}

export function getAllPeopleSync(): Person[] | null {
  return allPeopleCache;
}

export function getPersonSync(slug: string): Person | undefined {
  return corePersonBySlug.get(slug) ?? allBySlugCache?.get(slug);
}

export async function getPerson(slug: string): Promise<Person | undefined> {
  const core = corePersonBySlug.get(slug);
  if (core) return core;
  await loadAllPeople();
  return allBySlugCache?.get(slug);
}
