import type { ArtifactId } from "@/data/artifacts";
import type { LngLat } from "@/data/journeys";

/**
 * Where the built structures stood, and when. Years follow the same
 * Ussher-style chronology as `generated/events.json` (Exodus 1490 BC,
 * temple begun 1011 BC), so they line up with the timeline and journeys.
 *
 * The tabernacle and the ark stand on the most nearly level ground within a
 * few hundred metres of the traditional spot (found from the elevation
 * data), as a camp would pitch: at Sinai, the plain north of Jebel Musa.
 */

export type StructureSite = {
  /** where it stood for this span */
  place: string;
  coord: LngLat;
  from: number;
  to: number;
  note: string;
  ref: string;
  /** the build is under way across this span: the step follows the year */
  building?: boolean;
  /** come to rest here rather than built: laid on the ground as it lies */
  resting?: boolean;
  interpretive?: boolean;
};

export type StructurePlacement = {
  id: ArtifactId;
  /** zoom the camera settles at when flying to it: the model filling the view (distance 72000 / 2^zoom km) */
  zoom: number;
  sites: StructureSite[];
};

export const STRUCTURES: StructurePlacement[] = [
  {
    id: "noahs-ark",
    zoom: 8.4,
    sites: [
      {
        place: "Mesopotamia",
        coord: [45.51, 31.78],
        from: -2467,
        to: -2348,
        note: "Built of gopher wood and pitched within and without, three hundred cubits long.",
        ref: "Genesis 6:14–16",
        building: true,
        interpretive: true,
      },
      {
        place: "Mountains of Ararat",
        // a shelf on Greater Ararat's north-west shoulder, 3,600 m up and nearly level
        coord: [44.2679, 39.7311],
        from: -2347,
        to: -2300,
        note: "The ark rests “upon the mountains of Ararat” in the seventh month.",
        ref: "Genesis 8:4",
        resting: true,
      },
    ],
  },
  {
    id: "tabernacle",
    zoom: 8.5,
    sites: [
      {
        place: "Mount Sinai",
        coord: [33.9753, 28.5443],
        from: -1490,
        to: -1489,
        note: "Made after the pattern shown on the mount, and raised on the first day of the first month of the second year.",
        ref: "Exodus 40:17",
        building: true,
        interpretive: true,
      },
      {
        place: "The wilderness",
        coord: [34.3953, 30.6498],
        from: -1488,
        to: -1452,
        note: "Taken down and carried by the Levites wherever the cloud led, and pitched again at each camp.",
        ref: "Numbers 9:15–23",
        interpretive: true,
      },
      {
        place: "Gilgal",
        coord: [35.4809, 31.8496],
        from: -1451,
        to: -1445,
        note: "The camp at Gilgal, near Jericho, after the crossing of the Jordan.",
        ref: "Joshua 4:19; 5:10",
        interpretive: true,
      },
      {
        place: "Shiloh",
        coord: [35.29, 32.0546],
        from: -1444,
        to: -1121,
        note: "“The whole congregation… assembled together at Shiloh, and set up the tabernacle of the congregation there.”",
        ref: "Joshua 18:1",
      },
      {
        place: "Gibeon",
        coord: [35.1804, 31.8492],
        from: -1120,
        to: -1005,
        note: "The tabernacle of Moses and the bronze altar stand in the high place at Gibeon.",
        ref: "1 Chronicles 21:29",
      },
    ],
  },
  {
    id: "ark",
    zoom: 8.5,
    sites: [
      {
        place: "Mount Sinai",
        coord: [33.9753, 28.5443],
        from: -1490,
        to: -1489,
        note: "Bezalel makes the ark of shittim wood, overlaid with pure gold.",
        ref: "Exodus 37:1–9",
        building: true,
        interpretive: true,
      },
      {
        place: "Shiloh",
        coord: [35.29, 32.0546],
        from: -1444,
        to: -1121,
        note: "Kept in the tabernacle at Shiloh until it is carried out to battle at Ebenezer.",
        ref: "1 Samuel 4:3–4",
      },
      {
        place: "Kiriath-jearim",
        coord: [35.1041, 31.8051],
        from: -1120,
        to: -1043,
        note: "Returned by the Philistines, it stays twenty years and more in the house of Abinadab.",
        ref: "1 Samuel 7:1–2",
      },
      {
        place: "City of David",
        coord: [35.2351, 31.7726],
        from: -1042,
        to: -1005,
        note: "David brings it up with shouting and sets it in the tent he had pitched for it.",
        ref: "2 Samuel 6:12–17",
      },
      {
        place: "The Most Holy Place",
        coord: [35.2354, 31.7781],
        from: -1004,
        to: -588,
        note: "Brought into the oracle of the house, under the wings of the cherubims.",
        ref: "1 Kings 8:6",
      },
    ],
  },
  {
    id: "temple",
    zoom: 8.5,
    sites: [
      {
        place: "Mount Moriah",
        coord: [35.2354, 31.7781],
        from: -1011,
        to: -1005,
        note: "Begun in the fourth year of Solomon's reign and finished in seven years.",
        ref: "1 Kings 6:1, 37–38",
        building: true,
      },
      {
        place: "Mount Moriah",
        coord: [35.2354, 31.7781],
        from: -1004,
        to: -588,
        note: "The house of the LORD stands on Mount Moriah until Nebuchadnezzar's army burns it.",
        ref: "2 Chronicles 3:1; 2 Kings 25:9",
      },
    ],
  },
];

export const structureById = new Map(STRUCTURES.map((s) => [s.id, s]));

export type StructureAt = {
  placement: StructurePlacement;
  site: StructureSite;
  /** 0..1 through construction while `site.building`, else 1 */
  progress: number;
};

/** structures standing (or going up) in a given year */
export function structuresAt(year: number): StructureAt[] {
  const out: StructureAt[] = [];
  for (const placement of STRUCTURES) {
    const site = placement.sites.find((s) => year >= s.from && year < s.to + 1);
    if (!site) continue;
    const progress = site.building
      ? Math.min(1, Math.max(0, (year - site.from) / (site.to + 1 - site.from)))
      : 1;
    out.push({ placement, site, progress });
  }
  return out;
}

/** the site to show for a structure: the one standing in `year`, else the nearest in time */
export function siteNear(placement: StructurePlacement, year: number): StructureSite {
  const dist = (s: StructureSite) => (year < s.from ? s.from - year : year > s.to ? year - s.to : 0);
  return placement.sites.reduce((best, s) => (dist(s) < dist(best) ? s : best));
}
