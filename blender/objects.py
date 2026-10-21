"""
The standalone models on /artifacts — one GLB each, next to this script's
output path:

    npm run build:models -- objects                # all of them
    blender -b -P blender/objects.py -- out/x.glb ezekiel-altar   # just one

Each is a single `object_<id>` node (ids from `src/data/artifacts.ts`).
The ark, tabernacle, temple and Noah's ark come from their build models.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import furniture as fu  # noqa: E402
from vb import Part, V, ashlar, cloth, export, hanging, out_path, place, reset, rod, skin_object  # noqa: E402

import bpy  # noqa: E402

TAU = 2 * math.pi


def root(name):
    e = bpy.data.objects.new(f"object_{name}", None)
    bpy.context.scene.collection.objects.link(e)
    return e


def piece(parent, name, **kw):
    p = Part(name, **kw)
    p.parent = parent
    return p


def done(p):
    return p.finish(p.parent)


# ------------------------------------------------------------- furniture
def showbread(e):
    p = piece(e, "table")
    fu.table(p, (0, 0, 0))
    done(p)


def incense_altar(e):
    p = piece(e, "altar")
    fu.incense_altar(p, (0, 0, 0))
    done(p)


def bronze_altar(e):
    p = piece(e, "altar")
    fu.bronze_altar(p, (0, 0, 0))
    done(p)


def solomon_altar(e):
    p = piece(e, "altar")
    fu.great_altar_base(p, 0, 0)
    fu.great_altar_upper(p, 0, 0)
    for sx in (-1, 1):
        for sz in (-1, 1):
            fu.great_altar_horn(p, 0, 0, sx, sz)
    done(p)


def temple_cherubim(e):
    """the pair in the oracle: wing to wing across twenty cubits, wing to wall"""
    p = piece(e, "room")
    p.box("gold", (12, 0.3, 20.6), (0, 0.15, 0), bevel=0.04)
    # the south wall the outer wing touches; the north wall is drawn low to see in
    p.box("gold", (12, 12, 0.3), (0, 6.3, -10.15), bevel=0.04)
    p.box("gold", (12, 1.2, 0.3), (0, 0.9, 10.15), bevel=0.04)
    p.box("gold", (0.3, 12, 20.6), (6.15, 6.3, 0), bevel=0.04)
    done(p)
    for cz in (5.0, -5.0):
        p = piece(e, "cherub")
        fu.temple_cherub(p, 0.0, cz, 0.3)
        done(p)
    # turned so the desk view (from the north-west) sees the wings spread, faces on
    e.rotation_euler[2] = math.pi / 2


def bronze_sea(e):
    p = piece(e, "pavement")
    for i in range(-3, 4):
        for j in range(-3, 4):
            p.box("floor", (1.96, 0.1, 1.96), (i * 2, 0.05, j * 2))
    done(p)
    p = piece(e, "oxen")
    for x, z, yaw in fu.sea_ox_places(0, 0):
        p.merge_object("bronze", skin_object("ox", *fu.ox_skeleton(x, z, yaw), subsurf=2))
    done(p)
    p = piece(e, "basin")
    fu.sea_basin(p, 0, 0)
    done(p)


# ------------------------------------------------------------ David's tent
def davids_tent(e):
    """
    The tent David pitched for the ark on Zion (2 Samuel 6:17). Its size and
    form are not given: a ridge tent of goats' hair over linen walls, the
    long north side drawn open, the ark at true scale on a low dais.
    """
    Lx, Wz, ridge, eave = 10.0, 10.0, 8.0, 3.6
    p = piece(e, "ground")
    p.box("floor", (Lx + 6, 0.08, Wz + 8), (0, 0.04, 0))
    p.box("scarlet", (6, 0.04, 5), (0, 0.1, -0.5), bevel=0.01)
    p.box("linen", (7.2, 0.03, 6.2), (0, 0.09, -0.5))
    p.box("stone", (4, 0.3, 3), (0, 0.27, -1.0), bevel=0.05)
    done(p)
    p = piece(e, "poles")
    for x in (-Lx / 2, 0, Lx / 2):
        rod(p, "acacia", (x, 0, 0), (x, ridge + 0.3, 0), 0.12, segs=8)
        for z in (-Wz / 2, Wz / 2):
            rod(p, "acacia", (x, 0, z), (x, eave, z), 0.09, segs=8)
    rod(p, "acacia", (-Lx / 2 - 0.3, ridge, 0), (Lx / 2 + 0.3, ridge, 0), 0.1, segs=8)
    done(p)
    p = piece(e, "tent")
    for side in (-1, 1):
        rows = []
        for j in range(9):
            u = j / 8
            row = []
            for i in range(21):
                x = -Lx / 2 - 0.4 + (Lx + 0.8) * i / 20
                sag = 0.18 * math.sin(math.pi * u) * (0.6 + 0.4 * abs(math.sin(math.pi * 2 * i / 20)))
                row.append((x, ridge + 0.05 - (ridge - eave) * u - sag, side * (Wz / 2 + 0.3) * u))
            rows.append(row)
        cloth(p, "goatHair", rows, thick=0.06)
    # the south wall closed; the gable ends closed up to the ridge
    hanging(p, "linen", -Lx / 2, Lx / 2, 0.05, eave, folds=0.06, per=1.3, axis="x", c=-Wz / 2 - 0.05)
    for xe in (-Lx / 2 - 0.05, Lx / 2 + 0.05):
        hanging(p, "linen", -Wz / 2, Wz / 2, 0.05, eave, folds=0.06, per=1.3, axis="z", c=xe)
        rows = []
        for j in range(6):
            yy = eave + (ridge - eave) * j / 5
            half = (Wz / 2) * (1 - j / 5)
            rows.append([(xe, yy, -half + 2 * half * i / 10) for i in range(11)])
        cloth(p, "goatHair", rows, thick=0.05)
    # the north side drawn open: a valance, the curtains rolled and tied back
    hanging(p, "goatHair", -Lx / 2, Lx / 2, eave - 0.9, eave + 0.05, folds=0.05, per=1.0, axis="x", c=Wz / 2 + 0.05)
    for x in (-1, 1):
        at = (x * (Lx / 2 - 0.4), (eave - 0.2) / 2 + 0.05, Wz / 2 + 0.12)
        p.cyl("linen", 0.32, 0.4, eave - 0.2, at, segs=12)
        p.torus("scarlet", 0.38, 0.05, (at[0], eave * 0.55, at[2]), segs=(14, 4))
    done(p)
    p = piece(e, "ropes")
    for x in (-Lx / 2, 0, Lx / 2):
        for z in (-1, 1):
            peg = (x, 0.15, z * (Wz / 2 + 3))
            rod(p, "linen", (x, eave, z * Wz / 2), peg, 0.03, segs=4)
            p.cyl("acacia", 0.05, 0.08, 0.5, peg, segs=6)
    done(p)
    p = piece(e, "ark")
    fu.ark(p, (0.0, 0.42, -1.0))
    done(p)


# ------------------------------------------------- House of the Forest of Lebanon
def forest_house(e):
    """
    A hundred cubits long, fifty broad, thirty high; cedar pillars, fifteen in
    a row, with cedar beams upon them, covered above with cedar (the "four
    rows" of 7:2 against 7:3's forty-five is read here as three); windows in
    three rows, light against light (1 Kings 7:2–5). Shields of gold hung in
    it (1 Kings 10:16–17). The north wall and half the roof are cut away.
    """
    L, W, H = 100.0, 50.0, 30.0
    t = 2.0
    p = piece(e, "platform")
    for i in range(-10, 10):
        for j in range(-5, 5):
            p.box("floor", (4.9, 0.4, 4.9), (i * 5 + 2.5, 0.2, j * 5 + 2.5))
    p.box("stoneDark", (L + 6, 1.2, W + 6), (0, -0.4, 0), bevel=0.1)
    done(p)
    rows3 = [(y0, y0 + 3) for y0 in (7.0, 15.0, 23.0)]
    p = piece(e, "walls")
    win_n = [(x - 0.9, x + 0.9, a, b) for x in [-L / 2 + 5 + i * (L - 10) / 14 for i in range(15)] for a, b in rows3]
    ashlar(p, "stone", "x", -L / 2 - t, L / 2 + t, 0, H, -W / 2 - t / 2, t, course=2.0, block=4.0, openings=win_n, key_alt="stoneDark", bevel=0.08)
    win_e = [(z - 0.9, z + 0.9, a, b) for z in (-15, -5, 5, 15) for a, b in rows3]
    door = [(-4, 4, 0, 12)]
    for xc in (-L / 2 - t / 2, L / 2 + t / 2):
        ashlar(p, "stone", "z", -W / 2, W / 2, 0, H, xc, t, course=2.0, block=4.0, openings=win_e + door, key_alt="stoneDark", bevel=0.08)
    ashlar(p, "stone", "x", -L / 2 - t, L / 2 + t, 0, 4, W / 2 + t / 2, t, course=2.0, block=4.0, key_alt="stoneDark", bevel=0.08)
    done(p)
    p = piece(e, "pillars")
    zs = (-W / 4, 0.0, W / 4)
    xs = [-L / 2 + 6 + i * (L - 12) / 14 for i in range(15)]
    for z in zs:
        for x in xs:
            p.cyl("cedar", 0.95, 0.95, 0.6, (x, 0.3, z), segs=12, bevel=0.05)
            p.cyl("cedar", 0.72, 0.8, H - 2.2, (x, 0.6 + (H - 2.2) / 2, z), segs=12)
            p.cyl("cedar", 0.8, 1.15, 1.0, (x, H - 1.1, z), segs=12, bevel=0.05)
        # the beams upon the pillars, end to end
        p.box("cedar", (L, 1.2, 1.4), (0, H - 0.0, z), bevel=0.08)
    done(p)
    p = piece(e, "roof")
    x = -L / 2 - t
    while x < L / 2 + t - 0.01:
        p.box("cedar", (0.9, 0.9, W / 2 + t), (x + 0.6, H + 1.05, -(W / 2 + t) / 2), bevel=0.06)
        x += 2.5
    x = -L / 2 - t
    while x < L / 2 + t - 0.01:
        p.box("cedar", (0.98, 0.3, W / 2 + t), (x + 0.5, H + 1.65, -(W / 2 + t) / 2))
        x += 1.0
    done(p)
    p = piece(e, "shields")
    # two hundred targets and three hundred shields of beaten gold — a few of them
    for i, x in enumerate(xs):
        for yy, r in ((4.5, 1.1), (12.0, 0.8), (19.5, 0.8)):
            at = (x, yy, -W / 2 + 0.15)
            p.cyl("gold", r, r, 0.12, None, segs=20, matrix=place(*at, rot_x=math.pi / 2))
            p.sphere("goldDark", r * 0.28, (x, yy, -W / 2 + 0.25), segs=(10, 6), scale=(1, 1, 0.6))
    done(p)


# -------------------------------------------------------------- Ezekiel's altar
def ezekiel_altar(e):
    """
    Ezekiel 43:13–17, in cubits of a cubit and a handbreadth: a base a cubit
    high with a border of half a cubit, a lower ledge of two cubits, a greater
    ledge of four, the hearth of four with four horns, twelve cubits square;
    its steps look toward the east.
    """
    p = piece(e, "base")
    p.box("stoneDark", (18, 1, 18), (0, 0.5, 0), bevel=0.06)
    for side in (-1, 1):
        p.box("stone", (18, 0.5, 0.5), (0, 1.25, side * 8.75), bevel=0.05)
        p.box("stone", (0.5, 0.5, 17), (side * 8.75, 1.25, 0), bevel=0.05)
    done(p)
    p = piece(e, "ledges")
    ashlar(p, "stone", "x", -8, 8, 1, 3, 7.5, 1, course=1.0, block=2.0, key_alt="stoneDark", bevel=0.05)
    ashlar(p, "stone", "x", -8, 8, 1, 3, -7.5, 1, course=1.0, block=2.0, key_alt="stoneDark", bevel=0.05)
    ashlar(p, "stone", "z", -7, 7, 1, 3, 7.5, 1, course=1.0, block=2.0, key_alt="stoneDark", bevel=0.05)
    ashlar(p, "stone", "z", -7, 7, 1, 3, -7.5, 1, course=1.0, block=2.0, key_alt="stoneDark", bevel=0.05)
    p.box("stoneDark", (14, 2, 14), (0, 2, 0))
    ashlar(p, "stone", "x", -7, 7, 3, 7, 6.5, 1, course=1.0, block=2.0, key_alt="stoneDark", bevel=0.05)
    ashlar(p, "stone", "x", -7, 7, 3, 7, -6.5, 1, course=1.0, block=2.0, key_alt="stoneDark", bevel=0.05)
    ashlar(p, "stone", "z", -6, 6, 3, 7, 6.5, 1, course=1.0, block=2.0, key_alt="stoneDark", bevel=0.05)
    ashlar(p, "stone", "z", -6, 6, 3, 7, -6.5, 1, course=1.0, block=2.0, key_alt="stoneDark", bevel=0.05)
    p.box("stoneDark", (12, 4, 12), (0, 5, 0))
    done(p)
    p = piece(e, "hearth")
    ashlar(p, "stoneDark", "x", -6, 6, 7, 11, 5.5, 1, course=1.0, block=2.0, key_alt="stone", bevel=0.05)
    ashlar(p, "stoneDark", "x", -6, 6, 7, 11, -5.5, 1, course=1.0, block=2.0, key_alt="stone", bevel=0.05)
    ashlar(p, "stoneDark", "z", -5, 5, 7, 11, 5.5, 1, course=1.0, block=2.0, key_alt="stone", bevel=0.05)
    ashlar(p, "stoneDark", "z", -5, 5, 7, 11, -5.5, 1, course=1.0, block=2.0, key_alt="stone", bevel=0.05)
    p.box("pitch", (10, 0.2, 10), (0, 10.8, 0))
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.cyl("stone", 0.45, 0.2, 1.0, (sx * 5.5, 11.5, sz * 5.5), segs=10, bevel=0.03)
    done(p)
    p = piece(e, "steps")
    n = 14
    for i in range(n):
        h = 7.0 * (i + 1) / n
        p.box("stone", (0.75, h, 4), (-7.0 - 0.75 * (n - i) + 0.375, h / 2, 0), bevel=0.04)
    done(p)


# --------------------------------------------------------------- New Jerusalem
FOUNDATIONS = (
    "gem_jasper", "gem_sapphire", "gem_chalcedony", "gem_emerald", "gem_sardonyx", "gem_sardius",
    "gem_chrysolite", "gem_beryl", "gem_topaz", "gem_chrysoprasus", "gem_jacinth", "gem_amethyst",
)


def new_jerusalem(e):
    """
    A schematic cube, not to scale (Revelation 21–22): twelve foundations of
    precious stones, a wall of jasper with twelve gates of pearl, a city of
    gold like clear glass, the river of the water of life from the throne,
    and the tree of life on either side.
    """
    S = 12.0
    band = 0.1
    p = piece(e, "foundations")
    for k, key in enumerate(FOUNDATIONS):
        inset = k * 0.02
        y = band * k + band / 2
        for side in (-1, 1):
            p.box(key, (S + 0.8 - 2 * inset, band, 0.5), (0, y, side * (S / 2 + 0.15 - inset)), bevel=0.01)
            p.box(key, (0.5, band, S - 0.2), (side * (S / 2 + 0.15 - inset), y, 0), bevel=0.01)
    done(p)
    base = band * 12
    wall_h = 1.44
    gates = (-3.0, 0.0, 3.0)
    p = piece(e, "wall")
    for side in (-1, 1):
        for axis in ("x", "z"):
            c = side * (S / 2)
            openings = [(g - 0.45, g + 0.45, base, base + 1.0) for g in gates]
            ashlar(p, "jasper", axis, -S / 2 - 0.2, S / 2 + 0.2, base, base + wall_h, c, 0.35, course=0.24, block=0.7, openings=openings, bevel=0.015)
    done(p)
    p = piece(e, "gates")
    for side in (-1, 1):
        for g in gates:
            for axis in ("x", "z"):
                c = side * (S / 2)
                at = (g, base + 0.5, c) if axis == "x" else (c, base + 0.5, g)
                # every several gate was of one pearl (Revelation 21:21)
                rot = 0.0 if axis == "x" else math.pi / 2
                p.cyl("pearl", 0.42, 0.42, 0.12, None, segs=20, matrix=place(*at, rot_y=rot, rot_x=math.pi / 2))
                p.sphere("pearl", 0.14, (at[0], base + 1.12, at[2]), segs=(10, 6))
    done(p)
    p = piece(e, "city", uv="world")
    top = base + S
    p.box("goldGlass", (S - 0.4, S - wall_h, S - 0.4), (0, base + wall_h + (S - wall_h) / 2, 0))
    corners = [(sx * (S / 2 - 0.2), sz * (S / 2 - 0.2)) for sx in (-1, 1) for sz in (-1, 1)]
    for x, z in corners:
        rod(p, "gold", (x, base, z), (x, top, z), 0.06, segs=6)
    for y in (base + wall_h, top):
        for (x0, z0), (x1, z1) in (((-1, -1), (1, -1)), ((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1))):
            k = S / 2 - 0.2
            rod(p, "gold", (x0 * k, y, z0 * k), (x1 * k, y, z1 * k), 0.05, segs=6)
    done(p)
    p = piece(e, "street")
    p.box("goldGlass", (S - 0.6, 0.04, 1.6), (0, base + 0.02, 0))
    p.box("gold", (S - 0.6, 0.02, 1.7), (0, base + 0.005, 0))
    # the river, clear as crystal, out of the throne (Revelation 22:1)
    p.box("river", (S / 2 - 1.2, 0.03, 0.5), (-S / 4 - 0.6 + 0.6, base + 0.05, 0))
    done(p)
    p = piece(e, "throne")
    p.box("jasper", (1.6, 0.3, 1.6), (S / 4, base + 0.15, 0), bevel=0.03)
    p.box("jasper", (1.1, 0.3, 1.1), (S / 4, base + 0.45, 0), bevel=0.03)
    p.box("jasper", (0.6, 0.5, 0.7), (S / 4, base + 0.85, 0), bevel=0.03)
    p.box("jasper", (0.15, 0.9, 0.7), (S / 4 + 0.3, base + 1.3, 0), bevel=0.03)
    p.sphere("glory", 0.35, (S / 4, base + 1.4, 0), segs=(14, 9))
    # a rainbow round about the throne, like an emerald (Revelation 4:3)
    p.torus("gem_emerald", 1.1, 0.05, (S / 4, base + 0.9, 0), rot=(0, math.pi / 2, 0), segs=(40, 6))
    done(p)
    p = piece(e, "trees")
    # the tree of life on either side of the river, twelve manner of fruits
    for side in (-1, 1):
        for i in range(6):
            x = -S / 2 + 1.2 + i * 0.75
            z = side * 1.05
            rod(p, "acacia", (x, base, z), (x, base + 0.55, z), 0.05, segs=6)
            p.sphere("leaf", 0.32, (x, base + 0.75, z), segs=(10, 7), scale=(1, 0.8, 1))
            for k in range(4):
                a = TAU * (k + i) / 4
                p.sphere("fruit", 0.06, (x + math.cos(a) * 0.28, base + 0.68, z + math.sin(a) * 0.28), segs=(6, 4))
    done(p)


PIECES = {
    "showbread": showbread,
    "incense-altar": incense_altar,
    "bronze-altar": bronze_altar,
    "solomon-altar": solomon_altar,
    "temple-cherubim": temple_cherubim,
    "bronze-sea": bronze_sea,
    "davids-tent": davids_tent,
    "forest-house": forest_house,
    "ezekiel-altar": ezekiel_altar,
    "new-jerusalem": new_jerusalem,
}

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out_dir = os.path.dirname(out_path())
    only = argv[1:] or list(PIECES)
    for name in only:
        reset()
        e = root(name)
        PIECES[name](e)
        export(os.path.join(out_dir, f"{name}.raw.glb"))
