"""
Noah's Ark, Genesis 6:14–7:18, step by step.

    npm run build:models -- noah

Dimensions mirror `N` in `src/data/builds/noah.ts`; step ids match
NOAH_STEPS. The flood (the last step) is water and stays in the app.
The south side (−z) is cut away from x = −30 so the three stories show.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from vb import Step, beast, export, out_path, place, reset, skin_object  # noqa: E402

# ---- N, from src/data/builds/noah.ts ----
L, W, H = 300.0, 50.0, 30.0
DECKS = (2.8, 11.0, 20.0)
CUT_X = -30.0
DOOR_X, DOOR_Y0, DOOR_Y1 = -90.0, 11.0, 20.0
HALF = W / 2
POST = HALF - 0.6  # frame post centre line
INNER = POST - 0.6  # inside face of the frames
ROOM0, ROOM = -140.0, 20.0
STRAKE = 4.5  # each of the six strakes, drawn as five planks

reset()


def planks_along_x(p, key, x0, x1, y0, y1, z, thick, n_rows, length=30.0, stagger=True, bevel=0.06):
    """a run of planks along x, `n_rows` high, butt joints staggered row to row"""
    h = (y1 - y0) / n_rows
    for r in range(n_rows):
        off = (r % 3) * length / 3 if stagger else 0
        x = x0
        first = True
        while x < x1 - 0.01:
            seg = (length - off) if first and off else length
            first = False
            b = min(x + seg, x1)
            p.box(key, (b - x - 0.05, h - 0.05, thick), ((x + b) / 2, y0 + h * (r + 0.5), z), bevel=bevel)
            x = b


# --------------------------------------------------------------------- keel
s = Step("keel")
for i in range(7):
    p = s.part("cradle", tally="cedar")
    p.box("cedar", (3, 0.8, 30), (-135 + 45 * i, 0.4, 0), bevel=0.1)
    p.done()
p = s.part("keel", anim="grow:x", hero=True, tally="wood")
for i in range(10):
    x0 = -L / 2 + 30 * i
    p.box("wood", (29.9, 1.2, 3), (x0 + 15, 1.4, 0), bevel=0.12)
    # a scarf joint pin at each seam
    p.cyl("pitch", 0.2, 0.2, 3.1, None, segs=8, matrix=place(x0, 1.4, 0, rot_x=math.pi / 2))
p.done()
for z in (-20, -10, 0, 10, 20):
    p = s.part("bottom", tally="wood")
    for k in range(10):
        zz = z - 4.95 + k * 0.99 + 0.495
        x = -L / 2 + (k % 3) * 10
        first = True
        while x < L / 2 - 0.01:
            seg = 30.0 if not first or k % 3 == 0 else 30.0 - (k % 3) * 10
            first = False
            b = min(x + seg, L / 2)
            p.box("wood", (b - x - 0.05, 0.8, 0.94), ((x + b) / 2, 2.4, zz))
            x = b
    p.done()

# ------------------------------------------------------------------- frames
s = Step("frames")
fh = 29 - DECKS[0]
for i in range(21):
    x = -L / 2 + 15 * i
    p = s.part("frame", anim="grow", tally="wood")
    for side in (-1, 1):
        p.box("wood", (1, fh, 1.2), (x, DECKS[0] + fh / 2, side * POST), bevel=0.08)
        # knees bracing the deck beams to the frames
        for y in (DECKS[1], DECKS[2]):
            p.box("wood", (0.8, 2.2, 0.8), (x, y - 1.2, side * (POST - 1.2)), rot_x=side * 0.78, bevel=0.06)
    p.box("wood", (1, 0.8, W - 1.2), (x, 28.6, 0), bevel=0.08)
    for y in (DECKS[1], DECKS[2]):
        p.box("wood", (0.9, 0.7, 2 * INNER), (x, y - 0.95, 0), bevel=0.06)
    p.done()

# ----------------------------------------------------------------- planking
s = Step("planking")
z = HALF + 0.3
for j in range(6):
    y0 = 2 + STRAKE * j
    p = s.part(f"strake{j}", tally="wood")
    planks_along_x(p, "wood", -L / 2, L / 2, y0, y0 + STRAKE, z, 0.6, 5)
    if j == 0:
        planks_along_x(p, "wood", -L / 2, L / 2, y0, y0 + STRAKE, -z, 0.6, 5)
    else:
        planks_along_x(p, "wood", -L / 2, CUT_X, y0, y0 + STRAKE, -z, 0.6, 5)
    p.done()
for side in (-1, 1):
    p = s.part("end", tally="wood")
    n = 26
    for k in range(n):
        zz = -HALF - 0.6 + (W + 1.2) * (k + 0.5) / n
        p.box("wood", (0.6, 27, (W + 1.2) / n - 0.05), (side * (L / 2 + 0.3), 15.5, zz), bevel=0.05)
    p.done()

# -------------------------------------------------------------------- pitch
s = Step("pitch")
zp = HALF + 0.68
for key_part, size, at in (
    ("north", (L + 0.6, 27, 0.15), (0, 15.5, zp)),
    ("south_low", (L + 0.6, 4.5, 0.15), (0, 4.25, -zp)),
    ("south", (CUT_X + L / 2 + 0.3, 22.5, 0.15), (-L / 2 - 0.3 + (CUT_X + L / 2 + 0.3) / 2, 17.75, -zp)),
    ("east", (0.15, 27, W + 1.5), (-(L / 2 + 0.68), 15.5, 0)),
    ("west", (0.15, 27, W + 1.5), (L / 2 + 0.68, 15.5, 0)),
    ("within", (L, 27, 0.1), (0, 15.5, HALF - 0.06)),
):
    p = s.part(key_part, anim="grow", tally="pitch")
    p.box("pitch", size, at)
    p.done()

# -------------------------------------------------------------------- decks
s = Step("decks")
for y in (DECKS[1], DECKS[2]):
    p = s.part("deck", anim="grow:x", tally="cedar")
    n = int(2 * INNER)
    for k in range(n):
        zz = -INNER + k + 0.5
        x = -L / 2 + 0.6
        off = (k % 4) * 9.0
        first = True
        while x < L / 2 - 0.61:
            seg = 36.0 - off if first and off else 36.0
            first = False
            b = min(x + seg, L / 2 - 0.6)
            p.box("cedar", (b - x - 0.06, 0.6, 0.95), ((x + b) / 2, y - 0.3, zz))
            x = b
    p.done()

# -------------------------------------------------------------------- rooms
s = Step("rooms")


def slat_wall_x(p, x0, x1, y, zc):
    """a partition along x: posts, three rails, upright slats"""
    for x in [x0 + 4 * i for i in range(int((x1 - x0) / 4) + 1)]:
        p.box("wood", (0.4, 5, 0.4), (x, y + 2.5, zc))
    for ry in (0.6, 2.6, 4.8):
        p.box("wood", (x1 - x0, 0.3, 0.25), ((x0 + x1) / 2, y + ry, zc))


def slat_wall_z(p, z0, z1, y, xc):
    for zz in (z0, (z0 + z1) / 2, z1):
        p.box("wood", (0.4, 5, 0.4), (xc, y + 2.5, zz))
    for ry in (0.6, 2.6, 4.8):
        p.box("wood", (0.25, 0.3, abs(z1 - z0)), (xc, y + ry, (z0 + z1) / 2))
    for k in range(int(abs(z1 - z0) / 0.9)):
        zz = min(z0, z1) + 0.45 + 0.9 * k
        p.box("wood", (0.12, 4.0, 0.3), (xc, y + 2.4, zz))


for d, y in enumerate(DECKS):
    p = s.part(f"corridor{d}", tally="wood")
    for side in (-1, 1):
        slat_wall_x(p, -140, 140, y, side * 8)
    p.done()
    for side in (-1, 1):
        p = s.part(f"stalls{d}", tally="wood")
        for i in range(15):
            slat_wall_z(p, side * 8, side * INNER, y, ROOM0 + ROOM * i)
        p.done()

# --------------------------------------------------------------------- roof
s = Step("roof", anchor=(60, 30, -HALF))
pz = HALF + 0.3
p = s.part("window_posts", tally="wood")
x = -L / 2
while x <= L / 2 + 0.01:
    p.box("wood", (0.6, 1, 0.6), (x, 29.5, pz), bevel=0.05)
    if x <= CUT_X:
        p.box("wood", (0.6, 1, 0.6), (x, 29.5, -pz), bevel=0.05)
    x += 10
p.done()
slope = math.atan2(2, HALF + 1)
run = math.hypot(2, HALF + 1)
for side, x1, hero in ((1, L / 2 + 1, True), (-1, CUT_X, False)):
    p = s.part("roof_north" if side > 0 else "roof_south", hero=hero, tally="cedar")
    x0 = -L / 2 - 1
    # rafters, then boards laid along them
    x = x0
    while x <= x1 + 0.01:
        p.box("cedar", (0.5, 0.5, run), (x, 30.6, side * (HALF + 1) / 2), rot_x=side * slope, bevel=0.04)
        x += 5
    n = 26
    for k in range(n):
        u = (k + 0.5) / n
        zz = side * (HALF + 1) * u
        yy = 32.0 - 2 * u + 0.35
        planks = int((x1 - x0) / 30) + 1
        for q in range(planks):
            a = x0 + q * 30 + (k % 2) * 15
            b = min(a + 30, x1)
            a = max(a, x0)
            if b - a > 0.5:
                p.box("cedar", (b - a - 0.05, 0.25, run / n - 0.04), ((a + b) / 2, yy, zz), rot_x=side * slope)
    p.done()
p = s.part("ridge", tally="cedar")
p.box("cedar", (L + 2, 0.6, 0.8), (0, 32.4, 0), bevel=0.08)
p.done()

# --------------------------------------------------------------------- door
s = Step("door")
zd = -HALF - 0.85
dw = 8
dh = DOOR_Y1 - DOOR_Y0
p = s.part("door", hero=True, tally="pitch")
for k in range(8):
    p.box("pitch", (dw / 8 - 0.04, dh, 0.3), (DOOR_X - dw / 2 + dw / 8 * (k + 0.5), DOOR_Y0 + dh / 2, zd), bevel=0.03)
for yy in (DOOR_Y0 + 1.5, DOOR_Y0 + dh / 2, DOOR_Y1 - 1.5):
    p.box("wood", (dw - 0.4, 0.5, 0.2), (DOOR_X, yy, zd - 0.25), bevel=0.04)
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
# cleats across the ramp for hooves
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
    for zz in (12, 18):
        x = -10 + ROOM * i + (-3 if zz == 12 else 3)
        p.lathe("cedar", barrel, (x, DECKS[2], zz), segs=16)
        for hy in (0.35, 1.65):
            p.torus("pitch", 0.89, 0.05, (x, DECKS[2] + hy, zz), segs=(20, 4))
    for k in range(3):
        p.sphere("linen", 0.75, (-10 + ROOM * i - 1.2 + 1.2 * k, DECKS[1] + 0.5, 15 + (k % 2) * 0.6), segs=(10, 6), scale=(1.1, 0.7, 0.9))
    p.box("fir", (2.4, 1.2, 1.4), (-10 + ROOM * i + 2.5, DECKS[1] + 0.6, 12), bevel=0.15, segments=2)  # hay
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
for d, y in enumerate(DECKS):
    for i in range(8):
        kind, hide = PLAN[d][i % 4]
        p = s.part(f"{kind}s", anim="pop", hero=(d == 0 and i == 0), tally="none")
        x = -10 + ROOM * i
        for dz, face in ((-12.5, 1), (-19.5, -1)):
            yaw = 0.0 if face > 0 else math.pi
            sk = beast(x + face * 0.6, y, dz, yaw, **BEASTS[kind])
            p.merge_object(hide, skin_object(kind, *sk, subsurf=1))
            if kind == "lion":  # a mane
                p.sphere(hide, 0.55, (x + face * (0.6 + 1.0), y + 0.85 + 0.45 * 0.95 + 0.4, dz), segs=(10, 6), scale=(0.8, 1.1, 1.1))
        p.done()

export(out_path())
