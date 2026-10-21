"""
The sanctuary furniture, shared by the ark, tabernacle and temple scripts.

Each function adds geometry to a Part at an offset `o` (app coordinates of
the piece's own origin: centred on x/z, standing on y = 0 unless noted).
Measurements are the text's, in cubits; what the text leaves open is noted.
"""

import math

from vb import arc_wing, feather, rod

TAU = 2 * math.pi

# ---------------------------------------------------------------------- ark
# Exodus 25:10–22; 37:1–9. x along the length, z across, y up.
ARK_L, ARK_W, ARK_H = 2.5, 1.5, 1.5
ARK_T = 0.08  # board thickness (interpretive)
RING_Z = ARK_W / 2 + 0.06


def _at(o, x, y, z):
    return (o[0] + x, o[1] + y, o[2] + z)


def ark_chest(p, o):
    """a plain open chest of acacia: floor, four walls, corner posts"""
    L, W, H, t = ARK_L, ARK_W, ARK_H, ARK_T
    p.box("acacia", (L, t, W), _at(o, 0, t / 2, 0), bevel=0.01)
    for s in (-1, 1):
        p.box("acacia", (L - 0.2, H - t, t), _at(o, 0, t + (H - t) / 2, s * (W / 2 - t / 2)), bevel=0.01)
        p.box("acacia", (t, H - t, W - 0.2), _at(o, s * (L / 2 - t / 2), t + (H - t) / 2, 0), bevel=0.01)
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.box("acacia", (0.14, H, 0.14), _at(o, sx * (L / 2 - 0.07), H / 2, sz * (W / 2 - 0.07)), bevel=0.015)


def ark_overlay(p, o):
    """pure gold within and without, with raised frames on each face"""
    L, W, H, t = ARK_L, ARK_W, ARK_H, ARK_T
    for s in (-1, 1):
        p.box("gold", (L + 0.04, H, 0.02), _at(o, 0, H / 2, s * (W / 2 + 0.01)), bevel=0.006)
        p.box("gold", (0.02, H, W + 0.04), _at(o, s * (L / 2 + 0.01), H / 2, 0), bevel=0.006)
        p.box("gold", (L - 2 * t, H - t, 0.02), _at(o, 0, t + (H - t) / 2, s * (W / 2 - t - 0.01)))
        p.box("gold", (0.02, H - t, W - 2 * t), _at(o, s * (L / 2 - t - 0.01), t + (H - t) / 2, 0))
    p.box("gold", (L - 2 * t, 0.02, W - 2 * t), _at(o, 0, t + 0.01, 0))
    # panel mouldings: two on each long side, one on each end
    for s in (-1, 1):
        for cx in (-L / 4, L / 4):
            for (w, h, y) in ((L / 2 - 0.2, 0.04, 0.22), (L / 2 - 0.2, 0.04, H - 0.28)):
                p.box("goldDark", (w, h, 0.03), _at(o, cx, y, s * (W / 2 + 0.03)), bevel=0.008)
            for dx in (-1, 1):
                p.box("goldDark", (0.04, H - 0.46, 0.03), _at(o, cx + dx * (L / 4 - 0.1), H / 2 - 0.03, s * (W / 2 + 0.03)), bevel=0.008)
        for (h, y) in ((0.04, 0.22), (0.04, H - 0.28)):
            p.box("goldDark", (0.03, h, W - 0.2), _at(o, s * (L / 2 + 0.03), y, 0), bevel=0.008)


