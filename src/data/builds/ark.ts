import type { BlueprintEl, BuildInfo } from "./types";

/**
 * Ark of the Covenant, Exodus 25:10–22 / 37:1–9.
 * World: x along the length (2½), z across (1½), y up. 1 unit = 1 cubit.
 */

const L = 2.5;
const W = 1.5;
const H = 1.5;

export const ARK_STEPS = [
  {
    id: "chest",
    title: "An ark of acacia wood",
    description:
      "Bezalel starts with a plain open chest of shittim (acacia) wood — a floor and four walls. Two and a half cubits long, a cubit and a half wide and high: roughly 45 × 27 × 27 inches, small enough for four Levites to carry.",
    verses: [
      {
        ref: "Exodus 25:10",
        text: "And they shall make an ark of shittim wood: two cubits and a half shall be the length thereof, and a cubit and a half the breadth thereof, and a cubit and a half the height thereof.",
      },
      { ref: "Exodus 37:1", text: "And Bezaleel made the ark of shittim wood…" },
    ],
    label: "Acacia chest · 2½ × 1½ × 1½ cubits",
    measure: "2½ × 1½ × 1½ cubits",
  },
  {
    id: "overlay",
    title: "Overlay with pure gold",
    description:
      "The wood disappears under pure gold — inside as well as out, so that nothing of the plain chest shows. The overlay rises up the walls and lines the floor.",
    verses: [
      {
        ref: "Exodus 25:11",
        text: "And thou shalt overlay it with pure gold, within and without shalt thou overlay it…",
      },
    ],
    label: "Pure gold · within and without",
    interpretive: "Thickness of the overlay is not given; drawn as a thin skin.",
  },
  {
    id: "crown",
    title: "A crown of gold round about",
    description:
      "A gold moulding — the ‘crown’ — runs around the top edge, framing the lid that will sit inside it.",
    verses: [
      {
        ref: "Exodus 25:11",
        text: "…and shalt make upon it a crown of gold round about.",
      },
    ],
    label: "Crown · gold moulding",
    interpretive: "Profile of the moulding is a reading.",
  },
  {
    id: "rings",
    title: "Four rings of gold",
    description:
      "Four cast-gold rings, two on each side, set low at the corners (the Hebrew can mean ‘feet’). They will carry the poles.",
    verses: [
      {
        ref: "Exodus 25:12",
        text: "And thou shalt cast four rings of gold for it, and put them in the four corners thereof; and two rings shall be in the one side of it, and two rings in the other side of it.",
      },
    ],
    label: "4 rings · cast gold",
    interpretive: "Ring height and the poles running lengthwise are readings.",
  },
  {
    id: "staves",
    title: "Staves of acacia, overlaid with gold",
    description:
      "Two acacia poles, gold-covered, slide through the rings. They are never removed — the ark is not to be touched, only carried by its staves.",
    verses: [
      {
        ref: "Exodus 25:13–14",
        text: "And thou shalt make staves of shittim wood, and overlay them with gold. And thou shalt put the staves into the rings by the sides of the ark, that the ark may be borne with them.",
      },
      {
        ref: "Exodus 25:15",
        text: "The staves shall be in the rings of the ark: they shall not be taken from it.",
      },
    ],
    label: "Staves · acacia overlaid with gold",
    measure: "≈4 cubits (length not given)",
    interpretive: "Pole length is not given; ≈4 cubits.",
  },
  {
    id: "testimony",
    title: "The testimony inside",
    description:
      "Into the chest go the two tablets of stone ‘written with the finger of God’. Hebrews adds the golden pot of manna and Aaron’s rod; by Solomon’s day only the tablets remained (1 Kings 8:9).",
    verses: [
      {
        ref: "Exodus 25:16",
        text: "And thou shalt put into the ark the testimony which I shall give thee.",
      },
      {
        ref: "Exodus 31:18",
        text: "…two tables of testimony, tables of stone, written with the finger of God.",
      },
    ],
    label: "Two tablets of stone",
    interpretive: "Tablet size is not given.",
  },
  {
    id: "mercy-seat",
    title: "The mercy seat",
    description:
      "The lid — kapporet, the place of atonement — is solid pure gold, the full length and breadth of the ark. On the Day of Atonement blood is sprinkled here (Leviticus 16:14).",
    verses: [
      {
        ref: "Exodus 25:17",
        text: "And thou shalt make a mercy seat of pure gold: two cubits and a half shall be the length thereof, and a cubit and a half the breadth thereof.",
      },
      {
        ref: "Exodus 25:21",
        text: "And thou shalt put the mercy seat above upon the ark…",
      },
    ],
    label: "Mercy seat · pure gold · 2½ × 1½",
    measure: "2½ × 1½ cubits",
  },
  {
    id: "cherub-a",
    title: "One cherub on the one end",
    description:
      "The cherubim are beaten out of the same gold as the mercy seat — one piece with it. The first rises at the east end, wings lifted.",
    verses: [
      {
        ref: "Exodus 25:18–19",
        text: "And thou shalt make two cherubims of gold, of beaten work shalt thou make them, in the two ends of the mercy seat. And make one cherub on the one end, and the other cherub on the other end…",
      },
    ],
    label: "Cherub · beaten gold",
    interpretive: "Cherub form and size are not described; kneeling figures here.",
  },
  {
    id: "cherub-b",
    title: "The other cherub, facing",
    description:
      "The second cherub faces the first. Their wings stretch up and forward to overshadow the mercy seat; their faces look down toward it.",
    verses: [
      {
        ref: "Exodus 25:20",
        text: "And the cherubims shall stretch forth their wings on high, covering the mercy seat with their wings, and their faces shall look one to another; toward the mercy seat shall the faces of the cherubims be.",
      },
    ],
    label: "Wings stretched on high",
  },
  {
    id: "meeting",
    title: "“There I will meet with thee”",
    description:
      "The finished ark is the meeting place: God speaks to Moses from above the mercy seat, between the cherubim — the throne of the LORD of hosts who ‘dwelleth between the cherubims’ (1 Samuel 4:4).",
    verses: [
      {
        ref: "Exodus 25:22",
        text: "And there I will meet with thee, and I will commune with thee from above the mercy seat, from between the two cherubims which are upon the ark of the testimony…",
      },
    ],
    label: "Between the cherubim",
  },
] as const;

