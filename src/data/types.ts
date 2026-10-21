export type Person = {
  slug: string;
  name: string;
  gender: "M" | "F" | "U";
  birthYear?: number;
  deathYear?: number;
  minYear: number;
  maxYear: number;
  verseCount: number;
  father?: string;
  mother?: string;
  partners?: string[];
  children?: string[];
  groups?: string[];
  alsoCalled?: string;
  bio?: string;
  dictLink?: string;
  eventIds?: string[];
  messianic?: boolean;
  core?: boolean;
};

export type EraId =
  | "creation"
  | "patriarchs"
  | "exodus"
  | "judges"
  | "united"
  | "divided"
  | "exile"
  | "silence"
  | "christ"
  | "church";

export type BibleEvent = {
  id: string;
  title: string;
  startYear: number;
  duration?: string;
  sortKey: number;
  era: EraId;
  ref?: string;
  participants?: string[];
  groups?: string[];
};

export function formatYear(year: number): string {
  if (year < 0) return `${-year} BC`;
  return `AD ${year}`;
}

export function lifespanLabel(p: Person): string | undefined {
  if (p.birthYear !== undefined && p.deathYear !== undefined)
    return `${formatYear(p.birthYear)} – ${formatYear(p.deathYear)}`;
  if (p.birthYear !== undefined) return `b. ${formatYear(p.birthYear)}`;
  if (p.deathYear !== undefined) return `d. ${formatYear(p.deathYear)}`;
  return undefined;
}
