import type { BlueprintEl, BuildInfo } from "./types";

/**
 * Noah's Ark, Genesis 6:14–7:18.
 * World: x along the 300-cubit length, z across the 50, y up. The south
 * side (−z) is drawn cut away from x = −30 so the three stories show.
 */
export const N = {
  L: 300,
  W: 50,
  H: 30,
  /** top of each story's floor */
  decks: [2.8, 11, 20] as const,
  cutX: -30,
  door: { x: -90, y0: 11, y1: 20 },
  water: 12,
} as const;

export const NOAH_STEPS = [
  {
    id: "keel",
    title: "Gopher wood: keel and bottom",
    description:
      "God gives Noah a set of plans. The work starts from the bottom: a heavy keel on timber cradles, the stem rising at the bow and the stern post at the transom, then the flat bottom planked out to the bilge. ‘Gopher’ wood appears only here in the Bible — the kind of tree is unknown.",
    verses: [
      {
        ref: "Genesis 6:14",
        text: "Make thee an ark of gopher wood…",
      },
      {
        ref: "Genesis 6:15",
        text: "…The length of the ark shall be three hundred cubits, the breadth of it fifty cubits, and the height of it thirty cubits.",
      },
    ],
    label: "Keel · gopher wood · 300 cubits",
    measure: "300 × 50 × 30 cubits",
    interpretive: "The text gives only the dimensions. Drawn here as a ship — rounded bow, full stern, keel and frames — which is one reading; others draw a plain box.",
  },
  {
    id: "frames",
    title: "Frames every fifteen cubits",
    description:
      "Twenty-one frames rise from the floor to carry the sides and decks. About 135 m long, 22 m wide and 13 m high — a 6 : 1 length-to-breadth ratio that modern naval architects regard as stable in heavy seas.",
    verses: [
      {
        ref: "Genesis 6:15",
        text: "And this is the fashion which thou shalt make it of…",
      },
    ],
    label: "21 frames · 30 cubits high",
    interpretive: "Frame spacing is not given.",
  },
  {
    id: "planking",
    title: "Planking the hull",
    description:
      "Strakes are laid up the round of the bilge and the sides, course by course, closing in to the bow and the transom, and capped with a rail. On the near side the upper planking is left off here so the stories inside stay visible.",
    verses: [
      {
        ref: "Genesis 6:14",
        text: "Make thee an ark of gopher wood…",
      },
    ],
    label: "Hull planking · 24 strakes",
  },
  {
    id: "pitch",
    title: "Pitch within and without",
    description:
      "The hull is coated with pitch, inside and out, to make it watertight. The Hebrew word for ‘pitch’ (kopher) shares its root with ‘atonement’ — a covering.",
    verses: [
      {
        ref: "Genesis 6:14",
        text: "…and shalt pitch it within and without with pitch.",
      },
    ],
    label: "Pitch · within and without",
    interpretive: "Drawn below the waterline outside, so the planking still reads above it; the text has the whole hull covered.",
  },
  {
    id: "decks",
    title: "Lower, second and third stories",
    description:
      "Two decks are laid across the frames — the middle deck and the main deck — giving three stories, each about nine cubits high: two in the hull, the third under the deckhouse.",
    verses: [
      {
        ref: "Genesis 6:16",
        text: "…with lower, second, and third stories shalt thou make it.",
      },
    ],
    label: "3 stories · decks at 11 & 20 cubits",
    measure: "3 stories",
    interpretive: "Equal story heights are assumed.",
  },
  {
    id: "rooms",
    title: "Rooms — ‘nests’",
    description:
      "Each story is divided into rooms — literally ‘nests’ (qinnim) — along a central aisle, ready for animals and stores.",
    verses: [
      {
        ref: "Genesis 6:14",
        text: "…rooms shalt thou make in the ark…",
      },
    ],
    label: "Rooms · qinnim",
    interpretive: "Room size and layout are not given.",
  },
  {
    id: "roof",
    title: "The roof and the window",
    description:
      "A long deckhouse of upright boards holds the third story; its gabled roof is raised on posts, leaving an opening a cubit high all the way round beneath it — one reading of the ‘window’ finished a cubit from the top, which lets in light and air.",
    verses: [
      {
        ref: "Genesis 6:16",
        text: "A window shalt thou make to the ark, and in a cubit shalt thou finish it above…",
      },
    ],
    label: "Window · a cubit beneath the roof",
    measure: "1 cubit",
    interpretive: "The window’s form is debated; a continuous 1-cubit opening is one reading. The deckhouse is a reading too.",
  },
  {
    id: "door",
    title: "The door in the side",
    description:
      "One door, set in the side of the ark. Here it opens at the second story and lowers as a ramp for the animals to walk up.",
    verses: [
      {
        ref: "Genesis 6:16",
        text: "…and the door of the ark shalt thou set in the side thereof…",
      },
    ],
    label: "Door in the side",
    interpretive: "Door size, level and the ramp are readings.",
  },
  {
    id: "provisions",
    title: "Food for all",
    description:
      "Noah gathers food for his family and for every creature, stowed in the rooms of the upper story.",
    verses: [
      {
        ref: "Genesis 6:21",
        text: "And take thou unto thee of all food that is eaten, and thou shalt gather it to thee; and it shall be for food for thee, and for them.",
      },
      {
        ref: "Genesis 6:22",
        text: "Thus did Noah; according to all that God commanded him, so did he.",
      },
    ],
    label: "Stores of food",
  },
  {
    id: "animals",
    title: "Two and two",
    description:
      "The animals come to Noah two by two, male and female — of the clean beasts and birds, seven pairs. Then the LORD shuts him in.",
    verses: [
      {
        ref: "Genesis 6:19",
        text: "And of every living thing of all flesh, two of every sort shalt thou bring into the ark, to keep them alive with thee; they shall be male and female.",
      },
      {
        ref: "Genesis 7:9",
        text: "There went in two and two unto Noah into the ark, the male and the female, as God had commanded Noah.",
      },
      { ref: "Genesis 7:16", text: "…and the LORD shut him in." },
    ],
    label: "Two of every sort",
  },
  {
    id: "flood",
    title: "The waters bear up the ark",
    description:
      "Forty days of rain. The waters rise, lift the ark off the ground, and it floats on the face of the waters.",
    verses: [
      {
        ref: "Genesis 7:17",
        text: "And the flood was forty days upon the earth; and the waters increased, and bare up the ark, and it was lift up above the earth.",
      },
      {
        ref: "Genesis 7:18",
        text: "And the waters prevailed, and were increased greatly upon the earth; and the ark went upon the face of the waters.",
      },
    ],
    label: "The waters prevailed",
    interpretive: "Waterline (draft) is a reading.",
  },
] as const;