export type ArkStepId = (typeof ARK_STEPS)[number]["id"];

// blueprint: side elevation above (u = x, v = −y), plan below (v = PLAN − z)
const PLAN = 2.6;
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

const els: BlueprintEl[] = [
  // elevation
  { kind: "rect", ...E(-L / 2, L / 2, 0, H), step: 0 },
  { kind: "rect", ...E(-L / 2 - 0.02, L / 2 + 0.02, 0, H), step: 1, tone: "gold" },
  { kind: "rect", ...E(-L / 2 - 0.06, L / 2 + 0.06, H - 0.08, H), step: 2, tone: "gold", fill: true },
  ...[-1, 1].map(
    (s): BlueprintEl => ({ kind: "circle", cx: s * (L / 2 - 0.25), cy: -0.35, r: 0.1, step: 3, tone: "gold" }),
  ),
  { kind: "line", pts: [[-2, -0.35], [2, -0.35]], step: 4, tone: "gold", width: 2 },
  { kind: "rect", ...E(-0.45, -0.05, 0.1, 1.0), step: 5, dashed: true },
  { kind: "rect", ...E(0.05, 0.45, 0.1, 1.0), step: 5, dashed: true },
  { kind: "rect", ...E(-L / 2, L / 2, H, H + 0.1), step: 6, tone: "gold", fill: true },
  {
    kind: "line",
    pts: [[-0.95, -(H + 0.1)], [-0.95, -(H + 0.75)], [-0.2, -(H + 1.15)]],
    step: 7,
    tone: "gold",
    width: 2,
  },
  {
    kind: "line",
    pts: [[0.95, -(H + 0.1)], [0.95, -(H + 0.75)], [0.2, -(H + 1.15)]],
    step: 8,
    tone: "gold",
    width: 2,
  },
  { kind: "circle", cx: 0, cy: -(H + 0.5), r: 0.18, step: 9, tone: "gold", fill: true },
  { kind: "dim", a: [-L / 2, 0], b: [L / 2, 0], text: "2½ cubits", step: 0, offset: 0.35 },
  { kind: "dim", a: [L / 2, 0], b: [L / 2, -H], text: "1½", step: 0, offset: 0.55 },
  { kind: "text", x: 0, y: -1.24, text: "TESTIMONY", step: 5, size: 9 },
  { kind: "text", x: 0, y: -(H + 1.45), text: "MERCY SEAT · CHERUBIM", step: 6, size: 14, tone: "gold" },
  { kind: "text", x: -L / 2 - 0.2, y: -2.75, text: "SIDE ELEVATION", step: 0, size: 13, anchor: "start" },
  // plan
  { kind: "rect", ...P(-L / 2, L / 2, -W / 2, W / 2), step: 0 },
  { kind: "rect", ...P(-L / 2 - 0.06, L / 2 + 0.06, -W / 2 - 0.06, W / 2 + 0.06), step: 2, tone: "gold" },
  ...[-1, 1].flatMap((sx) =>
    [-1, 1].map(
      (sz): BlueprintEl => ({
        kind: "circle",
        cx: sx * (L / 2 - 0.25),
        cy: PLAN - sz * (W / 2 + 0.08),
        r: 0.09,
        step: 3,
        tone: "gold",
      }),
    ),
  ),
  ...[-1, 1].map(
    (s): BlueprintEl => ({
      kind: "line",
      pts: [[-2, PLAN - s * (W / 2 + 0.08)], [2, PLAN - s * (W / 2 + 0.08)]],
      step: 4,
      tone: "gold",
      width: 2,
    }),
  ),
  { kind: "rect", ...P(-1.15, -0.65, -0.5, 0.5), step: 7, tone: "gold" },
  { kind: "rect", ...P(0.65, 1.15, -0.5, 0.5), step: 8, tone: "gold" },
  { kind: "dim", a: [-L / 2, PLAN + W / 2], b: [L / 2, PLAN + W / 2], text: "2½ cubits", step: 0, offset: 0.45 },
  { kind: "dim", a: [-L / 2, PLAN - W / 2], b: [-L / 2, PLAN + W / 2], text: "1½", step: 0, offset: 0.4 },
  { kind: "text", x: -L / 2 - 0.2, y: PLAN - 1.25, text: "PLAN", step: 0, size: 13, anchor: "start" },
  { kind: "text", x: 2.05, y: PLAN - 0.6, text: "STAVES", step: 4, size: 12, anchor: "start", tone: "gold" },
];

export const ARK_BUILD: BuildInfo = {
  title: "Ark of the Covenant",
  steps: ARK_STEPS,
  env: "sanctuary",
  blueprint: {
    title: "THE ARK OF THE COVENANT",
    subtitle: "Exodus 25:10–22 · grid = ½ cubit",
    view: "Elevation & plan",
    viewBox: [-3.4, -3.1, 6.8, 7.6],
    up: "",
    grid: 0.5,
    els,
  },
};

export const ARK_DIMS = { L, W, H };