def ark_crown(p, o):
    """a crown (zer) of gold round about: a rounded moulding with a bead row"""
    L, W, H = ARK_L, ARK_W, ARK_H
    y = H + 0.03
    for s in (-1, 1):
        rod(p, "goldDark", _at(o, -L / 2 - 0.05, y, s * (W / 2 + 0.05)), _at(o, L / 2 + 0.05, y, s * (W / 2 + 0.05)), 0.05, segs=10)
        rod(p, "goldDark", _at(o, s * (L / 2 + 0.05), y, -W / 2 - 0.05), _at(o, s * (L / 2 + 0.05), y, W / 2 + 0.05), 0.05, segs=10)
        n = 24
        for i in range(n + 1):
            x = -L / 2 + L * i / n
            p.sphere("gold", 0.022, _at(o, x, y - 0.07, s * (W / 2 + 0.045)), segs=(6, 4))
        for i in range(15):
            z = -W / 2 + W * i / 14
            p.sphere("gold", 0.022, _at(o, s * (L / 2 + 0.045), y - 0.07, z), segs=(6, 4))


def ark_ring(p, o, sx, sz):
    """one of the four rings, in the four feet (Exodus 25:12)"""
    x = sx * (ARK_L / 2 - 0.25)
    p.torus("goldDark", 0.1, 0.03, _at(o, x, 0.35, sz * RING_Z), rot=(0, math.pi / 2, 0), segs=(16, 6))
    p.box("goldDark", (0.12, 0.08, 0.04), _at(o, x, 0.24, sz * (ARK_W / 2 + 0.025)), bevel=0.01)


def ark_stave(p, o, sz, length=4.0):
    """staves of acacia overlaid with gold, never taken out (Exodus 25:13–15)"""
    rod(p, "gold", _at(o, -length / 2, 0.35, sz * RING_Z), _at(o, length / 2, 0.35, sz * RING_Z), 0.05, segs=12)
    for sx in (-1, 1):
        p.sphere("goldDark", 0.065, _at(o, sx * length / 2, 0.35, sz * RING_Z), segs=(10, 6))


def tablet(p, o, x, lean=0.0):
    """a tablet of stone with a rounded head"""
    p.box("stone", (0.1, 0.58, 0.48), _at(o, x, ARK_T + 0.29, 0), rot_y=lean, bevel=0.02)
    from mathutils import Matrix

    from vb import V

    m = Matrix.Translation(V(*_at(o, x, ARK_T + 0.58, 0))) @ Matrix.Rotation(lean, 4, "Z") @ Matrix.Rotation(math.pi / 2, 4, "Y")
    p.cyl("stone", 0.24, 0.24, 0.1, None, segs=16, matrix=m)


def mercy_seat(p, o):
    """the kapporet: a slab of pure gold the size of the ark's top"""
    p.box("gold", (ARK_L, 0.1, ARK_W), _at(o, 0, ARK_H + 0.05, 0), bevel=0.02)


def ark_cherub(p, o, d):
    """
    Beaten out of the mercy seat's end, kneeling, facing the other; wings
    spread up and forward to cover the seat (Exodus 25:18–20).
    `d` = +1 for the cherub at the −x end (facing +x), −1 for the other.
    """
    cx = -d * (ARK_L / 2 - 0.32)
    b = ARK_H + 0.1
    body = [(0, 0), (0.24, 0), (0.25, 0.08), (0.2, 0.3), (0.16, 0.42), (0.17, 0.5), (0.1, 0.58), (0, 0.6)]
    p.lathe("gold", body, _at(o, cx, b, 0), segs=20)
    p.sphere("gold", 0.11, _at(o, cx + d * 0.05, b + 0.7, 0), segs=(14, 9), scale=(1.0, 1.1, 0.95))
    for s in (-1, 1):
        sh = _at(o, cx, b + 0.48, s * 0.15)
        hd = _at(o, cx + d * 0.24, b + 0.36, s * 0.06)
        rod(p, "gold", sh, hd, 0.035, segs=8)
        # each wing arches up and toward the middle, splayed outward a little
        pts = []
        n = 10
        for i in range(n + 1):
            u = i / n
            pts.append(_at(o, cx + d * (0.05 + 0.95 * u), b + 0.52 + 0.85 * math.sin(u * math.pi * 0.62) - 0.1 * u, s * (0.16 + 0.26 * u)))
        arc_wing(p, pts, "x", d, flight=(0.2, 0.2), covert=(0.1, 0.04), width=0.1, edge=0.03)


