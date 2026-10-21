"""
The wilderness Tabernacle, Exodus 26–27, raised in the order of Exodus 40.

    npm run build:models -- tabernacle

Dimensions mirror `TB` in `src/data/builds/tabernacle.ts`; step ids match
TABERNACLE_STEPS. The cloud (the last step) is light and stays in the app,
as do the lamps' glow, the incense smoke and the altar fire.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import furniture as fu  # noqa: E402
from vb import Step, cloth, export, hanging, out_path, reset, rod  # noqa: E402

# ---- TB, from src/data/builds/tabernacle.ts ----
CX0, CX1, CZ, GATE = -50.0, 50.0, 25.0, 10.0
TX0, TX1, TZ = 10.0, 40.0, 5.0
VEIL_X = 30.0
BT = 0.75  # board thickness (interpretive)
SOCK = 0.75
BOARD_H = 10.0
ALTAR_X, LAVER_X = -15.0, -2.0
TOP = SOCK + BOARD_H
STUB = 2.5  # south boards drawn short: the section cut
VEIL_Z = (-3.75, -1.25, 1.25, 3.75)
DOOR_Z = (-4.0, -2.0, 0.0, 2.0, 4.0)
WEST_N = 8
WEST_W = 2 * (TZ + BT) / WEST_N
BAR_YS = (1.75, 5.75, 9.75)

reset()


def boards():
    out = []
    for i in range(20):
        x = TX0 + 1.5 * i + 0.75
        out.append(dict(x=x, z=TZ + BT / 2, along="x", w=1.5, h=BOARD_H, out=1))
        out.append(dict(x=x, z=-TZ - BT / 2, along="x", w=1.5, h=STUB, out=-1))
    for i in range(WEST_N):
        out.append(dict(x=TX1 + BT / 2, z=-TZ - BT + WEST_W * (i + 0.5), along="z", w=WEST_W, h=BOARD_H, out=1))
    return out


def court_pillars():
    out = []
    for i in range(60):
        d = i * 5
        if d < 100:
            out.append((CX0 + d, -CZ))
        elif d < 150:
            out.append((CX1, -CZ + (d - 100)))
        elif d < 250:
            out.append((CX1 - (d - 150), CZ))
        else:
            out.append((CX0, CZ - (d - 250)))
    return out


def socket(p, x, z):
    """a talent of silver, with a mortise for the board's tenon"""
    p.box("silver", (0.7, SOCK, 0.7), (x, SOCK / 2, z), bevel=0.06)
    p.box("silver", (0.5, 0.06, 0.5), (x, SOCK + 0.03, z), bevel=0.02)


# ------------------------------------------------------------------- steps
s = Step("sockets", anchor=(TX1, 1, -TZ))
for b in boards():
    for side in (-1, 1):
        d = side * b["w"] / 4
        p = s.part("socket", anim="drop:3", tally="silver")
        if b["along"] == "x":
            socket(p, b["x"] + d, b["z"])
        else:
            socket(p, b["x"], b["z"] + d)
        p.done()
for z in VEIL_Z:
    p = s.part("socket", anim="drop:3", tally="silver")
    socket(p, VEIL_X, z)
    p.done()

s = Step("boards")
for b in boards():
    hero = b["z"] > 0 and b["along"] == "x" and 24 < b["x"] < 26
    p = s.part("board", hero=hero, tally="acacia")
    x, z, w, h = b["x"], b["z"], b["w"] - 0.04, b["h"]
    if b["along"] == "x":
        p.box("gold", (w, h, BT), (x, SOCK + h / 2, z), bevel=0.04)
        # a gold ring for each bar, on the outside face (Exodus 26:29)
        for y in BAR_YS:
            if y < SOCK + h:
                p.torus("goldDark", 0.16, 0.04, (x, y, z + b["out"] * (BT / 2 + 0.02)), rot=(0, math.pi / 2, 0), segs=(12, 5))
    else:
        p.box("gold", (BT, h, w), (x, SOCK + h / 2, z), bevel=0.04)
        for y in BAR_YS:
            p.torus("goldDark", 0.16, 0.04, (x + BT / 2 + 0.02, y, z), rot=(math.pi / 2, 0, 0), segs=(12, 5))
    p.done()

s = Step("bars")
zN = TZ + BT + 0.15
xm = (TX0 + TX1 + BT) / 2
x_end = TX1 + BT


