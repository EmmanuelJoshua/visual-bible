/**
 * Transforms the raw Theographic Bible Metadata JSON (data/raw/) into the
 * slim app-ready datasets used by the genealogy graph and timeline.
 *
 * Outputs:
 *   src/data/generated/core-graph.json  – curated core people (~300) + messianic line
 *   src/data/generated/events.json      – all dated events, normalized, era-tagged
 *   public/data/people-all.json         – every person, slim, for search/expand-on-demand
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

type Raw = { id: string; fields: Record<string, unknown> };

const ROOT = join(import.meta.dirname, "..");
const RAW_DIR = join(ROOT, "data/raw");
const SOURCE_BASE =
  "https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/json";

async function ensureRaw(name: string): Promise<Raw[]> {
  const path = join(RAW_DIR, `${name}.json`);
  if (!existsSync(path)) {
    mkdirSync(RAW_DIR, { recursive: true });
    console.log(`downloading ${name}.json …`);
    const res = await fetch(`${SOURCE_BASE}/${name}.json`);
    if (!res.ok) throw new Error(`failed to download ${name}.json: ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

const people = await ensureRaw("people");
const events = await ensureRaw("events");
const groups = await ensureRaw("peopleGroups");

const personById = new Map(people.map((r) => [r.id, r]));
const groupNameById = new Map(
  groups.map((r) => [r.id, String(r.fields.groupName ?? "")]),
);

const f = <T,>(r: Raw, key: string): T | undefined => r.fields[key] as T;
const ids = (r: Raw, key: string): string[] => (r.fields[key] as string[]) ?? [];

const GOD_ID = people.find((r) => f(r, "slug") === "god_1324")!.id;
const slugOf = (id: string) => {
  const p = personById.get(id);
  return p ? String(f(p, "slug")) : undefined;
};

/* ---------------------------------- bios ---------------------------------- */