def ark(p, o):
    """the finished ark, as one piece (for the tabernacle and the temple)"""
    ark_chest(p, o)
    ark_overlay(p, o)
    ark_crown(p, o)
    for sx in (-1, 1):
        for sz in (-1, 1):
            ark_ring(p, o, sx, sz)
    for sz in (-1, 1):
        ark_stave(p, o, sz)
    for x, lean in ((-0.2, 0.04), (0.2, -0.04)):
        tablet(p, o, x, lean)
    mercy_seat(p, o)
    for d in (1, -1):
        ark_cherub(p, o, d)


# -------------------------------------------------------------------- table
def table(p, o):
    """
    The table of the Presence: two cubits long, one wide, a cubit and a half
    high, a border of a handbreadth, a crown, rings and staves (Exodus
    25:23–30), with twelve loaves in two rows of six (Leviticus 24:5–7).
    """
    L, W, H = 2.0, 1.0, 1.5
    p.box("gold", (L, 0.1, W), _at(o, 0, H - 0.05, 0), bevel=0.015)
    p.box("goldDark", (L - 0.08, 0.17, W - 0.08), _at(o, 0, H - 0.18, 0), bevel=0.01)  # the border
    for s in (-1, 1):
        rod(p, "goldDark", _at(o, -L / 2 - 0.03, H + 0.02, s * (W / 2 + 0.03)), _at(o, L / 2 + 0.03, H + 0.02, s * (W / 2 + 0.03)), 0.035, segs=8)
        rod(p, "goldDark", _at(o, s * (L / 2 + 0.03), H + 0.02, -W / 2 - 0.03), _at(o, s * (L / 2 + 0.03), H + 0.02, W / 2 + 0.03), 0.035, segs=8)
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * (L / 2 - 0.1), sz * (W / 2 - 0.1)
            p.lathe("gold", [(0, 0), (0.09, 0), (0.1, 0.06), (0.06, 0.12), (0.055, 0.6), (0.07, 0.7), (0.055, 0.8), (0.05, H - 0.25), (0, H - 0.25)], _at(o, x, 0, z), segs=12)
            p.torus("goldDark", 0.07, 0.022, _at(o, x, 0.45, z + sz * 0.1), rot=(0, math.pi / 2, 0), segs=(12, 5))
    for s in (-1, 1):
        rod(p, "gold", _at(o, -1.6, 0.45, s * (W / 2 + 0.1)), _at(o, 1.6, 0.45, s * (W / 2 + 0.1)), 0.04, segs=10)
    # two rows (stacks) of six loaves, with frankincense on each row
    for row in (-1, 1):
        for i in range(6):
            p.cyl("bread", 0.3, 0.29, 0.07, _at(o, row * 0.45, H + 0.05 + 0.075 * i, 0), segs=16, bevel=0.015)
        p.cyl("gold", 0.07, 0.09, 0.08, _at(o, row * 0.45, H + 0.53, 0), segs=10)


