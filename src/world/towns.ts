import type { LngLat } from "@/data/journeys";

/**
 * The towns and cities the map builds (src/components/diorama/cities.ts):
 * roughly where each stood, how far it spread, whether a wall ran round it,
 * when it stood, how it was built, and the landmarks it is remembered by.
 *
 * Sizes follow the excavated or reported extent at the town's height (or at
 * each phase, where a city grew or fell: Jerusalem from David's ridge to
 * Herod's three walls); dates are years (negative BC), approximate, from the
 * archaeology and the histories. A guide for the eye, not a survey: streets
 * are drawn as a grid, and a landmark's place is where it is known to have
 * stood, or where it plausibly did.
 *
 * Landmark and line offsets are metres east and north of the town's first
 * `at`; `turn` is clockwise degrees from the kit piece's own facing (a
 * theatre opens to the south, a temple's long side runs north–south, a wall,
 * colonnade, mole or circus runs east–west).
 */

export type Style = "levant" | "mesopotamia" | "egypt" | "persia" | "greek" | "roman";

export type LandmarkKind =
  | "temple_greek"
  | "theatre"
  | "hippodrome"
  | "amphitheatre"
  | "ziggurat"
  | "palace"
  | "apadana"
  | "pyramid"
  | "step_pyramid"
  | "obelisk"
  | "egypt_temple"
  | "lighthouse"
  | "citadel"
  | "gate_glazed"
  | "paving";

export type Landmark = {
  kind: LandmarkKind;
  /** where: a place of its own, or metres [east, north] of the town */
  at?: LngLat;
  off?: [number, number];
  turn?: number;
  scale?: number;
  /** paving: its size in 20 m squares, [east, north] */
  stretch?: [number, number];
  from?: number;
  to?: number;
};

export type LineKind = "colonnade" | "mole" | "aqueduct" | "road";
export type Line = { kind: LineKind; path?: LngLat[]; off?: [number, number][]; from?: number; to?: number };

/** a rectangular circuit: metres east–west and north–south, turned clockwise (−50 lays the long side of a wide one along a bearing of 40°) */
export type Rect = { w: number; h: number; turn?: number };

type Shape = {
  at: LngLat;
  /** its reach, metres: a ring's radius (a rectangle's is its half-diagonal) */
  radius: number;
  rect?: Rect;
  walled?: boolean;
  style: Style;
  /** the streets' turn, clockwise degrees (a rectangle's own by default) */
  grid?: number;
  /** false: a sanctuary, a fortress or a necropolis, its landmarks without a town round them */
  houses?: boolean;
};

export type Town = Shape & {
  name: string;
  from: number;
  to?: number;
  /** what changed, and from when */
  phases?: (Partial<Shape> & { from: number })[];
  landmarks?: Landmark[];
  lines?: Line[];
};

/** a town as it was in a year: its phase's shape, the landmarks standing (null: all, at its height) */
export type TownNow = Town & { phase: number };

export function townAt(t: Town, year: number | null): TownNow | null {
  if (year !== null && (year < t.from || (t.to !== undefined && year > t.to))) return null;
  let phase = -1;
  t.phases?.forEach((p, i) => {
    if (year === null ? true : p.from <= year) phase = i;
  });
  const p: Partial<Shape> = phase >= 0 ? t.phases![phase] : {};
  const shape = { ...t, ...p };
  // a rectangle's reach is its half-diagonal
  if (p.rect && !p.radius) shape.radius = Math.hypot(p.rect.w, p.rect.h) / 2;
  const standing = <T extends { from?: number; to?: number }>(x: T) => year === null || ((x.from ?? -1e5) <= year && (x.to ?? 1e5) >= year);
  return { ...shape, landmarks: t.landmarks?.filter(standing), lines: t.lines?.filter(standing), phase };
}

const r = (w: number, h: number, turn = 0): Rect => ({ w, h, turn });
const half = (x: Rect) => Math.hypot(x.w, x.h) / 2;

// along the great street (bearing 40°), between the Orontes and Mount Silpius
const ANTIOCH = r(3600, 1600, -50);
const BABYLON = r(2000, 2400, 0);
const NINEVEH = r(2100, 4900, -12);
// along the Canopic Way (bearing 77°), between the sea and Lake Mareotis
const ALEXANDRIA = r(5000, 1600, -13);
const DAMASCUS = r(1600, 1000, 0);
const DUR_SHARRUKIN = r(1720, 1720, 45);
const AMARNA = r(1300, 5000, 0);
const PERSEPOLIS = r(300, 455, 0);
const SELEUCIA_TIGRIS = r(2600, 2200, 30);
const MASADA = r(270, 600, -20);

/** along a bearing (clockwise from north), metres: [east, north] */
function along(bearing: number, m: number): [number, number] {
  const a = (bearing * Math.PI) / 180;
  return [Math.round(Math.sin(a) * m), Math.round(Math.cos(a) * m)];
}
const plus = (a: [number, number], b: [number, number]): [number, number] => [a[0] + b[0], a[1] + b[1]];

