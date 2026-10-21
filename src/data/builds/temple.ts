import type { BlueprintEl, BuildInfo, WalkStop } from "./types";

/**
 * Solomon's Temple, 1 Kings 6–8 / 2 Chronicles 3–4.
 * World: −x is east (the entrance), +x west (the Debir); +z north, −z south.
 * The south walls are drawn cut low so the interior reads as a section.
 */
export const T = {
  /** top of the raised foundation platform */
  F: 2,
  /** wall thickness — not given in Kings; interpretive */
  t: 1.5,
  /** interior of house (Hekal + Debir) */
  house: { x0: -30, x1: 30, z: 10, h: 30 },
  porch: { x0: -41.5, x1: -31.5 },
  debirX: 10,
  pillarX: -46,
  court: { x0: -100, x1: 55, z: 45, gate: 6 },
  altar: { x: -75, z: 0 },
  sea: { x: -62, z: -30 },
  laverXs: [-24, -12, 0, 12, 24],
  laverZ: 27,
} as const;

export const TEMPLE_STEPS = [
  {
    id: "foundation",
    title: "Great stones for the foundation",
    description:
      "In the fourth year of his reign Solomon begins. Quarried, costly, hewn stones are laid as a raised platform for the house, with steps up from the court on the east.",
    verses: [
      {
        ref: "1 Kings 5:17",
        text: "And the king commanded, and they brought great stones, costly stones, and hewed stones, to lay the foundation of the house.",
      },
      {
        ref: "1 Kings 6:1",
        text: "…in the fourth year of Solomon's reign over Israel, in the month Zif, which is the second month, that he began to build the house of the LORD.",
      },
    ],
    label: "Foundation · costly hewn stones",
    interpretive: "The platform’s height and extent are not given.",
  },
  {
    id: "walls",
    title: "The house: 60 × 20 × 30",
    description:
      "The walls rise in stone dressed at the quarry, so no hammer is heard on site. Inside: sixty cubits long, twenty wide, thirty high — the Hekal (holy place) and, at the west end, the Debir. The south wall is drawn cut low so you can see in.",
    verses: [
      {
        ref: "1 Kings 6:2",
        text: "And the house which king Solomon built for the LORD, the length thereof was threescore cubits, and the breadth thereof twenty cubits, and the height thereof thirty cubits.",
      },
      {
        ref: "1 Kings 6:7",
        text: "…built of stone made ready before it was brought thither: so that there was neither hammer nor axe nor any tool of iron heard in the house, while it was in building.",
      },
    ],
    label: "House · 60 × 20 × 30 cubits",
    measure: "60 × 20 × 30 cubits",
    interpretive: "Wall thickness (1½ cubits here) is not given.",
  },
  {
    id: "porch",
    title: "The Ulam — the porch",
    description:
      "Across the east front stands the porch, as wide as the house (twenty cubits) and ten deep. Its great opening faces the sunrise.",
    verses: [
      {
        ref: "1 Kings 6:3",
        text: "And the porch before the temple of the house, twenty cubits was the length thereof, according to the breadth of the house; and ten cubits was the breadth thereof before the house.",
      },
    ],
    label: "Ulam · porch · 20 × 10 cubits",
    measure: "20 × 10 cubits",
    interpretive:
      "Its height: 2 Chronicles 3:4 reads 120 cubits; drawn here at the house’s 30.",
  },
  {
    id: "chambers",
    title: "Side chambers, three storeys",
    description:
      "Store-chambers wrap the house in three storeys, each five cubits high. The house wall steps in at each floor, so the rooms widen as they rise — five, six, then seven cubits — and no beam is let into the sanctuary wall.",
    verses: [
      {
        ref: "1 Kings 6:6",
        text: "The nethermost chamber was five cubits broad, and the middle was six cubits broad, and the third was seven cubits broad: for without in the wall of the house he made narrowed rests round about…",
      },
      {
        ref: "1 Kings 6:10",
        text: "And then he built chambers against all the house, five cubits high: and they rested on the house with timber of cedar.",
      },
    ],
    label: "Side chambers · 5 · 6 · 7 cubits",
    measure: "3 storeys × 5 cubits",
    interpretive: "South range omitted for the cutaway.",
  },
  {
    id: "cedar",
    title: "Cedar within, fir underfoot, beams above",
    description:
      "Inside, every wall is panelled in cedar carved with gourds and open flowers — ‘there was no stone seen’. The floor is laid in fir, and the house is roofed with cedar beams and boards (half the roof is left off here).",
    verses: [
      {
        ref: "1 Kings 6:9",
        text: "So he built the house, and finished it; and covered the house with beams and boards of cedar.",
      },
      {
        ref: "1 Kings 6:15",
        text: "And he built the walls of the house within with boards of cedar… and covered the floor of the house with planks of fir.",
      },
      {
        ref: "1 Kings 6:18",
        text: "…all was cedar; there was no stone seen.",
      },
    ],
    label: "Cedar beams & lining",
  },
  {
    id: "debir",
    title: "The Debir — a perfect cube of gold",
    description:
      "At the west end a cedar partition closes off the oracle: twenty cubits every way, a cube, overlaid with pure gold, with chains of gold drawn across before it. The ten cubits above it are left as an upper room.",
    verses: [
      {
        ref: "1 Kings 6:19",
        text: "And the oracle he prepared in the house within, to set there the ark of the covenant of the LORD.",
      },
      {
        ref: "1 Kings 6:20",
        text: "And the oracle in the forepart was twenty cubits in length, and twenty cubits in breadth, and twenty cubits in the height thereof: and he overlaid it with pure gold…",
      },
      {
        ref: "1 Kings 6:21",
        text: "…and he made a partition by the chains of gold before the oracle…",
      },
    ],
    label: "Debir · 20 × 20 × 20 · pure gold",
    measure: "20 × 20 × 20 cubits",
  },
  {
    id: "cherubim",
    title: "Two cherubim of olive wood",
    description:
      "Two cherubim, each ten cubits high, carved from olive wood and overlaid with gold. Each wing is five cubits: outer wings touch the north and south walls, inner wings meet in the middle — together they span the full twenty.",
    verses: [
      {
        ref: "1 Kings 6:23",
        text: "And within the oracle he made two cherubims of olive tree, each ten cubits high.",
      },
      {
        ref: "1 Kings 6:27",
        text: "…the wing of the one touched the one wall, and the wing of the other cherub touched the other wall; and their wings touched one another in the midst of the house.",
      },
    ],
    label: "Cherubim · olive wood · 10 cubits",
    measure: "10 high · wingspan 20",
  },
  {
    id: "veil",
    title: "Olive-wood doors and the veil",
    description:
      "The way into the oracle: two olive-wood doors carved with cherubim, palms and open flowers, overlaid with gold — and, in Chronicles, a veil of blue, purple and crimson with cherubim worked into it.",
    verses: [
      {
        ref: "1 Kings 6:31–32",
        text: "And for the entering of the oracle he made doors of olive tree… he carved upon them carvings of cherubims and palm trees and open flowers, and overlaid them with gold…",
      },
      {
        ref: "2 Chronicles 3:14",
        text: "And he made the vail of blue, and purple, and crimson, and fine linen, and wrought cherubims thereon.",
      },
    ],
    label: "Veil · blue, purple, crimson",
    interpretive: "Door size and the veil’s exact hanging are readings.",
  },
  {
    id: "court",
    title: "The inner court",
    description:
      "Around the house runs the inner court, walled with three courses of hewn stone capped by a course of cedar beams. Its gate faces east.",
    verses: [
      {
        ref: "1 Kings 6:36",
        text: "And he built the inner court with three rows of hewed stone, and a row of cedar beams.",
      },
    ],
    label: "Inner court · 3 rows of stone + cedar",
    interpretive: "Kings gives no court dimensions; the size here is a reading.",
  },
  {
    id: "jachin",
    title: "Jachin — the right pillar",
    description:
      "Hiram of Tyre casts two hollow bronze pillars, eighteen cubits tall and twelve around, each crowned with a five-cubit capital of network, lily-work and two rows of pomegranates. The right-hand (south) pillar is named Jachin — ‘he shall establish’.",
    verses: [
      {
        ref: "1 Kings 7:15",
        text: "For he cast two pillars of brass, of eighteen cubits high apiece: and a line of twelve cubits did compass either of them about.",
      },
      {
        ref: "1 Kings 7:21",
        text: "And he set up the pillars in the porch of the temple: and he set up the right pillar, and called the name thereof Jachin…",
      },
    ],
    label: "Jachin · bronze pillar · 18 cubits",
    measure: "18 high · 12 around · capital 5",
  },
  {
    id: "boaz",
    title: "Boaz — the left pillar",
    description:
      "Its twin on the north side is Boaz — ‘in him is strength’. Two hundred pomegranates ring each capital, and lily-work finishes the top.",
    verses: [
      {
        ref: "1 Kings 7:21",
        text: "…and he set up the left pillar, and called the name thereof Boaz.",
      },
      {
        ref: "1 Kings 7:22",
        text: "And upon the top of the pillars was lily work: so was the work of the pillars finished.",
      },
    ],
    label: "Boaz · bronze pillar · 18 cubits",
    measure: "18 high · 12 around · capital 5",
  },
  {
    id: "sea",
    title: "The molten Sea on twelve oxen",
    description:
      "A cast-bronze basin ten cubits across and five deep, holding two thousand baths, stands on twelve bronze oxen — three facing each quarter, hindquarters inward. It is set south-east of the house, for the priests to wash.",
    verses: [
      {
        ref: "1 Kings 7:23",
        text: "And he made a molten sea, ten cubits from the one brim to the other: it was round all about, and his height was five cubits: and a line of thirty cubits did compass it round about.",
      },
      {
        ref: "1 Kings 7:25",
        text: "It stood upon twelve oxen, three looking toward the north, and three looking toward the west, and three looking toward the south, and three looking toward the east…",
      },
      {
        ref: "1 Kings 7:39",
        text: "…and he set the sea on the right side of the house eastward over against the south.",
      },
    ],
    label: "The Sea · 10 cubits brim to brim",
    measure: "Ø10 × 5 · 30 around",
  },
  {
    id: "lavers",
    title: "Ten lavers on wheeled bases",
    description:
      "Ten bronze carts, each four cubits square and three high on wheels a cubit and a half tall, each carrying a laver of forty baths. Five stand on the south side of the house and five on the north.",
    verses: [
      {
        ref: "1 Kings 7:27",
        text: "And he made ten bases of brass; four cubits was the length of one base, and four cubits the breadth thereof, and three cubits the height of it.",
      },
      {
        ref: "1 Kings 7:38–39",
        text: "Then made he ten lavers of brass: one laver contained forty baths… And he put five bases on the right side of the house, and five on the left side of the house…",
      },
    ],
    label: "10 lavers · bases 4 × 4 × 3",
    measure: "4 × 4 × 3 cubits each",
  },
  {
    id: "altar",
    title: "The bronze altar",
    description:
      "Before the porch, the altar of burnt offering: bronze, twenty cubits square and ten high. At the dedication fire falls from heaven onto it.",
    verses: [
      {
        ref: "2 Chronicles 4:1",
        text: "Moreover he made an altar of brass, twenty cubits the length thereof, and twenty cubits the breadth thereof, and ten cubits the height thereof.",
      },
      {
        ref: "2 Chronicles 7:1",
        text: "…the fire came down from heaven, and consumed the burnt offering and the sacrifices…",
      },
    ],
    label: "Altar · bronze · 20 × 20 × 10",
    measure: "20 × 20 × 10 cubits",
    interpretive: "Horns and the ledge are drawn from the tabernacle altar.",
  },
  {
    id: "furnishings",
    title: "Lampstands, table and golden altar",
    description:
      "In the Hekal: ten lampstands of pure gold, five on the right and five on the left before the oracle; the table of showbread; and the golden altar of incense standing before the Debir.",
    verses: [
      {
        ref: "1 Kings 7:48",
        text: "…the altar of gold, and the table of gold, whereupon the shewbread was,",
      },
      {
        ref: "1 Kings 7:49",
        text: "And the candlesticks of pure gold, five on the right side, and five on the left, before the oracle…",
      },
    ],
    label: "10 lampstands · pure gold",
    interpretive: "2 Chronicles 4:8 speaks of ten tables; one is shown.",
  },
  {
    id: "ark",
    title: "The ark brought to its place",
    description:
      "Seven years’ work done, the priests carry the ark of the covenant into the Debir and set it under the cherubim’s wings, its staves drawn out so their ends can be seen from the holy place.",
    verses: [
      {
        ref: "1 Kings 8:6",
        text: "And the priests brought in the ark of the covenant of the LORD unto his place, into the oracle of the house, to the most holy place, even under the wings of the cherubims.",
      },
      {
        ref: "1 Kings 8:8",
        text: "And they drew out the staves, that the ends of the staves were seen out in the holy place before the oracle…",
      },
    ],
    label: "Ark of the covenant · 2½ × 1½ × 1½",
  },
  {
    id: "glory",
    title: "The cloud fills the house",
    description:
      "As the priests come out, a cloud fills the house so that they cannot stand to minister — the glory of the LORD has filled the house of the LORD.",
    verses: [
      {
        ref: "1 Kings 8:10–11",
        text: "…the cloud filled the house of the LORD, so that the priests could not stand to minister because of the cloud: for the glory of the LORD had filled the house of the LORD.",
      },
    ],
    label: "The glory of the LORD",
  },
] as const;