# ---------------------------------------------------------------- lampstand
def lampstand(p, o, h=3.0, flames=True):
    """
    Of beaten gold: a shaft and six branches, three and three, each branch
    with three cups like almond blossoms, a knop and a flower; four on the
    shaft; seven lamps (Exodus 25:31–37). No height is given — h is ours.
    """
    k = h / 3
    base = [(0, 0), (0.42 * k, 0), (0.4 * k, 0.06 * k), (0.26 * k, 0.16 * k), (0.12 * k, 0.28 * k), (0.09 * k, 0.32 * k), (0, 0.32 * k)]
    p.lathe("gold", base, o, segs=20)
    top = 2.95 * k
    rod(p, "gold", _at(o, 0, 0.3 * k, 0), _at(o, 0, top, 0), 0.07 * k, segs=10)

    def cup(at, scale=1.0):
        prof = [(0, 0), (0.03, 0), (0.07, 0.05), (0.09, 0.11), (0.07, 0.16), (0.08, 0.18), (0, 0.17)]
        p.lathe("gold", [(r * scale * k, y * scale * k) for r, y in prof], at, segs=10)

    def knop(at):
        p.sphere("gold", 0.1 * k, at, segs=(10, 6), scale=(1, 0.8, 1))

    # four cups on the shaft, knops under each pair of branches
    for y in (0.9, 1.45, 2.05, 2.62):
        cup(_at(o, 0, y * k, 0))
    radii = (0.38, 0.72, 1.05)
    joints = (2.1, 1.55, 1.0)
    for r, jy in zip(radii, joints):
        knop(_at(o, 0, jy * k, 0))
        for s in (-1, 1):
            # each branch rises in a curve from its knop to the lamp line
            pts = []
            n = 10
            for i in range(n + 1):
                u = i / n
                a = math.pi * u / 2
                pts.append(_at(o, s * r * k * math.sin(a), (jy + (top / k - jy) * (1 - math.cos(a))) * k, 0))
            for a_, b_ in zip(pts, pts[1:]):
                rod(p, "gold", a_, b_, 0.05 * k, segs=8)
            for frac in (0.45, 0.7, 0.9):
                cup(pts[int(frac * n)], 0.8)
    for x in (0, *radii, *(-r for r in radii)):
        lamp = _at(o, x * k, top, 0)
        p.lathe("goldDark", [(0, 0), (0.06 * k, 0), (0.13 * k, 0.06 * k), (0.12 * k, 0.12 * k), (0.03 * k, 0.1 * k), (0, 0.1 * k)], lamp, segs=12)
        if flames:
            p.lathe("flame", [(0, 0), (0.035 * k, 0.03 * k), (0.03 * k, 0.12 * k), (0, 0.24 * k)], _at(lamp, 0.06 * k, 0.1 * k, 0), segs=8)


# ------------------------------------------------------------ incense altar
def incense_altar(p, o):
    """a cubit square, two high, horns, a crown, rings and staves (Exodus 30:1–5)"""
    p.box("gold", (1, 1.8, 1), _at(o, 0, 0.9, 0), bevel=0.02)
    p.box("gold", (1.06, 0.2, 1.06), _at(o, 0, 1.9, 0), bevel=0.02)
    for s in (-1, 1):
        rod(p, "goldDark", _at(o, -0.56, 1.82, s * 0.56), _at(o, 0.56, 1.82, s * 0.56), 0.035, segs=8)
        rod(p, "goldDark", _at(o, s * 0.56, 1.82, -0.56), _at(o, s * 0.56, 1.82, 0.56), 0.035, segs=8)
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.cyl("goldDark", 0.08, 0.04, 0.2, _at(o, sx * 0.42, 2.1, sz * 0.42), segs=10)
            p.sphere("goldDark", 0.04, _at(o, sx * 0.42, 2.21, sz * 0.42), segs=(8, 5))
    for s in (-1, 1):
        p.torus("goldDark", 0.06, 0.02, _at(o, 0, 1.55, s * 0.52), rot=(0, math.pi / 2, 0), segs=(12, 5))
        rod(p, "gold", _at(o, -1.2, 1.55, s * 0.58), _at(o, 1.2, 1.55, s * 0.58), 0.035, segs=8)
    p.cyl("goldDark", 0.18, 0.14, 0.06, _at(o, 0, 2.03, 0), segs=14)  # the censer bowl on top


