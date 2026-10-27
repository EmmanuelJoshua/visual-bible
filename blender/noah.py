"""
Noah's Ark, Genesis 6:14–7:18, step by step.

    npm run build:models -- noah

Dimensions mirror `N` in `src/data/builds/noah.ts` (300 × 50 × 30 cubits,
stories at 2.8, 11 and 20); step ids match NOAH_STEPS. The flood (the last
step) is water and stays in the app.

The text gives only the dimensions. This draws them as a ship: a lofted hull,
rounded at the bow and full at the stern, planked in strakes, with a long
deckhouse whose roof sits a cubit above a window running round it. In the
step-by-step view the near (south) side is cut away from x = −30 so the
stories show; on the map the hull is whole (parts tagged view="build"/"map").
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from vb import Step, beast, cloth, export, out_path, place, reset, rod, skin_object  # noqa: E402

# ---- N, from src/data/builds/noah.ts ----
L, W, H = 300.0, 50.0, 30.0
DECKS = (2.8, 11.0, 20.0)
CUT_X = -30.0
DOOR_X, DOOR_Y0, DOOR_Y1 = -90.0, 11.0, 20.0
B = W / 2  # half-breadth amidships
BOTTOM = 1.0  # underside of the hull, on its cradles
BULWARK = 1.5  # rail above the main deck
HOUSE_X, HOUSE_Z = 105.0, 15.0  # deckhouse half-length and half-breadth
HOUSE_TOP = 29.0  # wall top; the window runs from here to the roof, a cubit
ROOM = 20.0

reset()


# ------------------------------------------------------------------ the hull
def half_breadth(x):
    """plan: rounded to the bow (+x), full to a narrow transom at the stern (−x)"""
    if x > 60:
        u = min(1.0, (x - 60) / 90)
        return B * max(0.0, 1 - u * u) ** 0.55
    if x < -90:
        u = min(1.0, (-x - 90) / 60)
        return B * (0.32 + 0.68 * max(0.0, 1 - u * u) ** 0.5)
    return B


def deck_y(x):
    """the main deck, flat amidships, rising a little to the ends (sheer)"""
    return DECKS[2] + 2.5 * max(0.0, (abs(x) - 110) / 40) ** 2


def keel_y(x):
    """the bottom lifts into the forefoot at the bow and a little at the stern"""
    if x > 115:
        return BOTTOM + 7.0 * ((x - 115) / 35) ** 2
    if x < -130:
        return BOTTOM + 3.0 * ((-x - 130) / 20) ** 2
    return BOTTOM


def section(x, s):
    """
    A point on the starboard (+z) side of the hull at station x, girth s ∈ [0, 1]:
    flat bottom, round bilge, upright side to the bulwark top.
    """
    b = half_breadth(x)
    y0 = keel_y(x)
    top = deck_y(x) + BULWARK
    R = min(0.38 * b, (top - y0) * 0.6)
    bw = b - R
    flat, arc = bw, math.pi * R / 2
    side = max(0.0, top - (y0 + R))
    d = s * (flat + arc + side)
    if d <= flat:
        return (x, y0, d)
    d -= flat
    if d <= arc:
        a = d / R if R > 0 else 0
        return (x, y0 + R - R * math.cos(a), bw + R * math.sin(a))
    d -= arc
    return (x, y0 + R + d, b)


def inside_half_width(x, y):
    """the hull's inner half-width at height y (for decks and stalls)"""
    b = half_breadth(x)
    y0 = keel_y(x)
    R = min(0.38 * b, (deck_y(x) + BULWARK - y0) * 0.6)
    if y < y0:
        return 0.0
    if y >= y0 + R:
        return b - 0.7
    dy = y0 + R - y
    return max(0.0, b - R + math.sqrt(max(0.0, R * R - dy * dy)) - 0.7)


STATIONS = [-L / 2 + i * 3.0 for i in range(101)]


def strake(p, key, s0, s1, side, x0=-L / 2, x1=L / 2, thick=0.45, out=0.0):
    """one band of planking between girths s0 and s1, on one side, from x0 to x1"""
    xs = [x for x in STATIONS if x0 - 1e-6 <= x <= x1 + 1e-6]
    if len(xs) < 2:
        return
    rows = []
    for s in (s0, (s0 + s1) / 2, s1):
        row = []
        for x in xs:
            px, py, pz = section(x, s)
            row.append((px, py, side * (pz + out)))
        rows.append(row)
    cloth(p, key, rows, thick=thick)