export type TempleStepId = (typeof TEMPLE_STEPS)[number]["id"];

const S = Object.fromEntries(TEMPLE_STEPS.map((s, i) => [s.id, i])) as Record<
  TempleStepId,
  number
>;

// ── blueprint: west up, so plan x = world z (north right), plan y = −world x
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

const { F, t, house, porch, court, sea, altar } = T;
const hz = house.z;

export const TEMPLE_WALK: WalkStop[] = [
  {
    n: 1,
    name: "East gate",
    note: "Enter the inner court from the east, facing the house.",
    at: [-106, 0],
    eye: 3.6,
    look: [-75, 8, 0],
    plan: at(-106, 0),
  },
  {
    n: 2,
    name: "Bronze altar",
    note: "The altar of burnt offering, 20 × 20 × 10 cubits.",
    at: [-92, -18],
    eye: 3.6,
    look: [-75, 7, 0],
    plan: at(-92, -18),
  },
  {
    n: 3,
    name: "The Sea",
    note: "South-east of the house, on twelve oxen.",
    at: [-75, -41],
    eye: 3.6,
    look: [-62, 4.5, -30],
    plan: at(-75, -41),
  },
  {
    n: 4,
    name: "Jachin & Boaz",
    note: "Jachin on your left (south), Boaz on your right.",
    at: [-63, 0],
    eye: 3.6,
    look: [-46, 15, 0],
    plan: at(-63, 0),
  },
  {
    n: 5,
    name: "Ulam",
    note: "The porch, 20 cubits wide and 10 deep.",
    at: [-39, 0],
    eye: F + 3.6,
    look: [-20, F + 6, 0],
    plan: at(-39, 0),
  },
  {
    n: 6,
    name: "Hekal",
    note: "The holy place: cedar walls, ten lampstands, the golden altar ahead.",
    at: [-22, 0],
    eye: F + 3.6,
    look: [8, F + 6, 0],
    plan: at(-22, 0),
  },
  {
    n: 7,
    name: "Debir",
    note: "The most holy place: the ark beneath the cherubim’s wings.",
    at: [12, -8.5],
    eye: F + 3.6,
    look: [22, F + 2.6, 0],
    plan: at(12, -8.5),
  },
];

