import type { BlueprintEl, BuildInfo, WalkStop } from "./types";

/**
 * The wilderness Tabernacle, Exodus 26–27, raised in the order of Exodus 40.
 * World: −x east (the gate), +x west (the most holy place); +z north.
 * The south wall of the tent and the south half of its coverings are drawn
 * cut away so the furniture inside can be seen.
 */
export const TB = {
  court: { x0: -50, x1: 50, z: 25, gate: 10 },
  tent: { x0: 10, x1: 40, z: 5 },
  veilX: 30,
  /** board thickness — not given in Exodus; interpretive */
  bt: 0.75,
  sock: 0.75,
  boardH: 10,
  altarX: -15,
  laverX: -2,
} as const;

export const TABERNACLE_STEPS = [
  {
    id: "sockets",
    title: "A hundred sockets of silver",
    description:
      "On the first day of the first month of the second year, Moses rears up the tabernacle — starting with its foundation: silver sockets, two under every board, and four more for the pillars of the veil. Each is cast from a talent of silver.",
    verses: [
      {
        ref: "Exodus 40:17–18",
        text: "…the tabernacle was reared up. And Moses reared up the tabernacle, and fastened his sockets…",
      },
      {
        ref: "Exodus 38:27",
        text: "And of the hundred talents of silver were cast the sockets of the sanctuary, and the sockets of the vail; an hundred sockets of the hundred talents, a talent for a socket.",
      },
    ],
    label: "100 sockets · a talent of silver each",
    measure: "100 sockets",
    interpretive: "Socket size is not given.",
  },
  {
    id: "boards",
    title: "Forty-eight boards of acacia",
    description:
      "Upright boards of acacia overlaid with gold, ten cubits by a cubit and a half, their two tenons dropped into the sockets: twenty on the south, twenty on the north, six plus two corner boards on the west. The tent is thirty cubits long, ten wide and ten high. (South boards cut short here.)",
    verses: [
      {
        ref: "Exodus 26:15–16",
        text: "And thou shalt make boards for the tabernacle of shittim wood standing up. Ten cubits shall be the length of a board, and a cubit and a half shall be the breadth of one board.",
      },
      {
        ref: "Exodus 26:29",
        text: "And thou shalt overlay the boards with gold…",
      },
    ],
    label: "48 boards · 10 × 1½ cubits",
    measure: "30 × 10 × 10 cubits",
    interpretive: "Board thickness (¾ cubit here) is not given.",
  },
  {
    id: "bars",
    title: "Bars through gold rings",
    description:
      "Five gold-covered acacia bars on each side lock the boards together. The middle bar runs the full length through the boards themselves.",
    verses: [
      {
        ref: "Exodus 26:26",
        text: "And thou shalt make bars of shittim wood; five for the boards of the one side of the tabernacle,",
      },
      {
        ref: "Exodus 26:28",
        text: "And the middle bar in the midst of the boards shall reach from end to end.",
      },
    ],
    label: "Bars · 5 per side",
  },
  {
    id: "pillars",
    title: "Pillars for the veil and the door",
    description:
      "Four gold-covered pillars on silver sockets will carry the veil; five at the entrance, on sockets of bronze, will carry the door hanging.",
    verses: [
      {
        ref: "Exodus 40:18",
        text: "…and put in the bars thereof, and reared up his pillars.",
      },
      {
        ref: "Exodus 26:32",
        text: "And thou shalt hang it upon four pillars of shittim wood overlaid with gold: their hooks shall be of gold, upon the four sockets of silver.",
      },
      {
        ref: "Exodus 26:37",
        text: "And thou shalt make for the hanging five pillars of shittim wood… and thou shalt cast five sockets of brass for them.",
      },
    ],
    label: "4 + 5 pillars",
  },
  {
    id: "linen",
    title: "Ten curtains of linen and cherubim",
    description:
      "The tabernacle proper is a fabric: ten curtains of fine twined linen in blue, purple and scarlet, worked with cherubim, joined into one by fifty gold clasps. From inside, this is the ceiling the priests see.",
    verses: [
      {
        ref: "Exodus 26:1",
        text: "Moreover thou shalt make the tabernacle with ten curtains of fine twined linen, and blue, and purple, and scarlet: with cherubims of cunning work shalt thou make them.",
      },
      {
        ref: "Exodus 26:6",
        text: "And thou shalt make fifty taches of gold, and couple the curtains together with the taches: and it shall be one tabernacle.",
      },
    ],
    label: "10 curtains · 28 × 4 cubits",
    measure: "each 28 × 4 cubits",
  },
  {
    id: "goathair",
    title: "The tent of goats’ hair",
    description:
      "Over the linen goes the ‘tent’: eleven curtains of black goats’ hair, each thirty cubits long — long enough to reach the ground on either side.",
    verses: [
      {
        ref: "Exodus 26:7–8",
        text: "And thou shalt make curtains of goats' hair to be a covering upon the tabernacle: eleven curtains shalt thou make. The length of one curtain shall be thirty cubits, and the breadth of one curtain four cubits…",
      },
      {
        ref: "Exodus 40:19",
        text: "And he spread abroad the tent over the tabernacle…",
      },
    ],
    label: "11 curtains · goats’ hair · 30 × 4",
    measure: "each 30 × 4 cubits",
  },
  {
    id: "coverings",
    title: "Rams’ skins dyed red, and a covering above",
    description:
      "Two outer coverings keep out the weather: rams’ skins dyed red, then on top a covering of tachash skins (KJV ‘badgers’’; perhaps sea-cow or fine leather).",
    verses: [
      {
        ref: "Exodus 26:14",
        text: "And thou shalt make a covering for the tent of rams' skins dyed red, and a covering above of badgers' skins.",
      },
      {
        ref: "Exodus 40:19",
        text: "…and put the covering of the tent above upon it; as the LORD commanded Moses.",
      },
    ],
    label: "Rams’ skins · tachash skins",
    interpretive: "Their sizes are not given.",
  },
  {
    id: "ark",
    title: "The ark, and the veil",
    description:
      "Moses puts the testimony in the ark, sets the mercy seat on it, and brings it into the tabernacle. Then he hangs the veil on its four pillars — dividing a ten-cubit cube, the most holy place, from the holy place.",
    verses: [
      {
        ref: "Exodus 40:20–21",
        text: "And he took and put the testimony into the ark… And he brought the ark into the tabernacle, and set up the vail of the covering, and covered the ark of the testimony…",
      },
      {
        ref: "Exodus 26:33",
        text: "…and the vail shall divide unto you between the holy place and the most holy.",
      },
    ],
    label: "Ark & veil · most holy place 10 × 10 × 10",
    measure: "10 × 10 × 10 cubits",
  },
  {
    id: "table",
    title: "The table, northward",
    description:
      "In the holy place, on the north side, the table of the Presence with its twelve loaves set in order.",
    verses: [
      {
        ref: "Exodus 40:22–23",
        text: "And he put the table in the tent of the congregation, upon the side of the tabernacle northward, without the vail. And he set the bread in order upon it before the LORD…",
      },
    ],
    label: "Table · 2 × 1 × 1½ · north",
    measure: "2 × 1 × 1½ cubits",
  },
  {
    id: "lampstand",
    title: "The lampstand, southward",
    description:
      "Opposite the table, on the south side, the seven-branched lampstand of beaten gold. Moses lights its lamps — the only light in the holy place.",
    verses: [
      {
        ref: "Exodus 40:24–25",
        text: "And he put the candlestick in the tent of the congregation, over against the table, on the side of the tabernacle southward. And he lighted the lamps before the LORD…",
      },
    ],
    label: "Lampstand · beaten gold · south",
    interpretive: "Its height is not given.",
  },
  {
    id: "incense",
    title: "The golden altar before the veil",
    description:
      "The altar of incense stands before the veil, and sweet incense is burned on it.",
    verses: [
      {
        ref: "Exodus 40:26–27",
        text: "And he put the golden altar in the tent of the congregation before the vail: And he burnt sweet incense thereon…",
      },
    ],
    label: "Golden altar · 1 × 1 × 2",
    measure: "1 × 1 × 2 cubits",
  },
  {
    id: "door",
    title: "The hanging at the door",
    description:
      "A screen of blue, purple and scarlet needlework closes the east end of the tent, hung on its five pillars.",
    verses: [
      {
        ref: "Exodus 40:28",
        text: "And he set up the hanging at the door of the tabernacle.",
      },
    ],
    label: "Door hanging · blue, purple, scarlet",
  },
  {
    id: "altar",
    title: "The altar of burnt offering",
    description:
      "Outside, by the door of the tent, the bronze altar: five cubits square, three high, with horns and a bronze grating.",
    verses: [
      {
        ref: "Exodus 40:29",
        text: "And he put the altar of burnt offering by the door of the tabernacle of the tent of the congregation, and offered upon it the burnt offering…",
      },
      {
        ref: "Exodus 27:1",
        text: "…five cubits long, and five cubits broad; the altar shall be foursquare: and the height thereof shall be three cubits.",
      },
    ],
    label: "Bronze altar · 5 × 5 × 3",
    measure: "5 × 5 × 3 cubits",
  },
  {
    id: "laver",
    title: "The laver",
    description:
      "Between the tent and the altar, the bronze laver and its stand, filled with water for the priests to wash hands and feet.",
    verses: [
      {
        ref: "Exodus 40:30",
        text: "And he set the laver between the tent of the congregation and the altar, and put water there, to wash withal.",
      },
    ],
    label: "Laver · bronze",
    interpretive: "No dimensions are given.",
  },
  {
    id: "court",
    title: "The court: 100 × 50 cubits",
    description:
      "Sixty pillars on bronze sockets, with silver hooks and capitals, carry five-cubit linen hangings around a court a hundred cubits by fifty.",
    verses: [
      {
        ref: "Exodus 40:33",
        text: "And he reared up the court round about the tabernacle and the altar…",
      },
      {
        ref: "Exodus 27:18",
        text: "The length of the court shall be an hundred cubits, and the breadth fifty every where, and the height five cubits of fine twined linen, and their sockets of brass.",
      },
    ],
    label: "Court · 60 pillars · 100 × 50",
    measure: "100 × 50 × 5 cubits",
  },
  {
    id: "gate",
    title: "The gate of the court",
    description:
      "The only way in: a twenty-cubit screen of blue, purple and scarlet on the east side. ‘So Moses finished the work.’",
    verses: [
      {
        ref: "Exodus 27:16",
        text: "And for the gate of the court shall be an hanging of twenty cubits, of blue, and purple, and scarlet, and fine twined linen, wrought with needlework…",
      },
      {
        ref: "Exodus 40:33",
        text: "…and set up the hanging of the court gate. So Moses finished the work.",
      },
    ],
    label: "Gate · 20 cubits",
    measure: "20 cubits",
  },
  {
    id: "cloud",
    title: "The cloud and the glory",
    description:
      "The cloud covers the tent, and the glory of the LORD fills the tabernacle — a cloud by day and fire by night over Israel through all their journeys.",
    verses: [
      {
        ref: "Exodus 40:34",
        text: "Then a cloud covered the tent of the congregation, and the glory of the LORD filled the tabernacle.",
      },
      {
        ref: "Exodus 40:38",
        text: "For the cloud of the LORD was upon the tabernacle by day, and fire was on it by night, in the sight of all the house of Israel…",
      },
    ],
    label: "The glory of the LORD",
  },
] as const;