function cleanBio(
  text: string | string[] | undefined,
  maxLen: number,
): string | undefined {
  if (Array.isArray(text)) text = text.filter(Boolean).join(" ");
  if (!text || typeof text !== "string") return undefined;
  let t = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // markdown links -> plain text
    .replace(/\ufffd/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return undefined;
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  t = end > maxLen * 0.4 ? cut.slice(0, end + 1) : cut.trimEnd() + "…";
  return t;
}

/* ------------------------------ messianic line ---------------------------- */

const jesus = people.find((r) => f(r, "slug") === "jesus_905")!;
const messianicLine: string[] = [];
{
  let cur: Raw | undefined = jesus;
  while (cur) {
    messianicLine.push(String(f(cur, "slug")));
    const fatherId: string | undefined = ids(cur, "father")[0];
    if (!fatherId || fatherId === GOD_ID) break;
    cur = personById.get(fatherId);
  }
  messianicLine.reverse(); // adam … jesus
}
const messianicSet = new Set(messianicLine);

/* ------------------------------ core selection ---------------------------- */

const genealogyOfJesusGroup = [...groupNameById.entries()].find(
  ([, name]) => name === "Genealogy of Jesus",
)?.[0];

const coreIds = new Set<string>();

// 1. Messianic line + everyone tagged "Genealogy of Jesus"
for (const p of people) {
  const slug = String(f(p, "slug"));
  if (messianicSet.has(slug)) coreIds.add(p.id);
  if (genealogyOfJesusGroup && ids(p, "memberOf").includes(genealogyOfJesusGroup))
    coreIds.add(p.id);
}

// 2. The most-mentioned people (patriarchs, judges, kings, prophets, apostles
//    all surface naturally through verse counts).
// Note: `status` is editorial workflow state in the source Airtable (many major
// figures are "wip"), so it is deliberately not used as a filter here.
// Divine persons stay searchable but don't belong in a family graph.
const NON_HUMAN = new Set(["God", "Holy Spirit"]);
const famous = people
  .filter(
    (p) =>
      f(p, "isProperName") !== false &&
      p.id !== GOD_ID &&
      !NON_HUMAN.has(String(f(p, "name"))),
  )
  .sort(
    (a, b) => (f<number>(b, "verseCount") ?? 0) - (f<number>(a, "verseCount") ?? 0),
  );
for (const p of famous) {
  if (coreIds.size >= 240) break;
  coreIds.add(p.id);
}

// 2b. Figures the verse-count heuristic misses (e.g. prophets who narrate
//     their own books and are rarely named in them).
const MUST_INCLUDE = [
  "Ezekiel", "Nehemiah", "Hosea", "Joel", "Amos", "Obadiah", "Micah",
  "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
];
for (const name of MUST_INCLUDE) {
  const best = people
    .filter((p) => f(p, "name") === name)
    .sort(
      (a, b) =>
        (f<number>(b, "verseCount") ?? 0) - (f<number>(a, "verseCount") ?? 0),
    )[0];
  if (best) coreIds.add(best.id);
}

// 3. Close the family net: parents and partners of every core member, plus
//    notable children of messianic-line members.
for (const id of [...coreIds]) {
  const p = personById.get(id)!;
  for (const rel of ["father", "mother", "partners"] as const) {
    for (const relId of ids(p, rel)) {
      if (relId !== GOD_ID && personById.has(relId)) coreIds.add(relId);
    }
  }
  if (messianicSet.has(String(f(p, "slug")))) {
    for (const childId of ids(p, "children")) {
      const child = personById.get(childId);
      if (child && (f<number>(child, "verseCount") ?? 0) >= 5) coreIds.add(childId);
    }
  }
}
coreIds.delete(GOD_ID);

/* --------------------------------- people --------------------------------- */

type SlimPerson = {
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

function toSlim(p: Raw, bioLen: number): SlimPerson {
  const slug = String(f(p, "slug"));
  const genderRaw = String(f(p, "gender") ?? "");
  const fatherId = ids(p, "father")[0];
  const motherId = ids(p, "mother")[0];
  const partners = ids(p, "partners")
    .map(slugOf)
    .filter((s): s is string => !!s);
  const children = ids(p, "children")
    .map(slugOf)
    .filter((s): s is string => !!s);
  const groupNames = ids(p, "memberOf")
    .map((g) => groupNameById.get(g))
    .filter((n): n is string => !!n);
  const yearNum = (key: string) => {
    const v = f<string | number>(p, key);
    if (v === undefined || v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const slim: SlimPerson = {
    slug,
    name: String(f(p, "displayTitle") ?? f(p, "name")),
    gender: genderRaw === "Male" ? "M" : genderRaw === "Female" ? "F" : "U",
    birthYear: yearNum("birthYear"),
    deathYear: yearNum("deathYear"),
    minYear: f<number>(p, "minYear") ?? 0,
    maxYear: f<number>(p, "maxYear") ?? 0,
    verseCount: f<number>(p, "verseCount") ?? 0,
    father: fatherId && fatherId !== GOD_ID ? slugOf(fatherId) : undefined,
    mother: motherId ? slugOf(motherId) : undefined,
    partners: partners.length ? partners : undefined,
    children: children.length ? children : undefined,
    groups: groupNames.length ? groupNames : undefined,
    alsoCalled: f<string[] | string>(p, "alsoCalled")
      ? String(
          Array.isArray(f(p, "alsoCalled"))
            ? (f<string[]>(p, "alsoCalled") ?? []).join(", ")
            : f(p, "alsoCalled"),
        )
      : undefined,
    bio: cleanBio(f<string>(p, "dictText") ?? f<string>(p, "dictionaryText"), bioLen),
    dictLink: f<string>(p, "dictionaryLink"),
    eventIds: ids(p, "timeline").length ? ids(p, "timeline") : undefined,
    messianic: messianicSet.has(slug) || undefined,
    core: coreIds.has(p.id) || undefined,
  };
  return slim;
}

const corePeople = [...coreIds]
  .map((id) => toSlim(personById.get(id)!, 600))
  .sort((a, b) => a.minYear - b.minYear);

const allPeople = people
  .filter((p) => p.id !== GOD_ID)
  .map((p) => toSlim(p, 280))
  .sort((a, b) => b.verseCount - a.verseCount);

/* --------------------------------- events --------------------------------- */

const BOOKS = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges",
  "Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles",
  "Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes",
  "Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel",
  "Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk",
  "Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John",
  "Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians",
  "Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy",
  "2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter",
  "1 John","2 John","3 John","Jude","Revelation",
];

function refFromVerseSort(vs: string | undefined): string | undefined {
  if (!vs || vs.length < 8) return undefined;
  const book = Number(vs.slice(0, 2));
  const chapter = Number(vs.slice(2, 5));
  const verse = Number(vs.slice(5, 8));
  const name = BOOKS[book - 1];
  if (!name) return undefined;
  return `${name} ${chapter}:${verse}`;
}

export type EraId =
  | "creation" | "patriarchs" | "exodus" | "judges" | "united"
  | "divided" | "exile" | "silence" | "christ" | "church";

const ERA_BOUNDS: [EraId, number][] = [
  ["creation", -2349],
  ["patriarchs", -1706],
  ["exodus", -1406],
  ["judges", -1051],
  ["united", -931],
  ["divided", -587],
  ["exile", -400],
  ["silence", -5],
  ["christ", 33],
  ["church", 10000],
];

function eraOf(year: number): EraId {
  for (const [era, end] of ERA_BOUNDS) if (year <= end) return era;
  return "church";
}

// startDate is either a plain year ("-4003") or an ISO date ("0030-05-01").
function parseStartYear(startDate: string | undefined): number {
  if (!startDate) return NaN;
  const asNumber = Number(startDate);
  if (Number.isFinite(asNumber)) return asNumber;
  const m = startDate.match(/^(-?\d{1,4})-\d{2}-\d{2}$/);
  return m ? Number(m[1]) : NaN;
}

const slimEvents = events
  .map((e) => {
    const startYear = parseStartYear(f<string>(e, "startDate"));
    const participants = ids(e, "participants")
      .map((id) =>
        id === GOD_ID ? "god" : slugOf(id),
      )
      .filter((s): s is string => !!s);
    return {
      id: e.id,
      title: String(f(e, "title")),
      startYear,
      duration: f<string>(e, "duration"),
      sortKey: f<number>(e, "sortKey") ?? startYear,
      era: eraOf(startYear),
      ref: refFromVerseSort(f<string>(e, "verseSort")),
      participants: participants.length ? participants : undefined,
      groups: ids(e, "groups").length
        ? ids(e, "groups")
            .map((g) => groupNameById.get(g))
            .filter(Boolean)
        : undefined,
    };
  })
  .filter((e) => Number.isFinite(e.startYear))
  .sort((a, b) => a.sortKey - b.sortKey);

/* --------------------------------- write ---------------------------------- */

const genDir = join(ROOT, "src/data/generated");
const pubDir = join(ROOT, "public/data");
mkdirSync(genDir, { recursive: true });
mkdirSync(pubDir, { recursive: true });

writeFileSync(
  join(genDir, "core-graph.json"),
  JSON.stringify({ people: corePeople, messianicLine }, null, 0),
);
writeFileSync(join(genDir, "events.json"), JSON.stringify(slimEvents, null, 0));
writeFileSync(join(pubDir, "people-all.json"), JSON.stringify(allPeople, null, 0));

console.log(
  `core people: ${corePeople.length}\nall people: ${allPeople.length}\nevents: ${slimEvents.length}\nmessianic line: ${messianicLine.length}`,
);
const sizes = [
  ["core-graph.json", join(genDir, "core-graph.json")],
  ["events.json", join(genDir, "events.json")],
  ["people-all.json", join(pubDir, "people-all.json")],
] as const;
for (const [name, path] of sizes) {
  const kb = Math.round(readFileSync(path).length / 1024);
  console.log(`${name}: ${kb} KB`);
}