def x_bar(a, b, y, z):
    p = s.part("bar", anim="slide:-14,0,0", tally="gold")
    rod(p, "gold", (a, y, z), (b, y, z), 0.12, segs=12)
    p.done()


def z_bar(a, b, y):
    p = s.part("bar", anim="slide:0,0,8", tally="gold")
    rod(p, "gold", (TX1 + BT + 0.15, y, a), (TX1 + BT + 0.15, y, b), 0.12, segs=12)
    p.done()


# the middle bar shoots through from end to end (Exodus 26:28)
x_bar(TX0, x_end, 5.75, zN)
for y in (9.75, 1.75):
    x_bar(TX0, xm, y, zN)
    x_bar(xm, x_end, y, zN)
x_bar(TX0, xm, 1.75, -zN)
x_bar(xm, x_end, 1.75, -zN)
ze = TZ + BT
z_bar(-ze, ze, 5.75)
for y in (9.75, 1.75):
    z_bar(-ze, 0, y)
    z_bar(0, ze, y)

s = Step("pillars")
for z in VEIL_Z:
    p = s.part("veil_pillar", tally="acacia")
    p.cyl("gold", 0.25, 0.25, BOARD_H, (VEIL_X, SOCK + BOARD_H / 2, z), segs=16)
    p.cyl("goldDark", 0.32, 0.26, 0.35, (VEIL_X, TOP - 0.1, z), segs=16, bevel=0.03)
    p.torus("goldDark", 0.1, 0.03, (VEIL_X - 0.3, TOP - 0.45, z), rot=(0, math.pi / 2, 0), segs=(10, 4))  # hook
    p.done()
for z in DOOR_Z:
    p = s.part("door_pillar", tally="acacia")
    p.box("bronze", (0.7, SOCK, 0.7), (TX0, SOCK / 2, z), bevel=0.06)
    p.cyl("gold", 0.25, 0.25, BOARD_H, (TX0, SOCK + BOARD_H / 2, z), segs=16)
    # chapiters and fillets overlaid with gold (Exodus 36:38)
    p.cyl("goldDark", 0.36, 0.26, 0.45, (TX0, TOP - 0.05, z), segs=16, bevel=0.03)
    p.torus("goldDark", 0.27, 0.05, (TX0, TOP - 0.6, z), segs=(16, 5))
    p.done()


def layer(step, key, o, bottom, uv="world", flap=0.0):
    """
    One covering: the north half of the roof, the north side, the west end —
    the south is cut away to see in. Draped as cloth with soft folds.
    """
    x1 = TX1 + BT + o
    x0 = TX0 - 0.1 - flap * 0.0
    z_edge = TZ + BT + o
    y = TOP + o
    # roof: a slight sag between the board tops
    p = step.part("roof", anim="drop:6", hero=True, uv=uv, tally=key)
    rows = []
    nx, nz = 60, 8
    for j in range(nz + 1):
        zz = z_edge * j / nz
        row = []
        for i in range(nx + 1):
            xx = x0 + (x1 - x0) * i / nx
            row.append((xx, y - 0.08 * math.sin(math.pi * j / nz) ** 2, zz))
        rows.append(row)
    cloth(p, key, rows)
    if flap:
        # the sixth goats'-hair curtain doubled over the front (Exodus 26:9)
        hanging(p, key, 0.0, z_edge, y - flap, y, folds=0.06, per=1.1, axis="z", c=x0 - 0.06)
    p.done()
    p = step.part("north", anim="drop:6", uv=uv, tally=key)
    hanging(p, key, x0, x1, bottom, y, folds=0.07, per=1.5, axis="x", c=z_edge)
    p.done()
    p = step.part("west", anim="drop:6", uv=uv, tally=key)
    hanging(p, key, -z_edge, z_edge, bottom, y, folds=0.07, per=1.5, axis="z", c=x1)
    p.done()


s = Step("linen")
layer(s, "veil", 0.15, TOP - 9, uv="fit")
# fifty taches of gold join the curtains above the veil (Exodus 26:6, 33)
z_edge = TZ + BT + 0.15
for i in range(25):
    p = s.part("tache", anim="pop", tally="gold")
    if i < 7:
        at = (VEIL_X, TOP + 0.25, z_edge * (i + 0.5) / 7)
    else:
        at = (VEIL_X, TOP + 0.15 - (i - 7) / 18 * 8.6, z_edge + 0.08)
    p.torus("gold", 0.09, 0.03, at, rot=(math.pi / 2, 0, 0), segs=(10, 4))
    p.sphere("gold", 0.06, at, segs=(8, 5))
    p.done()