# ------------------------------------------------------------- bronze altar
def bronze_altar(p, o):
    """
    Hollow with boards, five cubits square, three high, horns of one piece
    with it, a grate of network of brass reaching halfway up, with four rings
    for the staves (Exodus 27:1–8).
    """
    for s in (-1, 1):
        p.box("bronze", (5, 3, 0.2), _at(o, 0, 1.5, s * 2.4), bevel=0.03)
        p.box("bronze", (0.2, 3, 4.6), _at(o, s * 2.4, 1.5, 0), bevel=0.03)
    # the ledge (karkov) and the network beneath it
    p.box("bronze", (5.5, 0.18, 5.5), _at(o, 0, 1.5, 0), bevel=0.03)
    for i in range(-6, 7):
        p.box("goldDark", (5.0, 0.06, 0.06), _at(o, 0, 0.75 + 0.0 * i, i * 0.38), bevel=0.0)
        p.box("goldDark", (0.06, 0.06, 5.0), _at(o, i * 0.38, 0.76, 0), bevel=0.0)
    for j in range(1, 4):
        for s in (-1, 1):
            p.box("goldDark", (5.04, 0.05, 0.05), _at(o, 0, 0.75 * j / 2 + 0.2, s * 2.52))
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.cyl("bronze", 0.32, 0.12, 0.6, _at(o, sx * 2.25, 3.3, sz * 2.25), segs=12)
    for s in (-1, 1):
        p.torus("bronze", 0.14, 0.04, _at(o, 0, 1.5, s * 2.62), segs=(14, 5))
        rod(p, "bronze", _at(o, -3.6, 1.5, s * 2.75), _at(o, 3.6, 1.5, s * 2.75), 0.08, segs=10)
    p.box("bronze", (4.6, 0.12, 4.6), _at(o, 0, 1.62, 0))  # hearth over the grate


# -------------------------------------------------------------------- laver
def laver(p, o):
    """a laver of brass and its foot of brass (Exodus 30:18)"""
    foot = [(0, 0), (0.8, 0), (0.75, 0.1), (0.4, 0.35), (0.3, 1.0), (0.38, 1.25), (0, 1.25)]
    p.lathe("bronze", foot, o, segs=28)
    bowl = [(0, 0), (0.8, 0.05), (1.15, 0.35), (1.3, 0.8), (1.36, 0.86), (1.24, 0.86), (1.05, 0.42), (0.7, 0.16), (0, 0.13)]
    p.lathe("bronze", bowl, _at(o, 0, 1.25, 0), segs=32)
    p.cyl("water", 1.12, 1.12, 0.04, _at(o, 0, 1.92, 0), segs=32)


# ----------------------------------------------------------- temple pieces
def temple_wing(p, cx, root_z, tip_z, b):
    """
    A wing of five cubits: a rounded leading edge arching from the shoulder,
    coverts over long flight feathers that lengthen toward the tip.
    """
    n = 18
    pts = []
    for i in range(n + 1):
        u = i / n
        z = root_z + (tip_z - root_z) * u
        y = b + 7.6 + 1.9 * math.sin(u * math.pi * 0.62) - 0.2 * u
        pts.append((cx + 0.05, y, z))
    for a, c in zip(pts, pts[1:]):
        rod(p, "gold", a, c, 0.16 - 0.06 * (pts.index(a) / n), segs=8)
    side = 1 if tip_z > root_z else -1
    for i in range(1, n + 1):
        u = i / n
        x, y, z = pts[i]
        # flight feathers, longest toward the tip
        feather(p, "gold", (x + 0.12, y, z), 1.6 + 1.6 * u * u, 0.42, side * 0.25 * u)
        # coverts, short, in front
        feather(p, "goldDark", (x - 0.1, y + 0.05, z - side * 0.12), 0.75 + 0.3 * u, 0.36, side * 0.08)