def x_extent(zabs, y):
    """the x range a plank at |z| and height y can span inside the hull"""
    lo = next((x for x in STATIONS if inside_half_width(x, y) >= zabs), None)
    hi = next((x for x in reversed(STATIONS) if inside_half_width(x, y) >= zabs), None)
    return lo, hi


# --------------------------------------------------------------------- keel
s = Step("keel")
for i in range(7):
    p = s.part("cradle", tally="cedar")
    p.box("cedar", (3, 0.8, 30), (-135 + 45 * i, 0.4, 0), bevel=0.1)
    p.done()
p = s.part("keel", anim="grow:x", hero=True, tally="wood")
# the keel along the bottom, the stem rising at the bow, the stern post at the transom
pts = [(x, keel_y(x) - 0.4, 0.0) for x in STATIONS]
for a, b in zip(pts, pts[1:]):
    rod(p, "wood", a, b, 0.9, segs=8)
stem = [(150.0 - 4 * (1 - math.cos(math.pi / 2 * u)), keel_y(150) - 0.4 + (deck_y(150) + BULWARK + 2.5 - keel_y(150)) * math.sin(math.pi / 2 * u), 0.0) for u in [k / 10 for k in range(11)]]
for a, b in zip(stem, stem[1:]):
    rod(p, "wood", a, b, 0.8, segs=8)
p.box("wood", (1.6, deck_y(-150) + BULWARK + 3 - keel_y(-150), 1.4), (-150.6, (deck_y(-150) + BULWARK + 3 + keel_y(-150)) / 2, 0), bevel=0.15)
p.done()
for side in (-1, 1):
    p = s.part("bottom", tally="wood")
    for k in range(4):
        strake(p, "wood", 0.0 + 0.06 * k, 0.06 * (k + 1) - 0.004, side)
    p.done()

# ------------------------------------------------------------------- frames
s = Step("frames")
for i in range(21):
    x = -L / 2 + 15 * i
    x = max(-L / 2 + 2, min(L / 2 - 6, x))
    p = s.part("frame", anim="grow", tally="wood")
    for side in (-1, 1):
        rib = [section(x, u / 12) for u in range(13)]
        rib = [(px, py, side * (pz - 0.5)) for px, py, pz in rib]
        for a, b in zip(rib, rib[1:]):
            rod(p, "wood", a, b, 0.42, segs=6)
    # deck beams across at each story
    for y in (DECKS[1], deck_y(x)):
        hw = inside_half_width(x, y - 0.6)
        if hw > 1:
            p.box("wood", (0.9, 0.7, 2 * hw), (x, y - 0.95, 0), bevel=0.06)
    p.done()

# ----------------------------------------------------------------- planking
s = Step("planking")
GIRTH = [0.24 + (1 - 0.24) * k / 24 for k in range(25)]
SEAM = 0.0025
CUT_FROM = 8  # strakes below this stay whole on the near side, even cut away
for j in range(6):
    ks = tuple(range(4 * j, 4 * j + 4))
    # far (north) side, whole
    p = s.part(f"strake{j}_far", tally="wood")
    for k in ks:
        strake(p, "wood", GIRTH[k], GIRTH[k + 1] - SEAM, +1, thick=0.3)
    p.done()
    # near (south) side: whole on the map; cut away in the step-by-step view
    if ks[0] < CUT_FROM:
        p = s.part(f"strake{j}_near", tally="wood")
        for k in ks:
            strake(p, "wood", GIRTH[k], GIRTH[k + 1] - SEAM, -1, thick=0.3)
        p.done()
    else:
        p = s.part(f"strake{j}_near_cut", tally="wood", view="build")
        for k in ks:
            strake(p, "wood", GIRTH[k], GIRTH[k + 1] - SEAM, -1, x1=CUT_X, thick=0.3)
        p.done()
        p = s.part(f"strake{j}_near_whole", tally="wood", view="map")
        for k in ks:
            strake(p, "wood", GIRTH[k], GIRTH[k + 1] - SEAM, -1, thick=0.3)
        p.done()
# the bilge strakes between bottom and sides
for side in (-1, 1):
    p = s.part("bilge", tally="wood")
    strake(p, "wood", 0.24 - 0.004, 0.24 + 0.002, side, thick=0.6)
    p.done()
# the rail capping the bulwark, and the transom closing the stern
p = s.part("rail", tally="wood")
for side in (-1, 1):
    rail = [section(x, 1.0) for x in STATIONS]
    rail = [(px, py + 0.25, side * pz) for px, py, pz in rail]
    for a, b in zip(rail, rail[1:]):
        rod(p, "cedar", a, b, 0.45, segs=6)