export const TOWNS: Town[] = [
  /* ------------------------------------------------ Canaan, Israel, Judah */
  {
    name: "Jerusalem",
    at: [35.2316, 31.7767],
    radius: 620,
    walled: true,
    style: "levant",
    from: -3000,
    // the City of David on its ridge; Solomon's north to the temple; Hezekiah's on the western hill; ruin;
    // Nehemiah's; the Hasmoneans'; Herod's; the legion's camp; Hadrian's Aelia Capitolina
    phases: [
      { from: -3000, at: [35.2357, 31.7737], radius: 150 },
      { from: -1000, at: [35.2352, 31.7752], radius: 240 },
      { from: -700, at: [35.233, 31.7755], radius: 430 },
      { from: -586, at: [35.2357, 31.7737], radius: 120, walled: false },
      { from: -445, at: [35.2352, 31.7745], radius: 220, walled: true },
      { from: -140, at: [35.233, 31.776], radius: 470 },
      { from: -30, at: [35.2316, 31.7767], radius: 620 },
      { from: 70, at: [35.229, 31.776], radius: 220, walled: false },
      { from: 135, at: [35.2316, 31.779], radius: 500, walled: true, style: "roman" },
    ],
    landmarks: [
      { kind: "palace", at: [35.2287, 31.7752], scale: 1.1, from: -23, to: 70 },
      { kind: "citadel", at: [35.2338, 31.7807], scale: 0.85, from: -37, to: 70 },
      { kind: "citadel", at: [35.2281, 31.7766], scale: 0.5, from: -23 },
    ],
  },
  { name: "Jericho", at: [35.4442, 31.8711], radius: 120, walled: true, style: "levant", from: -8000, to: -586, phases: [{ from: -1406, radius: 0, houses: false }, { from: -870, radius: 110, walled: false, houses: true }] },
  {
    name: "Herodian Jericho",
    at: [35.4285, 31.8535],
    radius: 300,
    style: "roman",
    from: -100,
    to: 100,
    landmarks: [
      { kind: "palace", off: [-150, 60], scale: 0.7, from: -30 },
      { kind: "hippodrome", at: [35.444, 31.862], scale: 0.7, turn: 90, from: -10, to: 70 },
    ],
  },
  { name: "Bethlehem", at: [35.2007, 31.7054], radius: 150, style: "levant", from: -1400 },
  { name: "Hebron", at: [35.0998, 31.5326], radius: 150, walled: true, style: "levant", from: -2600 },
  { name: "Shechem", at: [35.2826, 32.2135], radius: 130, walled: true, style: "levant", from: -1900, to: -107 },
  { name: "Neapolis", at: [35.262, 32.22], radius: 420, walled: true, style: "roman", from: 72, landmarks: [{ kind: "theatre", off: [0, -250], scale: 1.1, from: 160 }] },
  {
    name: "Samaria",
    at: [35.1897, 32.2803],
    radius: 260,
    walled: true,
    style: "levant",
    from: -880,
    to: 400,
    phases: [{ from: -27, radius: 450, style: "roman" }],
    landmarks: [
      { kind: "citadel", off: [-90, 30], scale: 1.4, from: -880, to: -722 },
      { kind: "temple_greek", off: [-110, 50], scale: 0.7, turn: 90, from: -27 },
      { kind: "theatre", off: [-20, -150], scale: 0.7, from: -27 },
    ],
    lines: [{ kind: "colonnade", off: [[-500, -60], [450, -10]], from: 180 }],
  },
  { name: "Shiloh", at: [35.2893, 32.0553], radius: 90, style: "levant", from: -1400, to: -1050 },
  { name: "Bethel", at: [35.2219, 31.9306], radius: 120, style: "levant", from: -2000, to: 300 },
  { name: "Ai", at: [35.2609, 31.9161], radius: 150, walled: true, style: "levant", from: -3100, to: -1400 },
  { name: "Gibeon", at: [35.1855, 31.8476], radius: 140, walled: true, style: "levant", from: -1400, to: -586 },
  { name: "Mizpah", at: [35.2153, 31.8853], radius: 110, walled: true, style: "levant", from: -1100, to: -400 },
  { name: "Beersheba", at: [34.8396, 31.2449], radius: 75, walled: true, style: "levant", from: -1000, to: -700 },
  { name: "Arad", at: [35.1258, 31.2803], radius: 40, walled: true, houses: false, style: "levant", from: -1000, to: -586, landmarks: [{ kind: "citadel", off: [0, 0], scale: 0.7 }] },
  { name: "Lachish", at: [34.8486, 31.5649], radius: 200, walled: true, style: "levant", from: -1800, to: -586, landmarks: [{ kind: "citadel", off: [0, 0], scale: 1.1, from: -900 }] },
  { name: "Megiddo", at: [35.1849, 32.585], radius: 140, walled: true, style: "levant", from: -3000, to: -350 },
  { name: "Hazor", at: [35.5683, 33.017], radius: 450, walled: true, style: "levant", from: -2700, to: -732 },
  { name: "Dan", at: [35.652, 33.2486], radius: 220, walled: true, style: "levant", from: -2700, to: -732 },
  { name: "Gaza", at: [34.4605, 31.5167], radius: 380, walled: true, style: "levant", from: -3000 },
  { name: "Ashkelon", at: [34.5482, 31.6639], radius: 380, walled: true, style: "levant", from: -2000 },
  { name: "Ashdod", at: [34.6553, 31.7546], radius: 280, walled: true, style: "levant", from: -1700 },
  { name: "Gath", at: [34.8495, 31.7008], radius: 300, walled: true, style: "levant", from: -3000, to: -830 },
  { name: "Ekron", at: [34.8509, 31.7784], radius: 300, walled: true, style: "levant", from: -1200, to: -604 },
  { name: "Joppa", at: [34.7522, 32.0544], radius: 180, walled: true, style: "levant", from: -1800 },
  { name: "Gezer", at: [34.9208, 31.8587], radius: 200, walled: true, style: "levant", from: -3000, to: -100 },
  { name: "Beth-shemesh", at: [34.9758, 31.7514], radius: 100, walled: true, style: "levant", from: -2000, to: -586 },
  { name: "Beth-shan", at: [35.5023, 32.5048], radius: 150, walled: true, style: "levant", from: -4000, to: -100 },
  {
    name: "Scythopolis",
    at: [35.5, 32.501],
    radius: 650,
    style: "roman",
    from: -63,
    to: 749,
    landmarks: [{ kind: "theatre", off: [-150, -200], scale: 1.2, from: 0 }],
    lines: [{ kind: "colonnade", off: [[-200, -120], [150, 200]], from: 100 }],
  },
  { name: "Jezreel", at: [35.3302, 32.5583], radius: 140, walled: true, style: "levant", from: -900, to: -841 },
  { name: "Acco", at: [35.0681, 32.9235], radius: 400, walled: true, style: "levant", from: -3000, phases: [{ from: -261, style: "greek" }] },
  { name: "Dor", at: [34.915, 32.617], radius: 200, walled: true, style: "levant", from: -2000 },
  { name: "Lydda", at: [34.8956, 31.9517], radius: 250, style: "levant", from: -1000 },
  { name: "Antipatris", at: [34.93, 32.105], radius: 250, style: "roman", from: -9 },
  { name: "En-gedi", at: [35.3917, 31.4614], radius: 120, style: "levant", from: -650 },
  { name: "Nazareth", at: [35.2978, 32.7019], radius: 90, style: "levant", from: -200 },
  { name: "Sepphoris", at: [35.2797, 32.7531], radius: 350, style: "roman", from: -100, landmarks: [{ kind: "theatre", off: [0, 60], scale: 0.85, from: 0 }] },
  {
    name: "Tiberias",
    at: [35.5378, 32.7804],
    radius: 420,
    walled: true,
    style: "roman",
    from: 20,
    landmarks: [
      { kind: "theatre", off: [-80, -350], scale: 1.1 },
      { kind: "palace", off: [-150, -150], scale: 0.6 },
    ],
  },
  { name: "Capernaum", at: [35.5751, 32.8811], radius: 140, style: "levant", from: -200, to: 700 },
  { name: "Bethsaida", at: [35.6305, 32.9104], radius: 120, style: "levant", from: -1000, to: 70 },
  { name: "Magdala", at: [35.5156, 32.8247], radius: 150, style: "levant", from: -100, to: 100 },
  { name: "Cana", at: [35.3422, 32.7468], radius: 90, style: "levant", from: -300 },
  { name: "Caesarea Philippi", at: [35.6944, 33.2486], radius: 300, style: "roman", from: -20, landmarks: [{ kind: "temple_greek", off: [0, 150], scale: 0.5, turn: 90 }] },
  { name: "Strato's Tower", at: [34.8925, 32.5025], radius: 150, walled: true, style: "levant", from: -300, to: -23 },
  {
    name: "Caesarea",
    at: [34.8935, 32.501],
    radius: 620,
    walled: true,
    style: "roman",
    grid: 0,
    from: -22,
    landmarks: [
      { kind: "theatre", at: [34.8915, 32.4955], turn: 90, scale: 0.9 },
      { kind: "palace", at: [34.8906, 32.4968], scale: 0.6 },
      { kind: "hippodrome", at: [34.8925, 32.499], turn: 90, scale: 0.67 },
      { kind: "temple_greek", at: [34.8914, 32.5021], turn: 90, scale: 0.75 },
    ],
    lines: [
      // Herod's harbour, Sebastos: the great southern breakwater curling round to the north, the northern one to meet it
      { kind: "mole", path: [[34.8905, 32.5014], [34.888, 32.5012], [34.8862, 32.5027], [34.8864, 32.5047]] },
      { kind: "mole", path: [[34.8903, 32.505], [34.8878, 32.5052]] },
      // the high-level aqueduct, north along the shore from Shuni
      { kind: "aqueduct", path: [[34.894, 32.5045], [34.8962, 32.518], [34.9015, 32.535], [34.925, 32.553]] },
    ],
  },
  { name: "Emmaus", at: [34.9894, 31.8394], radius: 130, style: "levant", from: -200 },
  { name: "Bethany", at: [35.2619, 31.7713], radius: 80, style: "levant", from: -200 },
  { name: "Masada", at: [35.3536, 31.3156], radius: half(MASADA), rect: MASADA, walled: true, houses: false, style: "roman", from: -37, to: 73, landmarks: [{ kind: "palace", off: [-20, 220], scale: 0.45 }, { kind: "palace", off: [-60, -40], scale: 0.55 }] },
  { name: "Herodium", at: [35.2414, 31.6658], radius: 40, houses: false, style: "roman", from: -23, to: 71, landmarks: [{ kind: "citadel", off: [0, 0], scale: 0.9 }, { kind: "palace", off: [100, -350], scale: 0.7 }] },

  /* ----------------------------------------------------------- Transjordan */
  {
    name: "Rabbah",
    at: [35.9349, 31.9539],
    radius: 400,
    walled: true,
    style: "levant",
    from: -1200,
    phases: [{ from: -63, radius: 750, style: "roman" }],
    landmarks: [
      { kind: "theatre", at: [35.9393, 31.9518], scale: 1.4, turn: 0, from: 140 },
      { kind: "temple_greek", at: [35.9343, 31.9543], scale: 0.6, from: 162 },
    ],
  },
  { name: "Heshbon", at: [35.8075, 31.8022], radius: 150, walled: true, style: "levant", from: -1200, to: 600 },
  { name: "Dibon", at: [35.7758, 31.4992], radius: 120, walled: true, style: "levant", from: -1200, to: -500 },
  { name: "Medeba", at: [35.7944, 31.7167], radius: 200, walled: true, style: "levant", from: -1200 },
  {
    name: "Gerasa",
    at: [35.8911, 32.2803],
    radius: 750,
    walled: true,
    style: "roman",
    grid: 15,
    from: -170,
    landmarks: [
      { kind: "theatre", off: [-130, -470], scale: 1.1, from: 90 },
      { kind: "temple_greek", off: [-190, -520], scale: 0.6, from: 27 },
      { kind: "temple_greek", off: [-180, 60], scale: 0.7, from: 150 },
      { kind: "paving", off: [-40, -380], stretch: [4.5, 4], from: 50 },
      { kind: "hippodrome", off: [60, -950], scale: 0.55, turn: 105, from: 130 },
    ],
    lines: [{ kind: "colonnade", off: [[-60, -330], [180, 560]], from: 50 }],
  },
  { name: "Gadara", at: [35.6797, 32.6556], radius: 300, walled: true, style: "roman", from: -200, landmarks: [{ kind: "theatre", off: [0, -100], scale: 0.8 }] },
  {
    name: "Petra",
    at: [35.4444, 30.3285],
    radius: 600,
    style: "levant",
    from: -300,
    to: 600,
    landmarks: [
      { kind: "theatre", off: [250, 120], scale: 1.1, turn: 90, from: 0 },
      { kind: "temple_greek", off: [-320, -10], scale: 0.6, from: -20 },
    ],
    lines: [{ kind: "colonnade", off: [[-260, -30], [180, 30]], from: 0 }],
  },
  { name: "Bozrah", at: [35.5953, 30.7314], radius: 150, walled: true, style: "levant", from: -800, to: -550 },
  { name: "Kadesh-barnea", at: [34.4228, 30.6517], radius: 40, walled: true, houses: false, style: "levant", from: -1000, to: -586, landmarks: [{ kind: "citadel", off: [0, 0], scale: 0.6 }] },
  { name: "Ezion-geber", at: [34.9806, 29.5469], radius: 120, walled: true, style: "levant", from: -1000, to: -500 },

  /* ----------------------------------------------------- Phoenicia, Syria */
  {
    name: "Tyre",
    at: [35.1968, 33.2705],
    radius: 450,
    walled: true,
    style: "levant",
    from: -2750,
    landmarks: [{ kind: "hippodrome", at: [35.2096, 33.2697], scale: 1, from: 100 }],
    lines: [
      // Alexander's causeway, from the mainland to the island he besieged
      { kind: "mole", path: [[35.209, 33.2722], [35.2005, 33.2722]], from: -332 },
      { kind: "colonnade", off: [[1350, -120], [1350, 450]], from: 100 },
    ],
  },
  { name: "Sidon", at: [35.3729, 33.5571], radius: 380, walled: true, style: "levant", from: -3000 },
  { name: "Byblos", at: [35.6461, 34.1192], radius: 200, walled: true, style: "levant", from: -5000 },
  { name: "Arvad", at: [35.8586, 34.8556], radius: 300, walled: true, style: "levant", from: -2000 },
  { name: "Ugarit", at: [35.7836, 35.6017], radius: 300, walled: true, style: "levant", from: -1900, to: -1185, landmarks: [{ kind: "palace", off: [-150, 0], scale: 0.7 }] },
  {
    name: "Damascus",
    at: [36.3065, 33.5112],
    radius: half(DAMASCUS),
    rect: DAMASCUS,
    walled: true,
    style: "levant",
    from: -3000,
    phases: [{ from: -64, style: "roman" }],
    landmarks: [
      // the temple of Jupiter in its great court, where the Umayyad mosque stands now
      { kind: "paving", at: [36.3065, 33.5115], stretch: [19, 15], from: 0 },
      { kind: "temple_greek", at: [36.3065, 33.5115], scale: 1.4, turn: 90, from: 0 },
      { kind: "citadel", off: [-650, 120], scale: 1.2 },
    ],
    // "the street called Straight" (Acts 9:11), the Via Recta, east to west through the city
    lines: [{ kind: "colonnade", off: [[-760, -160], [760, -160]], from: -64 }],
  },
  {
    name: "Antioch",
    at: [36.1601, 36.2021],
    radius: half(ANTIOCH),
    rect: ANTIOCH,
    walled: true,
    style: "greek",
    from: -300,
    phases: [{ from: -64, style: "roman" }],
    landmarks: [
      // Seleucus II's island, north across the Orontes: the palace and the circus beside it
      { kind: "palace", off: plus(along(40, 1300), along(310, 700)), scale: 1.2, turn: 40, from: -220 },
      { kind: "hippodrome", off: plus(along(40, 950), along(310, 650)), turn: -50, from: -67 },
      // Caesar's theatre on the slope of Mount Silpius
      { kind: "theatre", off: plus(along(40, 200), along(130, 650)), turn: 130, scale: 1.1, from: -47 },
      { kind: "temple_greek", off: plus(along(40, -300), along(130, 350)), turn: 40, from: -170 },
      { kind: "citadel", off: plus(along(40, 300), along(130, 1250)), scale: 1.1 },
      { kind: "paving", off: along(130, 120), stretch: [5, 5], turn: 40, from: -300 },
    ],
    lines: [
      // the great colonnaded street, paved by Herod, its porticoes by Tiberius: two Roman miles
      { kind: "colonnade", off: [along(40, -1550), along(40, 1550)], from: -20 },
      { kind: "colonnade", off: [along(130, -420), along(130, 520)], from: -20 },
    ],
  },
  { name: "Seleucia Pieria", at: [35.93, 36.123], radius: 550, walled: true, style: "greek", from: -300, to: 500, lines: [{ kind: "mole", off: [[-500, -350], [-750, -200]] }] },
  { name: "Hamath", at: [36.75, 35.1333], radius: 300, walled: true, style: "levant", from: -2000, to: 600, landmarks: [{ kind: "citadel", off: [0, 0], scale: 1.6 }] },
  { name: "Kadesh", at: [36.5136, 34.5583], radius: 250, walled: true, style: "levant", from: -2000, to: -1100 },
  { name: "Ebla", at: [36.7983, 35.7983], radius: 300, walled: true, style: "levant", from: -3000, to: -1600, landmarks: [{ kind: "palace", off: [0, 0], scale: 0.8 }] },
  { name: "Aleppo", at: [37.1625, 36.1993], radius: 600, walled: true, style: "levant", from: -3000, landmarks: [{ kind: "citadel", off: [0, 0], scale: 2.2 }] },
  {
    name: "Tadmor",
    at: [38.2683, 34.5514],
    radius: 400,
    style: "levant",
    from: -2000,
    phases: [{ from: -40, radius: 900, style: "roman", walled: true }],
    landmarks: [
      { kind: "paving", off: [720, -100], stretch: [10, 10], from: 32 },
      { kind: "temple_greek", off: [720, -100], scale: 1.1, from: 32 },
      { kind: "theatre", off: [-30, -120], scale: 0.9, turn: 180, from: 150 },
    ],
    lines: [{ kind: "colonnade", off: [[560, -60], [-520, 220]], from: 120 }],
  },
  { name: "Carchemish", at: [38.0144, 36.8296], radius: 450, walled: true, style: "levant", from: -2400, to: -605, landmarks: [{ kind: "citadel", off: [-200, 150], scale: 1.6 }] },
  { name: "Haran", at: [39.0306, 36.8648], radius: 380, walled: true, style: "mesopotamia", from: -2000 },
  {
    name: "Mari",
    at: [40.8869, 34.5497],
    radius: 950,
    walled: true,
    style: "mesopotamia",
    from: -2900,
    to: -1759,
    landmarks: [
      { kind: "palace", off: [0, 100], scale: 1.1 },
      { kind: "ziggurat", off: [-220, 40], scale: 0.4 },
    ],
  },
  { name: "Dura-Europos", at: [40.73, 34.7469], radius: 500, walled: true, style: "greek", from: -300, to: 256 },
  { name: "Tarsus", at: [34.8954, 36.9177], radius: 750, walled: true, style: "greek", from: -2000, phases: [{ from: -64, style: "roman" }], lines: [{ kind: "colonnade", off: [[0, -600], [0, 600]], from: 0 }] },

  /* -------------------------------------------------------------- Anatolia */
  {
    name: "Ephesus",
    at: [27.3417, 37.9395],
    radius: 950,
    walled: true,
    style: "greek",
    from: -290,
    phases: [{ from: -129, style: "roman" }],
    landmarks: [
      // the great theatre (Acts 19) looking down the Arcadian way to the harbour
      { kind: "theatre", at: [27.3428, 37.941], scale: 1.5, turn: 90 },
      { kind: "paving", at: [27.3412, 37.9398], stretch: [5.5, 5.5] },
      { kind: "hippodrome", at: [27.3443, 37.9455], scale: 0.5, from: 50 },
      { kind: "temple_greek", at: [27.3391, 37.9384], scale: 0.4, turn: 90, from: 80 },
      // the Artemision, one of the seven wonders, outside the walls
      { kind: "temple_greek", at: [27.3639, 37.9497], scale: 1.75, turn: 90, from: -550, to: 401 },
    ],
    lines: [
      { kind: "colonnade", path: [[27.342, 37.9412], [27.3335, 37.9425]], from: 0 },
      { kind: "mole", path: [[27.3322, 37.9418], [27.3302, 37.9432]] },
    ],
  },
  { name: "Smyrna", at: [27.1384, 38.4189], radius: 700, walled: true, style: "greek", from: -300, landmarks: [{ kind: "theatre", off: [400, -300], scale: 1.2 }, { kind: "paving", off: [-100, 50], stretch: [6, 4] }] },
  {
    name: "Pergamum",
    at: [27.1839, 39.1325],
    radius: 650,
    walled: true,
    style: "greek",
    from: -300,
    landmarks: [
      { kind: "theatre", at: [27.1836, 39.1321], scale: 1, turn: 270 },
      { kind: "temple_greek", at: [27.1847, 39.1334], scale: 0.6, from: 114 },
      // the Great Altar ("where Satan's throne is", Revelation 2:13)
      { kind: "palace", at: [27.1846, 39.1312], scale: 0.2, from: -170 },
      { kind: "citadel", at: [27.1852, 39.1335], scale: 1.0 },
    ],
  },
  { name: "Thyatira", at: [27.8361, 38.9139], radius: 300, style: "greek", from: -290 },
  {
    name: "Sardis",
    at: [28.0403, 38.4883],
    radius: 800,
    walled: true,
    style: "greek",
    from: -1200,
    landmarks: [
      { kind: "temple_greek", at: [28.0303, 38.4757], scale: 1.5, turn: 90, from: -300 },
      { kind: "citadel", at: [28.04, 38.48], scale: 1.2, from: -700 },
    ],
  },
  { name: "Philadelphia", at: [28.5225, 38.35], radius: 350, style: "greek", from: -190 },
  {
    name: "Laodicea",
    at: [29.1075, 37.8358],
    radius: 700,
    walled: true,
    style: "roman",
    from: -260,
    landmarks: [
      { kind: "theatre", off: [200, 350], scale: 1.1, turn: 180 },
      { kind: "hippodrome", off: [-150, -500], scale: 0.6 },
    ],
    lines: [{ kind: "colonnade", off: [[-600, 0], [600, 50]], from: 0 }],
  },
  { name: "Colossae", at: [29.26, 37.788], radius: 300, style: "greek", from: -500, to: 700, landmarks: [{ kind: "theatre", off: [0, -60], scale: 0.7 }] },
  { name: "Hierapolis", at: [29.1253, 37.9256], radius: 600, style: "roman", from: -190, landmarks: [{ kind: "theatre", off: [250, 100], scale: 1.1, turn: 270 }], lines: [{ kind: "colonnade", off: [[-80, -600], [80, 600]], from: 0 }] },
  {
    name: "Miletus",
    at: [27.2758, 37.5303],
    radius: 700,
    walled: true,
    style: "greek",
    from: -1000,
    landmarks: [
      { kind: "theatre", at: [27.277, 37.528], scale: 1.4, turn: 180 },
      { kind: "paving", off: [-50, -100], stretch: [8, 6] },
    ],
    lines: [{ kind: "mole", off: [[-250, 300], [-60, 420]] }],
  },
  { name: "Troas", at: [26.1586, 39.7533], radius: 700, walled: true, style: "greek", from: -300 },
  { name: "Assos", at: [26.3364, 39.4897], radius: 350, walled: true, style: "greek", from: -1000, landmarks: [{ kind: "temple_greek", off: [0, 120], scale: 0.45, turn: 90 }] },
  {
    name: "Pisidian Antioch",
    at: [31.1892, 38.3061],
    radius: 450,
    walled: true,
    style: "roman",
    from: -280,
    landmarks: [
      { kind: "temple_greek", off: [150, 120], scale: 0.6, from: -20 },
      { kind: "theatre", off: [-100, -50], scale: 0.9 },
    ],
  },
  { name: "Iconium", at: [32.4932, 37.8728], radius: 600, walled: true, style: "greek", from: -3000 },
  { name: "Lystra", at: [32.33, 37.58], radius: 250, style: "greek", from: -200 },
  { name: "Derbe", at: [33.39, 37.34], radius: 200, style: "greek", from: -200 },
  {
    name: "Perga",
    at: [30.8536, 36.9603],
    radius: 450,
    walled: true,
    style: "roman",
    from: -1000,
    landmarks: [
      { kind: "theatre", off: [-300, -700], scale: 1.1 },
      { kind: "hippodrome", off: [-150, -480], scale: 0.5, turn: 90 },
    ],
    lines: [{ kind: "colonnade", off: [[0, -400], [0, 350]], from: 0 }],
  },
  { name: "Attalia", at: [30.7044, 36.8853], radius: 400, walled: true, style: "greek", from: -150, lines: [{ kind: "mole", off: [[-150, -250], [-50, -330]] }] },
  { name: "Myra", at: [29.985, 36.2589], radius: 350, style: "greek", from: -500, landmarks: [{ kind: "theatre", off: [0, 150], scale: 0.9 }] },
  { name: "Patara", at: [29.3175, 36.2647], radius: 350, style: "greek", from: -500, landmarks: [{ kind: "theatre", off: [100, -150], scale: 0.8 }, { kind: "lighthouse", at: [29.3141, 36.2632], scale: 0.25, from: 60 }] },
  { name: "Cnidus", at: [27.3739, 36.6856], radius: 400, walled: true, style: "greek", from: -360, landmarks: [{ kind: "theatre", off: [100, 50], scale: 0.8 }] },
  {
    name: "Rhodes",
    at: [28.2271, 36.4509],
    radius: 1100,
    walled: true,
    style: "greek",
    from: -408,
    landmarks: [
      { kind: "temple_greek", at: [28.2125, 36.4405], scale: 0.6 },
      { kind: "theatre", at: [28.2133, 36.4413], scale: 0.6 },
    ],
    lines: [{ kind: "mole", off: [[600, 600], [800, 450]] }],
  },
  { name: "Cos", at: [27.288, 36.893], radius: 450, walled: true, style: "greek", from: -366 },
  { name: "Hattusa", at: [34.615, 40.0197], radius: 1200, walled: true, style: "levant", from: -1650, to: -1180, landmarks: [{ kind: "citadel", off: [500, 300], scale: 2.2 }, { kind: "palace", off: [-200, 400], scale: 0.7 }] },
  { name: "Nicaea", at: [29.7203, 40.4292], radius: 650, walled: true, style: "greek", from: -316, phases: [{ from: -72, style: "roman" }], landmarks: [{ kind: "theatre", off: [-300, -300], scale: 1.1, from: 112 }] },
  {
    name: "Byzantium",
    at: [28.985, 41.008],
    radius: 900,
    walled: true,
    style: "greek",
    from: -667,
    phases: [{ from: 330, at: [28.97, 41.012], radius: 2400, style: "roman" }],
    landmarks: [{ kind: "hippodrome", at: [28.9755, 41.006], turn: -30, from: 203 }],
  },

  /* ---------------------------------------------------------- Cyprus, Crete */
  {
    name: "Paphos",
    at: [32.406, 34.7563],
    radius: 600,
    walled: true,
    style: "roman",
    from: -320,
    landmarks: [{ kind: "theatre", off: [400, 150], scale: 0.9 }],
    lines: [{ kind: "mole", off: [[-300, -350], [-50, -480]] }],
  },
  {
    name: "Salamis",
    at: [33.905, 35.183],
    radius: 900,
    walled: true,
    style: "roman",
    from: -1100,
    landmarks: [
      { kind: "theatre", off: [100, 300], scale: 1.2, turn: 180 },
      { kind: "temple_greek", off: [300, -600], scale: 0.7 },
      { kind: "paving", off: [50, 450], stretch: [3, 3] },
    ],
  },
  { name: "Kition", at: [33.63, 34.92], radius: 500, walled: true, style: "levant", from: -1300 },
  { name: "Knossos", at: [25.1631, 35.2981], radius: 500, style: "levant", from: -2000, to: -1375, landmarks: [{ kind: "palace", off: [0, 0], scale: 0.9 }] },
  { name: "Gortyn", at: [24.9472, 35.06], radius: 800, style: "roman", from: -1000, landmarks: [{ kind: "theatre", off: [-300, 300], scale: 1 }] },

  /* -------------------------------------------------------------- Greece */
  {
    name: "Athens",
    at: [23.725, 37.974],
    radius: 1100,
    walled: true,
    style: "greek",
    from: -1400,
    landmarks: [
      { kind: "temple_greek", at: [23.72656, 37.97153], turn: 90, from: -438 },
      { kind: "theatre", at: [23.7278, 37.9703], from: -500 },
      { kind: "theatre", at: [23.7246, 37.9708], scale: 0.75, from: 161 },
      { kind: "paving", at: [23.7225, 37.975], stretch: [10, 12], from: -600 },
      { kind: "temple_greek", at: [23.7215, 37.9756], scale: 0.5, turn: 90, from: -415 },
      { kind: "temple_greek", at: [23.733, 37.9693], scale: 1.7, turn: 90, from: 131 },
    ],
  },
  {
    name: "Corinth",
    at: [22.8796, 37.9055],
    radius: 900,
    walled: true,
    style: "greek",
    from: -900,
    phases: [{ from: -146, radius: 200, walled: false }, { from: -44, radius: 900, walled: true, style: "roman" }],
    landmarks: [
      { kind: "temple_greek", at: [22.879, 37.9065], scale: 0.7, turn: 90, from: -540 },
      { kind: "theatre", at: [22.8775, 37.907] },
      { kind: "paving", at: [22.88, 37.9055], stretch: [10, 5], from: -44 },
      { kind: "citadel", at: [22.871, 37.892], scale: 1.5, from: -700 },
    ],
    lines: [{ kind: "colonnade", path: [[22.88, 37.907], [22.881, 37.912]], from: 0 }],
  },
  { name: "Cenchreae", at: [22.9925, 37.8844], radius: 250, style: "greek", from: -700, lines: [{ kind: "mole", off: [[150, -100], [300, 50]] }, { kind: "mole", off: [[-150, -150], [-250, 30]] }] },
  {
    name: "Philippi",
    at: [24.2869, 41.0128],
    radius: 400,
    walled: true,
    style: "roman",
    from: -356,
    landmarks: [
      { kind: "theatre", off: [270, 30], scale: 0.9 },
      { kind: "paving", off: [0, -40], stretch: [5, 3.5] },
    ],
    // the Via Egnatia, through the city
    lines: [{ kind: "road", off: [[-900, -20], [900, 20]] }],
  },
  { name: "Thessalonica", at: [22.9444, 40.6401], radius: 900, walled: true, style: "roman", from: -315, landmarks: [{ kind: "paving", off: [0, 0], stretch: [5, 4] }], lines: [{ kind: "colonnade", off: [[-1000, -100], [1000, 100]] }] },
  { name: "Berea", at: [22.2019, 40.5236], radius: 400, style: "greek", from: -400 },
  { name: "Amphipolis", at: [23.8433, 40.8222], radius: 700, walled: true, style: "greek", from: -437 },
  { name: "Apollonia", at: [23.49, 40.623], radius: 300, style: "greek", from: -400 },
  { name: "Neapolis (Kavala)", at: [24.4128, 40.9372], radius: 300, walled: true, style: "greek", from: -650, lines: [{ kind: "mole", off: [[0, -250], [200, -320]] }] },
  { name: "Nicopolis", at: [20.7375, 39.0083], radius: 900, walled: true, style: "roman", from: -29, landmarks: [{ kind: "theatre", off: [0, 900], scale: 1.2 }] },
  { name: "Sparta", at: [22.43, 37.0725], radius: 600, style: "greek", from: -900, landmarks: [{ kind: "theatre", off: [-100, 200], scale: 1.1 }] },
  {
    name: "Delphi",
    at: [22.5011, 38.4824],
    radius: 150,
    houses: false,
    style: "greek",
    from: -800,
    landmarks: [
      { kind: "temple_greek", off: [0, 0], scale: 0.8, turn: 90 },
      { kind: "theatre", off: [-40, 60], scale: 0.6 },
    ],
  },

  /* -------------------------------------------------------- Italy, Sicily, Malta, Africa */
  {
    name: "Rome",
    at: [12.4853, 41.8925],
    radius: 1750,
    walled: true,
    style: "roman",
    from: -753,
    phases: [
      { from: -753, at: [12.4875, 41.8892], radius: 300 },
      { from: -378, at: [12.4853, 41.8925], radius: 1750 },
      { from: 271, radius: 2900 },
    ],
    landmarks: [
      { kind: "hippodrome", at: [12.4858, 41.8861], scale: 1.38, turn: 30, from: -500 },
      { kind: "amphitheatre", at: [12.4922, 41.8902], from: 80 },
      { kind: "temple_greek", at: [12.4818, 41.8929], scale: 1.1, from: -509 },
      { kind: "paving", at: [12.4853, 41.8925], stretch: [8, 4], turn: 30, from: -500 },
      { kind: "temple_greek", at: [12.4768, 41.8986], scale: 0.5, from: -27 },
      { kind: "theatre", at: [12.473, 41.895], scale: 1.6, turn: 90, from: -55 },
      { kind: "theatre", at: [12.48, 41.8918], scale: 1.2, from: -13 },
      { kind: "palace", at: [12.4875, 41.8888], scale: 1.2, from: 81 },
    ],
    lines: [{ kind: "aqueduct", path: [[12.505, 41.888], [12.522, 41.882], [12.55, 41.87], [12.59, 41.85]], from: 52 }],
  },
  { name: "Ostia", at: [12.2917, 41.7556], radius: 600, walled: true, style: "roman", from: -300, landmarks: [{ kind: "theatre", off: [-100, 80], scale: 0.8 }] },
  { name: "Puteoli", at: [14.1206, 40.8236], radius: 600, style: "roman", from: -194, landmarks: [{ kind: "amphitheatre", at: [14.125, 40.8264], scale: 0.8, from: 70 }], lines: [{ kind: "mole", off: [[-200, -300], [-150, -650]] }] },
  {
    name: "Pompeii",
    at: [14.4847, 40.7489],
    radius: 600,
    walled: true,
    style: "roman",
    from: -600,
    to: 79,
    landmarks: [
      { kind: "amphitheatre", at: [14.495, 40.751], scale: 0.7, from: -70 },
      { kind: "theatre", at: [14.4885, 40.7485], scale: 0.7 },
      { kind: "paving", at: [14.4848, 40.7491], stretch: [2, 7] },
      { kind: "temple_greek", at: [14.4849, 40.7498], scale: 0.4 },
    ],
  },
  { name: "Rhegium", at: [15.6519, 38.1111], radius: 500, walled: true, style: "greek", from: -720 },
  {
    name: "Syracuse",
    at: [15.283, 37.072],
    radius: 1500,
    walled: true,
    style: "greek",
    from: -734,
    landmarks: [
      { kind: "theatre", at: [15.2756, 37.0763], scale: 1.3 },
      { kind: "temple_greek", at: [15.2925, 37.0636], scale: 0.65, turn: 90 },
      { kind: "amphitheatre", at: [15.2789, 37.0735], scale: 0.75, from: 50 },
    ],
  },
  { name: "Melita", at: [14.4033, 35.8858], radius: 400, walled: true, style: "roman", from: -800 },
  {
    name: "Carthage",
    at: [10.3233, 36.8528],
    radius: 1500,
    walled: true,
    style: "levant",
    from: -814,
    to: 698,
    phases: [{ from: -146, radius: 0, houses: false, walled: false }, { from: -29, radius: 1400, houses: true, walled: false, style: "roman" }],
    landmarks: [
      { kind: "hippodrome", at: [10.314, 36.856], scale: 1.1, turn: 60, from: 100 },
      { kind: "amphitheatre", at: [10.3155, 36.8605], scale: 0.85, from: 100 },
      { kind: "theatre", at: [10.3285, 36.8558], scale: 1.1, from: 100 },
    ],
  },
  {
    name: "Cyrene",
    at: [21.8579, 32.825],
    radius: 800,
    walled: true,
    style: "greek",
    from: -631,
    landmarks: [
      { kind: "temple_greek", off: [-600, 250], scale: 0.6, turn: 90 },
      { kind: "temple_greek", off: [700, 200], scale: 1.1, turn: 90, from: -500 },
      { kind: "theatre", off: [-700, 150], scale: 1 },
      { kind: "paving", off: [-100, -100], stretch: [4, 4] },
    ],
  },

  /* ---------------------------------------------------------------- Egypt */
  { name: "Memphis", at: [31.2552, 29.8449], radius: 1000, walled: true, style: "egypt", from: -3100, to: 640, landmarks: [{ kind: "egypt_temple", off: [0, 0], scale: 1.6, from: -1300 }] },
  {
    name: "Giza",
    at: [31.1342, 29.9792],
    radius: 450,
    houses: false,
    style: "egypt",
    from: -2560,
    landmarks: [
      { kind: "pyramid", at: [31.1342, 29.9792] },
      { kind: "pyramid", at: [31.1308, 29.9761], scale: 0.94 },
      { kind: "pyramid", at: [31.1281, 29.9725], scale: 0.45 },
    ],
  },
  { name: "Saqqara", at: [31.2165, 29.8713], radius: 70, houses: false, style: "egypt", from: -2650, landmarks: [{ kind: "step_pyramid", off: [0, 0] }] },
  {
    name: "On",
    at: [31.2876, 30.1292],
    radius: 600,
    walled: true,
    style: "egypt",
    from: -2500,
    to: -30,
    landmarks: [
      { kind: "egypt_temple", off: [0, 160], scale: 1.4, from: -2000 },
      { kind: "obelisk", off: [0, 0], from: -1950 },
    ],
  },
  {
    name: "Rameses",
    at: [31.8225, 30.7996],
    radius: 1300,
    style: "egypt",
    from: -1280,
    to: -1060,
    landmarks: [
      { kind: "palace", off: [0, 0], scale: 1.2 },
      { kind: "egypt_temple", off: [400, 300], scale: 1 },
    ],
  },
  {
    name: "Zoan",
    at: [31.88, 30.9767],
    radius: 800,
    walled: true,
    style: "egypt",
    from: -1070,
    to: 500,
    landmarks: [
      { kind: "egypt_temple", off: [0, 0], scale: 1.5, turn: 90 },
      { kind: "obelisk", off: [-150, -30] },
      { kind: "obelisk", off: [-150, 30] },
    ],
  },
  { name: "Pithom", at: [32.1033, 30.5528], radius: 300, walled: true, style: "egypt", from: -1300, to: -600 },
  { name: "Pelusium", at: [32.57, 31.0428], radius: 600, walled: true, style: "egypt", from: -700 },
  {
    name: "Alexandria",
    at: [29.9187, 31.2001],
    radius: half(ALEXANDRIA),
    rect: ALEXANDRIA,
    walled: true,
    style: "greek",
    from: -331,
    phases: [{ from: -30, style: "roman" }],
    landmarks: [
      // the Pharos, one of the seven wonders, on its island
      { kind: "lighthouse", at: [29.8853, 31.2139], from: -280, to: 1303 },
      { kind: "palace", at: [29.905, 31.204], scale: 1.5, turn: 77 },
      { kind: "theatre", at: [29.903, 31.202], scale: 1.1, turn: 180, from: -250 },
      { kind: "temple_greek", at: [29.8964, 31.1826], scale: 0.8, from: -240 },
      { kind: "obelisk", at: [29.903, 31.2035], from: -13 },
      { kind: "obelisk", at: [29.9033, 31.2033], from: -13 },
    ],
    lines: [
      // the Heptastadion, the causeway to Pharos island
      { kind: "mole", path: [[29.893, 31.202], [29.889, 31.2125]], from: -280 },
      { kind: "mole", path: [[29.905, 31.205], [29.9005, 31.2125]] },
      // the Canopic Way, the city's colonnaded spine
      { kind: "colonnade", off: [along(77, -2300), along(77, 2300)] },
    ],
  },
  {
    name: "Thebes",
    at: [32.6573, 25.7188],
    radius: 1500,
    style: "egypt",
    from: -2050,
    to: -27,
    landmarks: [
      // Karnak, its gate to the west and the Nile; Luxor to the south; a temple across the river
      { kind: "egypt_temple", at: [32.6573, 25.7188], scale: 2.8, turn: 90 },
      { kind: "egypt_temple", at: [32.639, 25.6995], scale: 1.8, turn: 210, from: -1390 },
      { kind: "obelisk", at: [32.6388, 25.7004], from: -1270 },
      { kind: "egypt_temple", at: [32.6, 25.7195], scale: 1.2, turn: 90, from: -1270 },
    ],
    // the avenue of sphinxes from Luxor to Karnak
    lines: [{ kind: "road", path: [[32.6395, 25.701], [32.656, 25.717]], from: -1400 }],
  },
  {
    name: "Akhetaten",
    at: [30.8936, 27.645],
    radius: half(AMARNA),
    rect: AMARNA,
    style: "egypt",
    from: -1346,
    to: -1332,
    landmarks: [
      { kind: "egypt_temple", off: [350, 1300], scale: 2, turn: 90 },
      { kind: "palace", off: [-150, 1000], scale: 1.5 },
    ],
  },
  { name: "Abydos", at: [31.9197, 26.1847], radius: 400, style: "egypt", from: -3100, landmarks: [{ kind: "egypt_temple", off: [0, 0], scale: 1.2, from: -1290 }] },
  { name: "Syene", at: [32.8869, 24.0903], radius: 300, style: "egypt", from: -3000, landmarks: [{ kind: "egypt_temple", off: [-400, 100], scale: 0.8 }] },

  /* --------------------------------------------------------- Mesopotamia */
  { name: "Ur", at: [46.1031, 30.9627], radius: 520, walled: true, style: "mesopotamia", from: -3800, to: -500, landmarks: [{ kind: "ziggurat", off: [-120, 160], scale: 0.65, turn: 45, from: -2100 }] },
  {
    name: "Uruk",
    at: [45.6372, 31.3236],
    radius: 1400,
    walled: true,
    style: "mesopotamia",
    from: -4000,
    to: 300,
    landmarks: [
      { kind: "ziggurat", off: [-450, 300], scale: 0.35 },
      { kind: "ziggurat", off: [100, 0], scale: 0.55, from: -2100 },
    ],
  },
  { name: "Eridu", at: [45.9961, 30.8158], radius: 300, style: "mesopotamia", from: -5400, to: -2050, landmarks: [{ kind: "ziggurat", off: [0, 0], scale: 0.45 }] },
  { name: "Nippur", at: [45.2306, 32.1267], radius: 700, walled: true, style: "mesopotamia", from: -5000, to: 800, landmarks: [{ kind: "ziggurat", off: [-200, 200], scale: 0.6 }] },
  { name: "Kish", at: [44.6025, 32.5408], radius: 800, style: "mesopotamia", from: -3100, to: -500, landmarks: [{ kind: "ziggurat", off: [0, 0], scale: 0.4 }] },
  {
    name: "Babylon",
    at: [44.4209, 32.5364],
    radius: half(BABYLON),
    rect: BABYLON,
    walled: true,
    style: "mesopotamia",
    from: -2300,
    to: 100,
    landmarks: [
      // Etemenanki, "the house of the foundation of heaven and earth"; Esagila, Marduk's temple, south of it
      { kind: "ziggurat", off: [-250, 0], from: -1800 },
      { kind: "palace", off: [-250, -380], scale: 0.85, from: -1800 },
      // Nebuchadnezzar's Southern Palace and the Ishtar Gate, the processional way through it
      { kind: "palace", off: [-380, 900], scale: 1.6, from: -600 },
      { kind: "gate_glazed", off: [-120, 1200], from: -575 },
    ],
    lines: [{ kind: "road", off: [[-120, 1750], [-120, 250]], from: -600 }],
  },
  { name: "Borsippa", at: [44.3417, 32.3917], radius: 400, walled: true, style: "mesopotamia", from: -2000, to: 100, landmarks: [{ kind: "ziggurat", off: [0, 0], scale: 0.75 }] },
  { name: "Sippar", at: [44.2547, 33.0597], radius: 500, walled: true, style: "mesopotamia", from: -3000, to: -500, landmarks: [{ kind: "ziggurat", off: [0, 0], scale: 0.4 }] },
  { name: "Seleucia on the Tigris", at: [44.52, 33.09], radius: half(SELEUCIA_TIGRIS), rect: SELEUCIA_TIGRIS, walled: true, style: "greek", from: -305, to: 165 },
  { name: "Ctesiphon", at: [44.5806, 33.0939], radius: 1500, walled: true, style: "persia", from: -120, landmarks: [{ kind: "palace", off: [0, 0], scale: 1.2 }] },
  {
    name: "Calah",
    at: [43.3289, 36.0989],
    radius: 1200,
    walled: true,
    style: "mesopotamia",
    from: -1250,
    to: -612,
    landmarks: [
      { kind: "ziggurat", off: [-700, 400], scale: 0.6, from: -879 },
      { kind: "palace", off: [-600, 180], scale: 1.3, from: -879 },
    ],
  },
  {
    name: "Assur",
    at: [43.2622, 35.4561],
    radius: 700,
    walled: true,
    style: "mesopotamia",
    from: -2600,
    to: -614,
    landmarks: [
      { kind: "ziggurat", off: [100, 350], scale: 0.65 },
      { kind: "palace", off: [-100, 300], scale: 0.8 },
    ],
  },
  {
    name: "Dur-Sharrukin",
    at: [43.2294, 36.5094],
    radius: half(DUR_SHARRUKIN),
    rect: DUR_SHARRUKIN,
    walled: true,
    style: "mesopotamia",
    from: -717,
    to: -612,
    landmarks: [
      { kind: "palace", off: [-450, 650], scale: 1.4, turn: 45 },
      { kind: "ziggurat", off: [-560, 760], scale: 0.5, turn: 45 },
    ],
  },
  {
    name: "Nineveh",
    at: [43.162, 36.352],
    radius: half(NINEVEH),
    rect: NINEVEH,
    walled: true,
    style: "mesopotamia",
    from: -6000,
    to: -612,
    // a town on Kuyunjik for millennia; Sennacherib's capital, its twelve kilometres of wall, from 705
    phases: [{ from: -6000, at: [43.1531, 36.3594], radius: 600, rect: undefined }, { from: -705, at: [43.162, 36.352], radius: half(NINEVEH), rect: NINEVEH }],
    landmarks: [
      { kind: "palace", at: [43.1531, 36.3594], scale: 1.8, from: -703 },
      { kind: "palace", at: [43.1555, 36.3633], scale: 1.2, from: -645 },
      { kind: "palace", at: [43.158, 36.344], scale: 1, from: -700 },
      { kind: "ziggurat", at: [43.1508, 36.3612], scale: 0.4 },
    ],
  },
  { name: "Arbela", at: [44.0092, 36.1911], radius: 500, walled: true, style: "mesopotamia", from: -5000, landmarks: [{ kind: "citadel", off: [0, 0], scale: 2.5 }] },

  /* ----------------------------------------------------------- Persia, Elam */
  {
    name: "Susa",
    at: [48.2575, 32.1894],
    radius: 1000,
    walled: true,
    style: "persia",
    from: -4200,
    landmarks: [
      { kind: "ziggurat", off: [0, 0], scale: 0.5, from: -1250, to: -646 },
      { kind: "apadana", off: [-200, 520], scale: 1.1, from: -515 },
      { kind: "palace", off: [-220, 330], scale: 1, from: -515 },
    ],
  },
  { name: "Chogha Zanbil", at: [48.5217, 32.0083], radius: 0, houses: false, style: "persia", from: -1250, to: -640, landmarks: [{ kind: "ziggurat", off: [0, 0], scale: 1.15, turn: 45 }] },
  {
    name: "Persepolis",
    at: [52.8908, 29.9353],
    radius: half(PERSEPOLIS),
    rect: PERSEPOLIS,
    walled: true,
    houses: false,
    style: "persia",
    from: -518,
    to: -330,
    landmarks: [
      { kind: "paving", off: [0, 0], stretch: [15, 22.5] },
      { kind: "apadana", off: [-40, 40], scale: 0.9 },
      { kind: "apadana", off: [80, 20], scale: 0.75 },
      { kind: "palace", off: [-50, -120], scale: 0.5 },
    ],
  },
  { name: "Pasargadae", at: [53.1675, 30.1939], radius: 0, houses: false, style: "persia", from: -546, to: -330, landmarks: [{ kind: "step_pyramid", off: [0, -900], scale: 0.12 }, { kind: "palace", off: [0, 0], scale: 0.5 }] },
  { name: "Ecbatana", at: [48.5156, 34.8064], radius: 1000, walled: true, style: "persia", from: -700, landmarks: [{ kind: "citadel", off: [0, 0], scale: 1.6 }] },

  /* ---------------------------------------------------------------- Arabia */
  { name: "Tema", at: [38.55, 27.63], radius: 600, walled: true, style: "mesopotamia", from: -800, landmarks: [{ kind: "palace", off: [0, 0], scale: 0.8, from: -552, to: -543 }] },
  { name: "Dedan", at: [37.88, 26.65], radius: 400, style: "levant", from: -800 },
];