def temple_cherub(p, cx, cz, b):
    """
    Olive wood overlaid with gold, ten cubits high, each wing five cubits
    (1 Kings 6:23–28). Faces −x, toward the house (2 Chronicles 3:13);
    `b` is the floor it stands on.
    """
    robe = [(0, 0), (1.15, 0), (1.12, 0.25), (0.98, 2.2), (0.8, 4.2), (0.86, 5.4), (0.98, 6.4), (0.9, 7.1), (0.55, 7.55), (0.34, 7.8), (0.3, 8.0), (0, 8.0)]
    p.lathe("gold", robe, (cx, b, cz), segs=28)
    p.torus("goldDark", 0.86, 0.07, (cx, b + 4.35, cz), segs=(28, 5))  # girdle
    p.torus("goldDark", 1.1, 0.06, (cx, b + 0.3, cz), segs=(28, 5))  # hem
    p.sphere("gold", 0.62, (cx - 0.05, b + 8.55, cz), segs=(16, 10), scale=(0.95, 1.12, 0.9))
    # arms from the shoulders, hands joined before the breast
    for side in (-1, 1):
        sh = (cx, b + 7.15, cz + side * 0.82)
        el = (cx - 0.55, b + 5.9, cz + side * 0.75)
        hd = (cx - 1.0, b + 6.4, cz + side * 0.12)
        rod(p, "gold", sh, el, 0.2, segs=10)
        rod(p, "gold", el, hd, 0.17, segs=10)
        p.sphere("gold", 0.2, el, segs=(8, 5))
        p.sphere("gold", 0.2, hd, segs=(8, 5))
        p.box("gold", (0.75, 0.3, 0.4), (cx - 0.65, b + 0.15, cz + side * 0.4), bevel=0.08)  # feet
    for side in (-1, 1):
        temple_wing(p, cx + 0.35, cz + side * 0.7, cz + side * 5.0, b)


def ox_skeleton(x, z, yaw, y0=0.1):
    """a standing ox facing local +x, placed and turned"""
    c, s_ = math.cos(yaw), math.sin(yaw)

    def P(lx, ly, lz):
        return (x + lx * c + lz * s_, y0 + ly, z - lx * s_ + lz * c)

    pts = [
        P(-0.85, 1.5, 0),  # 0 hips (root)
        P(0.0, 1.5, 0),  # 1 back
        P(0.75, 1.62, 0),  # 2 withers (the hump)
        P(1.2, 1.45, 0),  # 3 neck
        P(1.5, 1.35, 0),  # 4 poll
        P(1.95, 1.0, 0),  # 5 muzzle
        P(-0.9, 0.62, -0.25),  # 6 hock
        P(-0.95, 0.02, -0.25),  # 7 hoof
        P(-0.9, 0.62, 0.25),  # 8
        P(-0.95, 0.02, 0.25),  # 9
        P(0.8, 0.6, -0.25),  # 10 knee
        P(0.8, 0.02, -0.25),  # 11 hoof
        P(0.8, 0.6, 0.25),  # 12
        P(0.8, 0.02, 0.25),  # 13
        P(1.5, 1.6, -0.38),  # 14 horn, sweeping out
        P(1.68, 1.82, -0.52),  # 15 horn tip, forward and up
        P(1.5, 1.6, 0.38),  # 16
        P(1.68, 1.82, 0.52),  # 17
        P(-1.2, 1.35, 0),  # 18 tail root
        P(-1.3, 0.7, 0),  # 19 tail tuft
        P(1.0, 1.05, 0),  # 20 dewlap
    ]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5), (0, 6), (6, 7), (0, 8), (8, 9), (2, 10), (10, 11), (2, 12), (12, 13), (4, 14), (14, 15), (4, 16), (16, 17), (0, 18), (18, 19), (3, 20)]
    radii = [
        (0.36, 0.46),
        (0.38, 0.5),
        (0.4, 0.55),
        (0.24, 0.3),
        (0.2, 0.22),
        (0.14, 0.15),
        (0.12, 0.12),
        (0.08, 0.08),
        (0.12, 0.12),
        (0.08, 0.08),
        (0.11, 0.11),
        (0.08, 0.08),
        (0.11, 0.11),
        (0.08, 0.08),
        (0.06, 0.06),
        (0.03, 0.03),
        (0.06, 0.06),
        (0.03, 0.03),
        (0.04, 0.04),
        (0.06, 0.06),
        (0.08, 0.2),
    ]
    return pts, edges, radii