export type TabernacleStepId = (typeof TABERNACLE_STEPS)[number]["id"];

const S = Object.fromEntries(TABERNACLE_STEPS.map((s, i) => [s.id, i])) as Record<
  TabernacleStepId,
  number
>;

// west up: plan x = world z, plan y = −world x
const R = (x0: number, x1: number, z0: number, z1: number) => ({
  x: z0,
  y: -x1,
  w: z1 - z0,
  h: x1 - x0,
});
const at = (x: number, z: number) => [z, -x] as const;
const txt = (
  x: number,
  z: number,
  text: string,
  step: number,
  more: Partial<Extract<BlueprintEl, { kind: "text" }>> = {},
): BlueprintEl => {
  const [px, py] = at(x, z);
  return { kind: "text", x: px, y: py, text, step, ...more };
};

const { court, tent, veilX, bt } = TB;

export const TABERNACLE_WALK: WalkStop[] = [
  {
    n: 1,
    name: "Gate",
    note: "The one entrance, on the east.",
    at: [-56, 0],
    eye: 3.6,
    look: [-15, 3, 0],
    plan: at(-56, 0),
  },
  {
    n: 2,
    name: "Bronze altar",
    note: "Sacrifice comes first.",
    at: [-23, -7],
    eye: 3.6,
    look: [-15, 2, 0],
    plan: at(-23, -7),
  },
  {
    n: 3,
    name: "Laver",
    note: "Then washing.",
    at: [-6, -5],
    eye: 3.6,
    look: [-2, 1.5, 0],
    plan: at(-6, -5),
  },
  {
    n: 4,
    name: "Door",
    note: "The hanging at the door of the tent.",
    at: [4, 0],
    eye: 3.6,
    look: [20, 4, 0],
    plan: at(4, 0),
  },
  {
    n: 5,
    name: "Holy place",
    note: "Table to the north, lampstand to the south, the golden altar ahead.",
    at: [13, 0],
    eye: 3.6,
    look: [28, 2.5, 0],
    plan: at(13, 0),
  },
  {
    n: 6,
    name: "Most holy",
    note: "The ark behind the veil.",
    at: [31.5, -3],
    eye: 3.4,
    look: [35, 1.5, 0],
    plan: at(31.5, -3),
  },
];