x0 = -L / 2
tb = half_breadth(x0)
for k in range(10):
    zz = -tb + (2 * tb) * (k + 0.5) / 10
    y0 = keel_y(x0)
    p.box("wood", (0.6, deck_y(x0) + BULWARK - y0, 2 * tb / 10 - 0.08), (x0 - 0.3, (deck_y(x0) + BULWARK + y0) / 2, zz), bevel=0.05)
p.done()

# -------------------------------------------------------------------- pitch
s = Step("pitch")
# drawn below the waterline outside, so the planking still reads above it;
# the text has it over the whole hull, within and without
WATER_S = 0.42
for side in (-1, 1):
    p = s.part("pitch_out", anim="grow", tally="pitch")
    strake(p, "pitch", 0.0, WATER_S, side, thick=0.2, out=0.32)
    p.done()
p = s.part("pitch_in", anim="grow", tally="pitch")
for side in (-1, 1):
    strake(p, "pitch", 0.24, 1.0, side, thick=0.1, out=-0.55, x1=L / 2 if side > 0 else CUT_X)
p.done()

# -------------------------------------------------------------------- decks
s = Step("decks")
for y in (DECKS[1], DECKS[2]):
    p = s.part("deck", anim="grow:x", tally="cedar")
    n = int(2 * B)
    for k in range(n):
        zz = -B + k + 0.5
        lo, hi = x_extent(abs(zz) + 0.4, y - 0.3)
        if lo is None or hi is None or hi - lo < 2:
            continue
        x = lo
        off = (k % 4) * 9.0
        first = True
        while x < hi - 0.5:
            seg = 36.0 - off if first and off else 36.0
            first = False
            b = min(x + seg, hi)
            p.box("cedar", (b - x - 0.06, 0.6, 0.95), ((x + b) / 2, (deck_y((x + b) / 2) if y == DECKS[2] else y) - 0.3, zz))
            x = b
    p.done()

# -------------------------------------------------------------------- rooms
s = Step("rooms")


def slat_wall_x(p, x0, x1, y, zc, h=5.0):
    """a partition along x: posts, three rails"""
    x = x0
    while x <= x1 + 1e-6:
        p.box("wood", (0.4, h, 0.4), (x, y + h / 2, zc))
        x += 4
    for ry in (0.6, h / 2, h - 0.2):
        p.box("wood", (x1 - x0, 0.3, 0.25), ((x0 + x1) / 2, y + ry, zc))


def slat_wall_z(p, z0, z1, y, xc, h=5.0):
    for zz in (z0, (z0 + z1) / 2, z1):
        p.box("wood", (0.4, h, 0.4), (xc, y + h / 2, zz))
    for ry in (0.6, h / 2, h - 0.2):
        p.box("wood", (0.25, 0.3, abs(z1 - z0)), (xc, y + ry, (z0 + z1) / 2))
    for k in range(int(abs(z1 - z0) / 0.9)):
        zz = min(z0, z1) + 0.45 + 0.9 * k
        p.box("wood", (0.12, h - 1, 0.3), (xc, y + h / 2 - 0.1, zz))


# two stories inside the hull, the third inside the deckhouse
LEVELS = [(DECKS[0], 8.0, None), (DECKS[1], 8.0, None), (DECKS[2], 6.0, HOUSE_Z - 0.8)]
for d, (y, corridor, wall) in enumerate(LEVELS):
    p = s.part(f"corridor{d}", tally="wood")
    for side in (-1, 1):
        slat_wall_x(p, -130 if wall is None else -HOUSE_X + 5, 130 if wall is None else HOUSE_X - 5, y, side * corridor)
    p.done()
    for side in (-1, 1):
        p = s.part(f"stalls{d}", tally="wood")
        for i in range(15):
            xc = -140 + ROOM * i
            if wall is not None and abs(xc) > HOUSE_X - 4:
                continue
            outer = wall if wall is not None else inside_half_width(xc, y + 2.5) - 0.3
            if outer - corridor < 2:
                continue
            slat_wall_z(p, side * corridor, side * outer, y, xc)
        p.done()