export type NoahStepId = (typeof NOAH_STEPS)[number]["id"];

const S = Object.fromEntries(NOAH_STEPS.map((s, i) => [s.id, i])) as Record<
  NoahStepId,
  number
>;

// section above (u = x, v = −y), plan below (v = PLAN − z)
const PLAN = 68;
const E = (x0: number, x1: number, y0: number, y1: number) => ({
  x: x0,
  y: -y1,
  w: x1 - x0,
  h: y1 - y0,
});
const P = (x0: number, x1: number, z0: number, z1: number) => ({
  x: x0,
  y: PLAN - z1,
  w: x1 - x0,
  h: z1 - z0,
});
const { L, W, decks, door } = N;

/** Looking north from the south side, east (−x) is on the right: draw u = −x. */
function mirror(list: BlueprintEl[]): BlueprintEl[] {
  return list.map((e): BlueprintEl => {
    switch (e.kind) {
      case "rect":
        return { ...e, x: -(e.x + e.w) };
      case "circle":
        return { ...e, cx: -e.cx };
      case "line":
        return { ...e, pts: e.pts.map(([x, y]) => [-x, y] as const) };
      case "text":
        return {
          ...e,
          x: -e.x,
          anchor: e.anchor === "start" ? "end" : e.anchor === "end" ? "start" : e.anchor,
        };
      case "dim":
        return { ...e, a: [-e.b[0], e.b[1]], b: [-e.a[0], e.a[1]] };
    }
  });
}