const els: BlueprintEl[] = [
  // foundation & steps
  { kind: "rect", ...R(-49, 42, -22, 22), step: S.foundation, tone: "faint", dashed: true },
  ...[0, 1, 2, 3].map(
    (i): BlueprintEl => ({
      kind: "line",
      pts: [at(-50 - i * 1.5, -8), at(-50 - i * 1.5, 8)],
      step: S.foundation,
      tone: "faint",
    }),
  ),
  // house walls
  { kind: "rect", ...R(-31.5, 31.5, hz, hz + t), step: S.walls, fill: true },
  { kind: "rect", ...R(-31.5, 31.5, -hz - t, -hz), step: S.walls, fill: true },
  { kind: "rect", ...R(30, 31.5, -hz, hz), step: S.walls, fill: true },
  { kind: "rect", ...R(-31.5, -30, 5, hz), step: S.walls, fill: true },
  { kind: "rect", ...R(-31.5, -30, -hz, -5), step: S.walls, fill: true },
  txt(-8, 0, "HEKAL", S.walls, { size: 26 }),
  txt(-13, 0, "holy place · 40 × 20", S.walls, { size: 12, italic: true }),
  { kind: "dim", a: at(-30, -hz - t), b: at(30, -hz - t), text: "60 cubits", step: S.walls, offset: -14 },
  { kind: "dim", a: at(31.5, -hz), b: at(31.5, hz), text: "20", step: S.walls, offset: 11 },
  // porch
  { kind: "rect", ...R(porch.x0 - t, porch.x1, hz, hz + t), step: S.porch, fill: true },
  { kind: "rect", ...R(porch.x0 - t, porch.x1, -hz - t, -hz), step: S.porch, fill: true },
  { kind: "rect", ...R(porch.x0 - t, porch.x0, 6, hz), step: S.porch, fill: true },
  { kind: "rect", ...R(porch.x0 - t, porch.x0, -hz, -6), step: S.porch, fill: true },
  txt(-35, 0, "ULAM", S.porch, { size: 20 }),
  txt(-38.5, 0, "porch · 20 × 10", S.porch, { size: 11, italic: true }),
  // side chambers
  { kind: "rect", ...R(-31.5, 31.5, hz + t, hz + t + 8), step: S.chambers, tone: "faint" },
  { kind: "rect", ...R(31.5, 39.5, -hz - t, hz + t + 8), step: S.chambers, tone: "faint" },
  { kind: "rect", ...R(-31.5, 31.5, -hz - t - 8, -hz - t), step: S.chambers, tone: "faint", dashed: true },
  ...[-21, -11, -1, 9, 19].map(
    (x): BlueprintEl => ({
      kind: "line",
      pts: [at(x, hz + t), at(x, hz + t + 8)],
      step: S.chambers,
      tone: "faint",
    }),
  ),
  txt(0, hz + t + 4, "SIDE CHAMBERS · 3 STOREYS", S.chambers, { size: 10, rotate: 90 }),
  // Debir
  { kind: "rect", ...R(10.5, 30, -hz, hz), step: S.debir, tone: "gold", fill: true },
  { kind: "rect", ...R(9.5, 10.5, 2.5, hz), step: S.debir, fill: true },
  { kind: "rect", ...R(9.5, 10.5, -hz, -2.5), step: S.debir, fill: true },
  { kind: "line", pts: [at(9, -hz), at(9, hz)], step: S.debir, tone: "gold", dashed: true },
  txt(26.5, 0, "DEBIR", S.debir, { size: 22, tone: "gold" }),
  txt(13.6, 0, "most holy · 20 × 20 × 20", S.debir, { size: 11, italic: true, tone: "gold" }),
  // cherubim
  { kind: "line", pts: [at(20, -hz), at(20, hz)], step: S.cherubim, tone: "gold", width: 3 },
  { kind: "circle", cx: 5, cy: -20, r: 1.2, step: S.cherubim, tone: "gold", fill: true },
  { kind: "circle", cx: -5, cy: -20, r: 1.2, step: S.cherubim, tone: "gold", fill: true },
  // veil
  { kind: "line", pts: [at(10.9, -hz), at(10.9, hz)], step: S.veil, tone: "gold", width: 2 },
  // court
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
    width: 3,
  },
  txt(court.x0 - 4, 0, "EAST GATE", S.court, { size: 12 }),
  txt(40, -36, "INNER COURT", S.court, { size: 14, tone: "faint" }),
  // pillars
  { kind: "circle", cx: -6, cy: -T.pillarX, r: 12 / (2 * Math.PI), step: S.jachin, tone: "gold", fill: true },
  txt(T.pillarX - 1, -18, "JACHIN", S.jachin, { size: 13, tone: "gold" }),
  { kind: "circle", cx: 6, cy: -T.pillarX, r: 12 / (2 * Math.PI), step: S.boaz, tone: "gold", fill: true },
  txt(T.pillarX - 1, 16.5, "BOAZ", S.boaz, { size: 13, tone: "gold" }),
  // sea
  { kind: "circle", cx: sea.z, cy: -sea.x, r: 5, step: S.sea, tone: "gold" },
  { kind: "circle", cx: sea.z, cy: -sea.x, r: 4.3, step: S.sea, tone: "gold" },
  txt(sea.x, sea.z, "SEA", S.sea, { size: 12, tone: "gold" }),
  // lavers
  ...T.laverXs.flatMap((x) =>
    [-1, 1].map(
      (s): BlueprintEl => ({
        kind: "rect",
        ...R(x - 2, x + 2, s * T.laverZ - 2, s * T.laverZ + 2),
        step: S.lavers,
        tone: "gold",
      }),
    ),
  ),
  txt(0, -T.laverZ - 5, "LAVERS", S.lavers, { size: 11, rotate: 90 }),
  txt(0, T.laverZ + 5, "LAVERS", S.lavers, { size: 11, rotate: 90 }),
  // altar
  { kind: "rect", ...R(altar.x - 10, altar.x + 10, -10, 10), step: S.altar, tone: "gold", fill: true },
  {
    kind: "line",
    pts: [at(altar.x - 10, -10), at(altar.x + 10, 10)],
    step: S.altar,
    tone: "gold",
  },
  {
    kind: "line",
    pts: [at(altar.x - 10, 10), at(altar.x + 10, -10)],
    step: S.altar,
    tone: "gold",
  },
  txt(altar.x, 15, "ALTAR", S.altar, { size: 13, tone: "gold", anchor: "start" }),
  // furnishings
  ...[-24, -18, -12, -6, 0].flatMap((x) =>
    [-7, 7].map(
      (z): BlueprintEl => ({ kind: "circle", cx: z, cy: -x, r: 0.9, step: S.furnishings, tone: "gold", fill: true }),
    ),
  ),
  { kind: "rect", ...R(-13, -11, -0.5, 0.5), step: S.furnishings, tone: "gold", fill: true },
  { kind: "rect", ...R(5.5, 6.5, -0.5, 0.5), step: S.furnishings, tone: "gold", fill: true },
  // ark
  { kind: "rect", ...R(18.75, 21.25, -0.75, 0.75), step: S.ark, tone: "gold", fill: true },
  // walk-through path
  {
    kind: "line",
    pts: TEMPLE_WALK.map((w) => w.plan),
    step: 0,
    tone: "gold",
    dashed: true,
    width: 2,
  },
];

export const TEMPLE_BUILD: BuildInfo = {
  title: "Solomon’s Temple",
  steps: TEMPLE_STEPS,
  env: "jerusalem",
  walk: TEMPLE_WALK,
  blueprint: {
    title: "SOLOMON’S TEMPLE",
    subtitle: "1 Kings 6–8 · grid = 10 cubits",
    view: "Plan",
    viewBox: [-60, -64, 120, 182],
    up: "W",
    grid: 10,
    els,
  },
};