# --------------------------------------------------------------------- roof
s = Step("roof", anchor=(60, 30, -HOUSE_Z))
# the deckhouse walls of upright boards; the near wall cut away in the step-by-step view
for side in (-1, 1):
    for view, x1 in ((None, HOUSE_X),) if side > 0 else (("build", CUT_X), ("map", HOUSE_X)):
        p = s.part("house_wall", tally="wood", view=view)
        z = side * HOUSE_Z
        n = int((x1 + HOUSE_X) / 1.0)
        for k in range(n):
            x = -HOUSE_X + (k + 0.5) * (x1 + HOUSE_X) / n
            p.box("wood", ((x1 + HOUSE_X) / n - 0.08, HOUSE_TOP - DECKS[2], 0.4), (x, (HOUSE_TOP + DECKS[2]) / 2, z), bevel=0.03)
        p.box("cedar", (x1 + HOUSE_X, 0.5, 0.6), ((x1 - HOUSE_X) / 2, HOUSE_TOP - 0.25, z), bevel=0.05)
        p.done()
p = s.part("house_ends", tally="wood")
for xe in (-HOUSE_X, HOUSE_X):
    n = 30
    for k in range(n):
        zz = -HOUSE_Z + (k + 0.5) * 2 * HOUSE_Z / n
        p.box("wood", (0.4, HOUSE_TOP - DECKS[2], 2 * HOUSE_Z / n - 0.08), (xe, (HOUSE_TOP + DECKS[2]) / 2, zz), bevel=0.03)
p.done()
# posts in the window: a cubit-high opening all round, under the roof (Genesis 6:16)
p = s.part("window_posts", tally="wood")
x = -HOUSE_X
while x <= HOUSE_X + 1e-6:
    for side in (-1, 1):
        if side < 0 and x > CUT_X:
            continue
        p.box("cedar", (0.6, 1.0, 0.6), (x, HOUSE_TOP + 0.5, side * HOUSE_Z), bevel=0.05)
    x += 7.5
p.done()
slope = math.atan2(2.4, HOUSE_Z + 1.5)
run = math.hypot(2.4, HOUSE_Z + 1.5)
for side, views in ((1, ((None, HOUSE_X + 2),)), (-1, (("build", CUT_X), ("map", HOUSE_X + 2)))):
    for view, x1 in views:
        p = s.part("roof_north" if side > 0 else "roof_south", hero=side > 0 and view is None, tally="cedar", view=view)
        x0 = -HOUSE_X - 2
        x = x0
        while x <= x1 + 1e-6:
            p.box("cedar", (0.5, 0.5, run), (x, HOUSE_TOP + 1.0 + 1.0, side * (HOUSE_Z + 1.5) / 2), rot_x=side * slope, bevel=0.04)
            x += 5
        n = 16
        for k in range(n):
            u = (k + 0.5) / n
            zz = side * (HOUSE_Z + 1.5) * u
            yy = HOUSE_TOP + 1.0 + 2.4 * (1 - u) + 0.45
            planks = int((x1 - x0) / 30) + 1
            for q in range(planks):
                a = max(x0, x0 + q * 30 + (k % 2) * 15 - 15)
                b = min(a + 30, x1)
                if b - a > 0.5:
                    p.box("cedar", (b - a - 0.05, 0.25, run / n - 0.04), ((a + b) / 2, yy, zz), rot_x=side * slope)
        p.done()
p = s.part("ridge", tally="cedar")
p.box("cedar", (2 * HOUSE_X + 4, 0.6, 0.8), (0, HOUSE_TOP + 1.0 + 2.4 + 0.7, 0), bevel=0.08)
p.done()

# --------------------------------------------------------------------- door
s = Step("door")
# set in the side, at the middle story (Genesis 6:16)
zd = -(half_breadth(DOOR_X) + 0.55)
dw = 8
dh = DOOR_Y1 - DOOR_Y0
p = s.part("door", hero=True, tally="wood")
for k in range(8):
    p.box("wood", (dw / 8 - 0.04, dh, 0.3), (DOOR_X - dw / 2 + dw / 8 * (k + 0.5), DOOR_Y0 + dh / 2, zd), bevel=0.03)
for yy in (DOOR_Y0 + 1.5, DOOR_Y0 + dh / 2, DOOR_Y1 - 1.5):
    p.box("pitch", (dw - 0.4, 0.5, 0.2), (DOOR_X, yy, zd - 0.25), bevel=0.04)
p.done()
p = s.part("frame", tally="cedar")
p.box("cedar", (dw + 1.2, 0.6, 0.5), (DOOR_X, DOOR_Y1 + 0.3, zd), bevel=0.05)
for side in (-1, 1):
    p.box("cedar", (0.6, dh + 0.6, 0.5), (DOOR_X + side * (dw / 2 + 0.3), DOOR_Y0 + dh / 2, zd), bevel=0.05)