def sea_ox_places(sx, sz):
    """twelve oxen, three looking toward each quarter (1 Kings 7:25): (x, z, yaw)"""
    for dx, dz in ((0, 1), (1, 0), (0, -1), (-1, 0)):
        for off in (-2.6, 0.0, 2.6):
            yield sx + dx * 3 + dz * off, sz + dz * 3 + dx * off, math.atan2(-dz, dx)


def sea_basin(p, sx, sz, y0=2.2):
    """
    A molten sea ten cubits brim to brim, five high, thirty round, a handbreadth
    thick, its brim like a cup with flowers of lilies, gourds beneath it
    (1 Kings 7:23–26).
    """
    th = 0.17  # a handbreadth
    profile = [(0, 0), (3.3, 0), (4.2, 0.55), (4.75, 1.7), (4.95, 3.3), (5.0, 4.4), (5.35, 4.85), (5.75, 5.0), (5.7, 5.06), (5.25, 4.95), (5.0 - th, 4.45), (4.95 - th, 3.3), (4.75 - th, 1.7), (4.2 - th, 0.62), (3.3, 0.45), (0, 0.45)]
    p.lathe("bronze", profile, (sx, y0, sz), segs=72)
    # two rows of gourds under the brim
    for row, (yy, rr) in enumerate(((y0 + 3.55, 5.12), (y0 + 3.15, 5.08))):
        n = 150
        for i in range(n):
            a = TAU * (i + 0.5 * row) / n
            p.sphere("bronze", 0.1, (sx + math.cos(a) * rr, yy, sz + math.sin(a) * rr), segs=(6, 4), scale=(1.0, 1.3, 1.0))
    # lily petals around the lip
    for i in range(36):
        a = TAU * i / 36
        p.sphere("bronze", 0.4, (sx + math.cos(a) * 5.5, y0 + 4.85, sz + math.sin(a) * 5.5), segs=(6, 4), scale=(0.5, 0.35, 0.5))
    p.cyl("water", 4.75, 4.75, 0.08, (sx, y0 + 4.3, sz), segs=64)


def great_altar_base(p, x, z):
    """
    An altar of brass, twenty cubits square and ten high (2 Chronicles 4:1),
    drawn with ledges after Ezekiel 43:13–17 (interpretive).
    """
    p.box("bronze", (20.6, 1.0, 20.6), (x, 0.6, z), bevel=0.1)
    p.box("bronze", (19.2, 4.0, 19.2), (x, 3.1, z), bevel=0.08)
    p.box("bronze", (19.8, 0.4, 19.8), (x, 5.3, z), bevel=0.06)


def great_altar_upper(p, x, z):
    p.box("bronze", (17.6, 4.0, 17.6), (x, 7.5, z), bevel=0.08)
    p.box("bronze", (18.4, 0.5, 18.4), (x, 9.75, z), bevel=0.06)
    # a grate of network for the fire (Exodus 27:4, after the tabernacle altar)
    for i in range(-7, 8):
        p.box("bronze", (15, 0.12, 0.18), (x, 10.06, z + i))
        p.box("bronze", (0.18, 0.12, 15), (x + i, 10.06, z))


def great_altar_horn(p, x, z, sx, sz):
    hx, hz = x + sx * 8.7, z + sz * 8.7
    p.cyl("bronze", 0.75, 0.25, 1.8, (hx, 10.9, hz), segs=16)
    p.sphere("bronze", 0.28, (hx, 11.85, hz), segs=(8, 5))
