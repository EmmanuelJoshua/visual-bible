/**
 * Cubit-built sacred objects. Dimensions follow the cited verses;
 * anything not given in the text is marked `interpretive`.
 *
 * Scale: 1 unit = 1 short cubit (≈18 in / 45 cm), except New Jerusalem
 * which is a schematic cube (the city is 12,000 stadia). The short cubit
 * itself is interpretive — the biblical cubit is not a single settled length.
 */

export type ArtifactId =
  | "noahs-ark"
  | "ark"
  | "showbread"
  | "incense-altar"
  | "bronze-altar"
  | "tabernacle"
  | "davids-tent"
  | "temple"
  | "solomon-altar"
  | "temple-cherubim"
  | "bronze-sea"
  | "forest-house"
  | "ezekiel-altar"
  | "new-jerusalem";

export type Dim = {
  label: string;
  /** numeric / span text from the verse */
  cubits?: string;
  /** defaults to "cubits" */
  unit?: string;
  ref: string;
  interpretive?: boolean;
};

export type Artifact = {
  id: ArtifactId;
  name: string;
  hebrew: string;
  era: string;
  summary: string;
  refs: string[];
  dims: Dim[];
  /** Theographic event ids that should surface this model */
  eventIds: string[];
};

export const ARTIFACTS: Artifact[] = [
  {
    id: "noahs-ark",
    name: "Noah's Ark",
    hebrew: "תיבת נח",
    era: "Creation",
    summary:
      "Gopher-wood chest, pitched inside and out: three decks, a window finished a cubit from the top, a door in the side. Cutaway so the stories read as stories.",
    refs: ["Genesis 6:14–16"],
    dims: [
      { label: "Length", cubits: "300", ref: "Genesis 6:15" },
      { label: "Width", cubits: "50", ref: "Genesis 6:15" },
      { label: "Height", cubits: "30", ref: "Genesis 6:15" },
      { label: "Decks", cubits: "3", unit: "stories", ref: "Genesis 6:16" },
      { label: "Window", cubits: "1", ref: "Genesis 6:16" },
    ],
    eventIds: ["recZcXNIkXx2zXaW3", "recnAzV0utz4k20eC"],
  },
  {
    id: "ark",
    name: "Ark of the Covenant",
    hebrew: "ארון הברית",
    era: "Exodus",
    summary:
      "Acacia chest overlaid with gold, the mercy seat as its lid, two cherubim facing one another. The poles stay in the rings.",
    refs: ["Exodus 25:10–22", "Exodus 37:1–9"],
    dims: [
      { label: "Length", cubits: "2½", ref: "Exodus 25:10" },
      { label: "Width", cubits: "1½", ref: "Exodus 25:10" },
      { label: "Height", cubits: "1½", ref: "Exodus 25:10" },
      {
        label: "Poles",
        cubits: "≈4",
        ref: "Exodus 25:13–15",
        interpretive: true,
      },
    ],
    eventIds: ["recS77B5S6Jfdq5a3"],
  },
  {
    id: "showbread",
    name: "Table of the Presence",
    hebrew: "שלחן הפנים",
    era: "Exodus",
    summary:
      "Acacia table overlaid with gold, a molding around it, rings and poles. Twelve cakes in two rows belong on it — the loaves here are a reading of Leviticus, not a measurement.",
    refs: ["Exodus 25:23–30", "Leviticus 24:5–6"],
    dims: [
      { label: "Length", cubits: "2", ref: "Exodus 25:23" },
      { label: "Width", cubits: "1", ref: "Exodus 25:23" },
      { label: "Height", cubits: "1½", ref: "Exodus 25:23" },
      {
        label: "Loaves",
        cubits: "12",
        unit: "cakes",
        ref: "Leviticus 24:5–6",
        interpretive: true,
      },
    ],
    eventIds: [],
  },
  {
    id: "incense-altar",
    name: "Altar of Incense",
    hebrew: "מזבח הקטורת",
    era: "Exodus",
    summary:
      "Square gold altar, a cubit by a cubit and two cubits high, horns at the corners, poles in rings beneath the molding. It stands before the veil.",
    refs: ["Exodus 30:1–6", "Exodus 37:25–28"],
    dims: [
      { label: "Length", cubits: "1", ref: "Exodus 30:2" },
      { label: "Width", cubits: "1", ref: "Exodus 30:2" },
      { label: "Height", cubits: "2", ref: "Exodus 30:2" },
    ],
    eventIds: [],
  },
  {
    id: "bronze-altar",
    name: "Bronze Altar",
    hebrew: "מזבח הנחשת",
    era: "Exodus",
    summary:
      "The court altar of the tabernacle: five cubits square, three high, horns at the corners, a bronze grating. Hollow, of acacia overlaid with bronze.",
    refs: ["Exodus 27:1–8", "Exodus 38:1–7"],
    dims: [
      { label: "Length", cubits: "5", ref: "Exodus 27:1" },
      { label: "Width", cubits: "5", ref: "Exodus 27:1" },
      { label: "Height", cubits: "3", ref: "Exodus 27:1" },
    ],
    eventIds: [],
  },
  {
    id: "tabernacle",
    name: "Wilderness Tabernacle",
    hebrew: "משכן",
    era: "Exodus",
    summary:
      "A linen court around a gold-fitted tent: holy place, then the most holy place behind the veil, with the ark inside.",
    refs: ["Exodus 26", "Exodus 27:1–18"],
    dims: [
      { label: "Court", cubits: "100 × 50", ref: "Exodus 27:18" },
      { label: "Court hangings", cubits: "5 high", ref: "Exodus 27:18" },
      { label: "Tent", cubits: "30 × 10 × 10", ref: "Exodus 26:15–25" },
      { label: "Most holy place", cubits: "10 × 10 × 10", ref: "Exodus 26:33" },
      { label: "Bronze altar", cubits: "5 × 5 × 3", ref: "Exodus 27:1" },
    ],
    eventIds: ["recvA947nCyo8kadV"],
  },
  {
    id: "davids-tent",
    name: "David's Tabernacle",
    hebrew: "אהל דוד",
    era: "United Kingdom",
    summary:
      "David pitched a tent on Zion for the ark. Scripture gives the act, not the dimensions — this is a small open tent at an interpretive size, ark at true cubit scale.",
    refs: ["2 Samuel 6:17", "1 Chronicles 15:1", "1 Chronicles 16:1"],
    dims: [
      {
        label: "Tent",
        cubits: "10 × 10 × 8",
        ref: "not specified",
        interpretive: true,
      },
    ],
    eventIds: [],
  },
  {
    id: "temple",
    name: "Solomon's Temple",
    hebrew: "בית המקדש",
    era: "United Kingdom",
    summary:
      "Cutaway of the house: porch, holy place, and inner sanctuary. Side chambers and Jachin & Boaz in front. The ark sits in the inner cube at true cubit scale.",
    refs: ["1 Kings 6", "1 Kings 7:15–22", "2 Chronicles 3"],
    dims: [
      { label: "House", cubits: "60 × 20 × 30", ref: "1 Kings 6:2" },
      { label: "Porch", cubits: "20 × 10", ref: "1 Kings 6:3" },
      { label: "Inner sanctuary", cubits: "20 × 20 × 20", ref: "1 Kings 6:20" },
      { label: "Jachin & Boaz", cubits: "18 high", ref: "1 Kings 7:15" },
      {
        label: "Porch vs. house length",
        ref: "1 Kings 6:2–3",
        interpretive: true,
      },
    ],
    eventIds: ["recYlpu8OdsUJoG8g"],
  },
  {
    id: "solomon-altar",
    name: "Solomon's Bronze Altar",
    hebrew: "מזבח הנחשת",
    era: "United Kingdom",
    summary:
      "The temple court altar: twenty cubits square and ten high — four times the wilderness altar in plan, more than three times the height. Horns at the corners; finish is a reading, not a verse.",
    refs: ["2 Chronicles 4:1"],
    dims: [
      { label: "Length", cubits: "20", ref: "2 Chronicles 4:1" },
      { label: "Width", cubits: "20", ref: "2 Chronicles 4:1" },
      { label: "Height", cubits: "10", ref: "2 Chronicles 4:1" },
    ],
    eventIds: [],
  },
  {
    id: "temple-cherubim",
    name: "Temple Cherubim",
    hebrew: "כרובים",
    era: "United Kingdom",
    summary:
      "Two olive-wood cherubim in the inner house, overlaid with gold. Each ten cubits high; each wing five cubits, so that wingtip to wingtip fills the twenty-cubit sanctuary.",
    refs: ["1 Kings 6:23–28", "2 Chronicles 3:10–13"],
    dims: [
      { label: "Height", cubits: "10", ref: "1 Kings 6:23" },
      { label: "Wing", cubits: "5", ref: "1 Kings 6:24" },
      { label: "Wingspan (pair)", cubits: "20", ref: "1 Kings 6:24–27" },
    ],
    eventIds: [],
  },
  {
    id: "bronze-sea",
    name: "The Bronze Sea",
    hebrew: "הים המוצק",
    era: "United Kingdom",
    summary:
      "Cast bronze basin, ten cubits from brim to brim, five high, thirty around — the text’s circle uses a cubit π of 3. It rests on twelve oxen, three facing each quarter. Lily-shaped brim, a handbreadth thick.",
    refs: ["1 Kings 7:23–26", "2 Chronicles 4:2–5"],
    dims: [
      { label: "Diameter", cubits: "10", ref: "1 Kings 7:23" },
      { label: "Height", cubits: "5", ref: "1 Kings 7:23" },
      { label: "Circumference", cubits: "30", ref: "1 Kings 7:23" },
      { label: "Oxen", cubits: "12", unit: "beasts", ref: "1 Kings 7:25" },
      {
        label: "Thickness",
        cubits: "a handbreadth",
        ref: "1 Kings 7:26",
      },
    ],
    eventIds: [],
  },
  {
    id: "forest-house",
    name: "House of the Forest of Lebanon",
    hebrew: "בית יער הלבנון",
    era: "United Kingdom",
    summary:
      "Solomon’s cedar hall beside the temple: a hundred cubits long, fifty wide, thirty high, with cedar pillars in rows. Forty-five pillars, fifteen in a row — three rows here; some readings say four.",
    refs: ["1 Kings 7:2–5"],
    dims: [
      { label: "Length", cubits: "100", ref: "1 Kings 7:2" },
      { label: "Width", cubits: "50", ref: "1 Kings 7:2" },
      { label: "Height", cubits: "30", ref: "1 Kings 7:2" },
      { label: "Pillars", cubits: "45", unit: "columns", ref: "1 Kings 7:3" },
      {
        label: "Rows",
        cubits: "3",
        unit: "rows",
        ref: "1 Kings 7:2–3",
        interpretive: true,
      },
    ],
    eventIds: [],
  },
  {
    id: "ezekiel-altar",
    name: "Ezekiel's Altar",
    hebrew: "מזבח יחזקאל",
    era: "Exile",
    summary:
      "The visionary hearth of Ezekiel 40–48, given in long cubits (a cubit and a handbreadth). Stepped settles rise to a twelve-cubit square hearth; horns at the corners; steps face east.",
    refs: ["Ezekiel 43:13–17"],
    dims: [
      {
        label: "Cubit used",
        cubits: "cubit + handbreadth",
        ref: "Ezekiel 43:13",
      },
      { label: "Hearth", cubits: "12 × 12", ref: "Ezekiel 43:16" },
      { label: "Hearth height", cubits: "4", ref: "Ezekiel 43:15" },
      { label: "Lower settle", cubits: "2 high", ref: "Ezekiel 43:14" },
      { label: "Greater settle", cubits: "4 high", ref: "Ezekiel 43:14" },
      {
        label: "Long cubit",
        ref: "Ezekiel 43:13",
        interpretive: true,
      },
    ],
    eventIds: [],
  },
  {
    id: "new-jerusalem",
    name: "New Jerusalem",
    hebrew: "ירושלים החדשה",
    era: "Revelation",
    summary:
      "The city lies foursquare: length, breadth, and height are equal — 12,000 stadia. Twelve gates, three to a side. The wall is 144 cubits: a lip on this schematic cube, not cubit scale. Gold like glass.",
    refs: ["Revelation 21:12–17"],
    dims: [
      {
        label: "City",
        cubits: "12,000",
        unit: "stadia",
        ref: "Revelation 21:16",
      },
      { label: "Equal height", cubits: "12,000", unit: "stadia", ref: "Revelation 21:16" },
      { label: "Wall", cubits: "144", ref: "Revelation 21:17" },
      { label: "Gates", cubits: "12", unit: "gates", ref: "Revelation 21:12–13" },
      {
        label: "Desk scale",
        cubits: "schematic cube",
        unit: "",
        ref: "Revelation 21:16",
        interpretive: true,
      },
    ],
    eventIds: [],
  },
];

export const artifactById = new Map(ARTIFACTS.map((a) => [a.id, a]));

export const artifactIdByEventId = new Map<string, ArtifactId>();
for (const a of ARTIFACTS) {
  for (const id of a.eventIds) artifactIdByEventId.set(id, a.id);
}

export const ARTIFACT_ERAS = [...new Set(ARTIFACTS.map((a) => a.era))];