p.done()
p = s.part("ramp", anim="slide:0,0,-12", tally="cedar")
length = 20.2
run_z = math.sqrt(length**2 - DOOR_Y0**2)
tilt = math.atan2(DOOR_Y0, run_z)
cz = zd - run_z / 2
# the ramp rises toward the door (−z is outward)
p.box("cedar", (dw, 0.6, length), (DOOR_X, DOOR_Y0 / 2, cz), rot_x=-tilt, bevel=0.05)
for k in range(14):
    u = (k + 0.5) / 14
    yy = DOOR_Y0 * (1 - u) + 0.45
    zz = zd - run_z * u
    p.box("cedar", (dw - 0.6, 0.25, 0.35), (DOOR_X, yy, zz), rot_x=-tilt, bevel=0.03)
p.done()

# --------------------------------------------------------------- provisions
s = Step("provisions")
barrel = [(0, 0), (0.75, 0), (0.85, 0.3), (0.92, 1.0), (0.85, 1.7), (0.75, 2.0), (0, 2.0)]
for i in range(8):
    p = s.part("stores", tally="none")
    for zz in (9, 12.5):
        x = -70 + ROOM * i + (-3 if zz == 9 else 3)
        p.lathe("cedar", barrel, (x, DECKS[2], zz), segs=16)
        for hy in (0.35, 1.65):
            p.torus("pitch", 0.89, 0.05, (x, DECKS[2] + hy, zz), segs=(20, 4))
    for k in range(3):
        p.sphere("linen", 0.75, (-70 + ROOM * i - 1.2 + 1.2 * k, DECKS[1] + 0.5, 15 + (k % 2) * 0.6), segs=(10, 6), scale=(1.1, 0.7, 0.9))
    p.box("fir", (2.4, 1.2, 1.4), (-70 + ROOM * i + 2.5, DECKS[1] + 0.6, 12), bevel=0.15, segments=2)  # hay
    p.done()

# ------------------------------------------------------------------ animals
BEASTS = {
    "elephant": dict(length=4.0, leg=1.6, girth=1.25, head=0.6, trunk=1.4, tail=0.8),
    "hippo": dict(length=3.4, leg=0.6, girth=0.95, head=0.55, tail=0.3),
    "ox": dict(length=2.4, leg=1.0, girth=0.6, head=0.3, horns=0.35),
    "horse": dict(length=2.3, leg=1.4, girth=0.45, neck=0.9, head=0.27, tail=0.9),
    "camel": dict(length=2.3, leg=1.8, girth=0.45, neck=1.1, head=0.25, hump=0.7),
    "giraffe": dict(length=2.2, leg=2.0, girth=0.45, neck=2.6, head=0.22, horns=0.12),
    "sheep": dict(length=1.2, leg=0.5, girth=0.42, head=0.2, tail=0.2),
    "lion": dict(length=2.0, leg=0.85, girth=0.45, head=0.38, tail=0.9),
}
PLAN = [
    [("elephant", "hideGrey"), ("hippo", "hideBrown"), ("ox", "hideBrown"), ("elephant", "hideGrey")],
    [("camel", "hideTan"), ("horse", "hideBrown"), ("ox", "hideWhite"), ("lion", "hideTan")],
    [("giraffe", "hideTan"), ("sheep", "hideWhite"), ("lion", "hideTan"), ("sheep", "hideWhite")],
]
s = Step("animals")
for d, (y, corridor, wall) in enumerate(LEVELS):
    outer = 21.0 if wall is None else wall
    for i in range(8):
        kind, hide = PLAN[d][i % 4]
        x = -10 + ROOM * i if wall is None else -70 + ROOM * i
        if wall is not None and abs(x) > HOUSE_X - 8:
            continue
        p = s.part(f"{kind}s", anim="pop", hero=(d == 0 and i == 0), tally="none")
        mid = -(corridor + outer) / 2
        for dz, face in ((mid + 2.5, 1), (mid - 2.5, -1)):
            yaw = 0.0 if face > 0 else math.pi
            sk = beast(x + face * 0.6, y, dz, yaw, **BEASTS[kind])
            p.merge_object(hide, skin_object(kind, *sk, subsurf=1))
            if kind == "lion":  # a mane
                p.sphere(hide, 0.55, (x + face * (0.6 + 1.0), y + 0.85 + 0.45 * 0.95 + 0.4, dz), segs=(10, 6), scale=(0.8, 1.1, 1.1))
        p.done()

export(out_path())
