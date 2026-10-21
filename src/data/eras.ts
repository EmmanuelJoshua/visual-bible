import type { EraId } from "./types";

export type Era = {
  id: EraId;
  name: string;
  range: string;
  startYear: number;
  endYear: number;
  tagline: string;
  /** which ThreeUI backdrop the timeline chapter uses (ink sections only) */
  backdrop: "nebula" | "storm" | "horizon" | "embers" | "drift" | "constellation";
  /** editorial section theme: cream paper, ink black, or full red */
  theme: "cream" | "ink" | "red";
  /** Hebrew / Greek accent, like KAIRO's Japanese glyphs */
  script: string;
};

export const ERAS: Era[] = [
  {
    id: "creation",
    name: "Creation & the First World",
    range: "≈4004–2349 BC",
    startYear: -4004,
    endYear: -2349,
    tagline: "From the first light to the waters of the flood.",
    backdrop: "nebula",
    theme: "ink",
    script: "בראשית",
  },
  {
    id: "patriarchs",
    name: "The Patriarchs",
    range: "≈2348–1706 BC",
    startYear: -2348,
    endYear: -1706,
    tagline: "Babel, Abraham's calling, and the families of promise.",
    backdrop: "storm",
    theme: "cream",
    script: "אבות",
  },
  {
    id: "exodus",
    name: "Egypt & Exodus",
    range: "≈1705–1406 BC",
    startYear: -1705,
    endYear: -1406,
    tagline: "Slavery, deliverance, and forty years of wilderness.",
    backdrop: "embers",
    theme: "red",
    script: "שמות",
  },
  {
    id: "judges",
    name: "Conquest & Judges",
    range: "≈1405–1051 BC",
    startYear: -1405,
    endYear: -1051,
    tagline: "A land taken, a people wavering, deliverers raised up.",
    backdrop: "horizon",
    theme: "cream",
    script: "שופטים",
  },
  {
    id: "united",
    name: "The United Kingdom",
    range: "≈1050–931 BC",
    startYear: -1050,
    endYear: -931,
    tagline: "Saul, David, and Solomon: a throne established.",
    backdrop: "drift",
    theme: "ink",
    script: "מלכים",
  },
  {
    id: "divided",
    name: "The Divided Kingdom",
    range: "≈930–587 BC",
    startYear: -930,
    endYear: -587,
    tagline: "Two thrones, warring prophets, and gathering empires.",
    backdrop: "storm",
    theme: "cream",
    script: "נביאים",
  },
  {
    id: "exile",
    name: "Exile & Return",
    range: "≈586–400 BC",
    startYear: -586,
    endYear: -400,
    tagline: "By the rivers of Babylon — and the long road home.",
    backdrop: "constellation",
    theme: "ink",
    script: "גלות",
  },
  {
    id: "silence",
    name: "Between the Testaments",
    range: "≈399–5 BC",
    startYear: -399,
    endYear: -5,
    tagline: "Four hundred years of silence before the dawn.",
    backdrop: "drift",
    theme: "cream",
    script: "דממה",
  },
  {
    id: "christ",
    name: "The Life of Christ",
    range: "≈4 BC–AD 33",
    startYear: -4,
    endYear: 33,
    tagline: "The Word made flesh, dwelling among us.",
    backdrop: "nebula",
    theme: "red",
    script: "ΛΟΓΟΣ",
  },
  {
    id: "church",
    name: "The Early Church",
    range: "AD 33–100",
    startYear: 33,
    endYear: 100,
    tagline: "Pentecost fire and a gospel that reaches the nations.",
    backdrop: "embers",
    theme: "ink",
    script: "ΕΚΚΛΗΣΙΑ",
  },
];

export const eraById = new Map(ERAS.map((e) => [e.id, e]));

/** the era a year falls in (clamped to the first and last) */
export function eraForYear(year: number): Era {
  return ERAS.find((e) => year <= e.endYear) ?? ERAS[ERAS.length - 1];
}