const els: BlueprintEl[] = mirror([
  // section
  { kind: "rect", ...E(-L / 2, L / 2, 0.8, 2.8), step: S.keel, fill: true },
  ...Array.from({ length: 21 }, (_, i): BlueprintEl => ({
    kind: "line",
    pts: [
      [-L / 2 + 15 * i, -2.8],
      [-L / 2 + 15 * i, -29],
    ],
    step: S.frames,
    tone: "faint",
  })),
  { kind: "rect", ...E(-L / 2, L / 2, 2, 29), step: S.planking },
  { kind: "rect", ...E(-L / 2 - 0.8, L / 2 + 0.8, 1.6, 29), step: S.pitch, tone: "gold" },
  ...[11, 20].map(
    (y): BlueprintEl => ({ kind: "line", pts: [[-L / 2, -y], [L / 2, -y]], step: S.decks, width: 2 }),
  ),
  ...decks.map(
    (y, i): BlueprintEl => ({
      kind: "text",
      x: -L / 2 + 4,
      y: -y - 4,
      text: ["LOWER", "SECOND", "THIRD"][i],
      step: S.decks,
      size: 9,
      anchor: "start",
    }),
  ),
  ...decks.flatMap((y) =>
    Array.from({ length: 15 }, (_, i): BlueprintEl => ({
      kind: "line",
      pts: [
        [-140 + 20 * i, -y],
        [-140 + 20 * i, -y - 5],
      ],
      step: S.rooms,
      tone: "faint",
    })),
  ),
  { kind: "line", pts: [[-L / 2 - 1, -30], [0, -32], [L / 2 + 1, -30]], step: S.roof, width: 2 },
  { kind: "rect", ...E(-L / 2, L / 2, 29, 30), step: S.roof, tone: "gold", dashed: true },
  { kind: "text", x: L / 2 - 2, y: -35, text: "WINDOW · 1 CUBIT", step: S.roof, size: 11, anchor: "end", tone: "gold" },
  { kind: "rect", ...E(door.x - 4, door.x + 4, door.y0, door.y1), step: S.door, tone: "gold", fill: true },
  { kind: "text", x: door.x, y: -door.y0 + 3.5, text: "DOOR", step: S.door, size: 9, tone: "gold" },
  ...decks.flatMap((y) =>
    [-10, 30, 70, 110].map(
      (x): BlueprintEl => ({ kind: "circle", cx: x, cy: -y - 2, r: 1.6, step: S.animals, tone: "gold", fill: true }),
    ),
  ),
  { kind: "line", pts: [[-168, -N.water], [168, -N.water]], step: S.flood, tone: "gold", dashed: true, width: 2 },
  { kind: "text", x: -60, y: -N.water - 2, text: "WATERLINE", step: S.flood, size: 9, tone: "gold" },
  { kind: "dim", a: [-L / 2, 0], b: [L / 2, 0], text: "300 cubits", step: S.keel, offset: 8 },
  { kind: "dim", a: [L / 2, 0], b: [L / 2, -N.H], text: "30", step: S.planking, offset: 10 },
  { kind: "text", x: -L / 2, y: -42, text: "LONGITUDINAL SECTION · LOOKING NORTH", step: 0, size: 11, anchor: "start" },
  // plan
  { kind: "rect", ...P(-L / 2, L / 2, -W / 2, W / 2), step: S.planking },
  { kind: "line", pts: [[-L / 2, PLAN - 8], [L / 2, PLAN - 8]], step: S.rooms, dashed: true, tone: "faint" },
  { kind: "line", pts: [[-L / 2, PLAN + 8], [L / 2, PLAN + 8]], step: S.rooms, dashed: true, tone: "faint" },
  ...Array.from({ length: 15 }, (_, i): BlueprintEl => ({
    kind: "line",
    pts: [
      [-140 + 20 * i, PLAN - W / 2],
      [-140 + 20 * i, PLAN - 8],
    ],
    step: S.rooms,
    tone: "faint",
  })),
  ...Array.from({ length: 15 }, (_, i): BlueprintEl => ({
    kind: "line",
    pts: [
      [-140 + 20 * i, PLAN + 8],
      [-140 + 20 * i, PLAN + W / 2],
    ],
    step: S.rooms,
    tone: "faint",
  })),
  { kind: "rect", ...P(door.x - 4, door.x + 4, -W / 2 - 1.5, -W / 2), step: S.door, tone: "gold", fill: true },
  { kind: "dim", a: [L / 2, PLAN - W / 2], b: [L / 2, PLAN + W / 2], text: "50", step: S.planking, offset: 10 },
  { kind: "text", x: 0, y: PLAN + 1.5, text: "AISLE", step: S.rooms, size: 11, tone: "faint" },
  { kind: "text", x: -L / 2, y: PLAN - W / 2 - 7, text: "PLAN", step: 0, size: 11, anchor: "start" },
]);

export const NOAH_BUILD: BuildInfo = {
  title: "Noah’s Ark",
  steps: NOAH_STEPS,
  env: "deluge",
  blueprint: {
    title: "NOAH’S ARK",
    subtitle: "Genesis 6:14–16 · grid = 10 cubits",
    view: "Section & plan",
    viewBox: [-172, -52, 344, 150],
    up: "N",
    grid: 10,
    els,
  },
};