s = Step("goathair")
layer(s, "goatHair", 0.35, 0.4, flap=2.0)

s = Step("coverings")
layer(s, "ramSkin", 0.55, 0.3)
layer(s, "tachash", 0.75, 0.2)

s = Step("ark")
p = s.part("ark", anim="slide:-18,0,0", hero=True, tally="gold")
fu.ark(p, (35.0, 0.0, 0.0))
p.done()
# the veil of blue, purple and scarlet, cherubim wrought on it, on four pillars
p = s.part("veil", anim="grow", uv="fit", tally="linen")
hanging(p, "veil", -TZ, TZ, SOCK, TOP - 0.4, folds=0.1, per=1.25, axis="z", c=VEIL_X + 0.05)
p.done()

s = Step("table")
p = s.part("table", anim="pop", tally="gold")
fu.table(p, (20.0, 0.0, 2.5))
p.done()

s = Step("lampstand")
p = s.part("lampstand", anim="pop", tally="gold")
fu.lampstand(p, (20.0, 0.0, -2.5))
p.done()

s = Step("incense")
p = s.part("incense", anim="pop", tally="gold")
fu.incense_altar(p, (28.0, 0.0, 0.0))
p.done()

s = Step("door")
p = s.part("screen", anim="grow", uv="fit", tally="linen")
hanging(p, "screen", -TZ, TZ, SOCK, TOP - 0.3, folds=0.12, per=1.4, axis="z", c=TX0 - 0.4)
rod(p, "goldDark", (TX0 - 0.4, TOP - 0.25, -TZ - 0.3), (TX0 - 0.4, TOP - 0.25, TZ + 0.3), 0.06, segs=8)
p.done()

s = Step("altar")
p = s.part("altar", tally="bronze")
fu.bronze_altar(p, (ALTAR_X, 0.0, 0.0))
p.done()

s = Step("laver")
p = s.part("laver", anim="drop:5", tally="bronze")
fu.laver(p, (LAVER_X, 0.0, 0.0))
p.done()

s = Step("court")
for x, z in court_pillars():
    # pillars of the court: sockets of brass, hooks and fillets of silver,
    # pins and cords to hold them (Exodus 27:10–19; 35:18)
    p = s.part("pillar", anim="drop:4", tally="bronze")
    p.box("bronze", (0.7, 0.6, 0.7), (x, 0.3, z), bevel=0.06)
    p.cyl("acacia", 0.18, 0.18, 4.6, (x, 2.9, z), segs=12)
    p.cyl("silver", 0.26, 0.2, 0.3, (x, 5.3, z), segs=12, bevel=0.02)
    out_x = 0 if CX0 < x < CX1 else (1 if x >= CX1 else -1)
    out_z = 0 if -CZ < z < CZ else (1 if z >= CZ else -1)
    if out_x or out_z:
        px, pz = x + out_x * 2.2, z + out_z * 2.2
        rod(p, "linen", (x, 5.1, z), (px, 0.15, pz), 0.025, segs=4)
        p.cyl("bronze", 0.05, 0.08, 0.5, (px, 0.1, pz), segs=6)
    p.done()
length = CX1 - CX0
e = CZ - GATE
runs = [
    ("x", CX0, CX1, -CZ, False),
    ("x", CX0, CX1, CZ, True),
    ("z", -CZ, CZ, CX1, False),
    ("z", GATE, CZ, CX0, False),
    ("z", -CZ, -GATE, CX0, False),
]
for axis, a, b, c, hero in runs:
    p = s.part("hanging", anim="grow", hero=hero, tally="linen")
    hanging(p, "linen", a, b, 0.3, 5.1, folds=0.09, per=1.6, axis=axis, c=c, step=0.6)
    if axis == "x":
        rod(p, "silver", (a, 5.15, c), (b, 5.15, c), 0.06, segs=6)
    else:
        rod(p, "silver", (c, 5.15, a), (c, 5.15, b), 0.06, segs=6)
    p.done()

s = Step("gate")
p = s.part("gate", anim="grow", uv="fit", tally="linen")
hanging(p, "screen", -GATE, GATE, 0.3, 5.1, folds=0.12, per=1.5, axis="z", c=CX0 - 0.25)
rod(p, "silver", (CX0 - 0.25, 5.15, -GATE), (CX0 - 0.25, 5.15, GATE), 0.06, segs=6)
p.done()

export(out_path())