const tz = tent.z;
const perimeter: [number, number][] = [];
for (let i = 0; i < 60; i++) {
  const d = i * 5;
  if (d < 100) perimeter.push([court.x0 + d, -court.z]);
  else if (d < 150) perimeter.push([court.x1, -court.z + (d - 100)]);
  else if (d < 250) perimeter.push([court.x1 - (d - 150), court.z]);
  else perimeter.push([court.x0, court.z - (d - 250)]);
}
export const COURT_PILLARS = perimeter;

const els: BlueprintEl[] = [
  { kind: "line", pts: [at(tent.x0, tz + bt / 2), at(tent.x1, tz + bt / 2)], step: S.sockets, dashed: true },
  { kind: "line", pts: [at(tent.x0, -tz - bt / 2), at(tent.x1, -tz - bt / 2)], step: S.sockets, dashed: true },
  { kind: "line", pts: [at(tent.x1 + bt / 2, -tz), at(tent.x1 + bt / 2, tz)], step: S.sockets, dashed: true },
  { kind: "rect", ...R(tent.x0, tent.x1 + bt, tz, tz + bt), step: S.boards, fill: true },
  { kind: "rect", ...R(tent.x0, tent.x1 + bt, -tz - bt, -tz), step: S.boards, fill: true },
  { kind: "rect", ...R(tent.x1, tent.x1 + bt, -tz, tz), step: S.boards, fill: true },
  { kind: "dim", a: at(tent.x0, -tz - bt), b: at(tent.x1, -tz - bt), text: "30", step: S.boards, offset: -3 },
  { kind: "line", pts: [at(tent.x0, tz + 1.1), at(tent.x1 + 1.1, tz + 1.1), at(tent.x1 + 1.1, -tz - 1.1)], step: S.bars, tone: "gold" },
  ...[-3.75, -1.25, 1.25, 3.75].map(
    (z): BlueprintEl => ({ kind: "circle", cx: z, cy: -veilX, r: 0.35, step: S.pillars, tone: "gold", fill: true }),
  ),
  ...[-4, -2, 0, 2, 4].map(
    (z): BlueprintEl => ({ kind: "circle", cx: z, cy: -tent.x0, r: 0.35, step: S.pillars, tone: "gold", fill: true }),
  ),
  { kind: "rect", ...R(tent.x0, tent.x1 + 1.4, -tz - 1.4, tz + 1.4), step: S.linen, tone: "gold", dashed: true },
  { kind: "rect", ...R(tent.x0 - 0.5, tent.x1 + 1.8, -tz - 1.8, tz + 1.8), step: S.goathair, tone: "faint", dashed: true },
  { kind: "rect", ...R(tent.x0 - 0.5, tent.x1 + 2.2, -tz - 2.2, tz + 2.2), step: S.coverings, tone: "faint", dashed: true },
  { kind: "line", pts: [at(veilX, -tz), at(veilX, tz)], step: S.ark, tone: "gold", width: 3 },
  { kind: "rect", ...R(33.75, 36.25, -0.75, 0.75), step: S.ark, tone: "gold", fill: true },
  txt(38.3, 0, "MOST HOLY", S.ark, { size: 12, tone: "gold" }),
  txt(15.5, 0, "HOLY PLACE", S.boards, { size: 12 }),
  { kind: "rect", ...R(19, 21, 2, 3), step: S.table, tone: "gold", fill: true },
  txt(23, 2.5, "TABLE", S.table, { size: 9, tone: "gold" }),
  { kind: "circle", cx: -2.5, cy: -20, r: 0.6, step: S.lampstand, tone: "gold", fill: true },
  txt(23, -2.5, "LAMP", S.lampstand, { size: 9, tone: "gold" }),
  { kind: "rect", ...R(27.5, 28.5, -0.5, 0.5), step: S.incense, tone: "gold", fill: true },
  { kind: "line", pts: [at(tent.x0 - 0.2, -tz), at(tent.x0 - 0.2, tz)], step: S.door, tone: "gold", width: 3 },
  { kind: "rect", ...R(TB.altarX - 2.5, TB.altarX + 2.5, -2.5, 2.5), step: S.altar, tone: "gold", fill: true },
  txt(TB.altarX - 5, 0, "ALTAR", S.altar, { size: 12, tone: "gold" }),
  { kind: "circle", cx: 0, cy: -TB.laverX, r: 1.2, step: S.laver, tone: "gold" },
  txt(TB.laverX, 4.5, "LAVER", S.laver, { size: 11, tone: "gold", anchor: "start" }),
  {
    kind: "line",
    pts: [
      at(court.x0, -court.gate),
      at(court.x0, -court.z),
      at(court.x1, -court.z),
      at(court.x1, court.z),
      at(court.x0, court.z),
      at(court.x0, court.gate),
    ],
    step: S.court,
    width: 2,
  },
  ...perimeter.map(
    ([x, z]): BlueprintEl => ({ kind: "circle", cx: z, cy: -x, r: 0.4, step: S.court, fill: true }),
  ),
  { kind: "dim", a: at(court.x0, court.z), b: at(court.x1, court.z), text: "100 cubits", step: S.court, offset: -5 },
  { kind: "dim", a: at(court.x1, -court.z), b: at(court.x1, court.z), text: "50", step: S.court, offset: 5 },
  { kind: "line", pts: [at(court.x0, -court.gate), at(court.x0, court.gate)], step: S.gate, tone: "gold", width: 4 },
  txt(court.x0 - 3.5, 0, "GATE · 20", S.gate, { size: 12, tone: "gold" }),
  {
    kind: "line",
    pts: TABERNACLE_WALK.map((w) => w.plan),
    step: 0,
    tone: "gold",
    dashed: true,
    width: 2,
  },
];

export const TABERNACLE_BUILD: BuildInfo = {
  title: "The Tabernacle",
  steps: TABERNACLE_STEPS,
  env: "desert",
  walk: TABERNACLE_WALK,
  blueprint: {
    title: "THE TABERNACLE",
    subtitle: "Exodus 26–27, 40 · grid = 5 cubits",
    view: "Plan",
    viewBox: [-36, -58, 72, 122],
    up: "W",
    grid: 5,
    els,
  },
};
