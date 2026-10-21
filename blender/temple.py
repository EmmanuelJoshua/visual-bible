"""
Solomon's Temple, 1 Kings 6–7 / 2 Chronicles 3–4, step by step.

    blender -b --factory-startup -P blender/temple.py -- public/models/temple.glb

Dimensions mirror `T` in `src/data/builds/temple.ts` (keep the two in step);
step ids match its TEMPLE_STEPS. Steps not modelled here — the lampstands and
table, the ark, the glory — stay procedural in the app, as do lights and fire.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

import furniture as fu  # noqa: E402
from vb import Step, V, ashlar, export, out_path, reset, rod, skin_object  # noqa: E402

# ---- T, from src/data/builds/temple.ts ----
F = 2.0  # top of the foundation platform
t = 1.5  # wall thickness (interpretive)
HX0, HX1, HZ, H = -30.0, 30.0, 10.0, 30.0  # house interior
PX0, PX1 = -41.5, -31.5  # porch
DEBIR_X = 10.0
PILLAR_X = -46.0
CX0, CX1, CZ, GATE = -100.0, 55.0, 45.0, 6.0  # inner court
ALTAR = (-75.0, 0.0)
SEA = (-62.0, -30.0)
LAVER_XS = (-24, -12, 0, 12, 24)
LAVER_Z = 27.0

TAU = 2 * math.pi

reset()


# ------------------------------------------------------------------ foundation
def foundation():
    s = Step("foundation", anchor=(-3, F, 0))
    # "great stones, costly stones… stones of ten cubits, and stones of eight" (1 Kings 7:10)
    x0, x1, z0, z1 = -49.0, 42.0, -22.0, 22.0
    rows = 8
    rz = (z1 - z0) / rows
    for course in range(2):
        key = "stoneDark" if course == 0 else "stone"
        for r in range(rows):
            p = s.part(f"course{course}_row{r}", anim="drop")
            x = x0
            lengths = (10.0, 8.0) if (r + course) % 2 else (8.0, 10.0)
            i = 0
            while x < x1 - 0.01:
                L = min(lengths[i % 2], x1 - x)
                p.box(key, (L - 0.08, 0.96, rz - 0.08), (x + L / 2, course + 0.5, z0 + rz * r + rz / 2), bevel=0.16, segments=2)
                x += L
                i += 1
            p.done()
    # steps up from the court on the east
    for i in range(4):
        h = F - 0.5 * i
        p = s.part(f"stair{i}")
        for j in range(4):
            p.box("stone", (1.46, h, 3.96), (x0 - 1.5 * i - 0.75, h / 2, -8 + 4 * j + 2), bevel=0.08)
        p.done()


# ------------------------------------------------------------------- walls
def walls():
    s = Step("walls")
    zc = HZ + t / 2
    # "windows of narrow lights" high in the walls (1 Kings 6:4)
    windows = [(x - 0.6, x + 0.6, F + 21, F + 25.5) for x in (-26, -18.5, -11, -3.5, 4, 11.5, 19, 26.5)]
    p = s.part("north", anim="grow", hero=True)
    ashlar(p, "stone", "x", HX0 - t, HX1 + t, F, F + H, zc, t, openings=windows, key_alt="stoneDark")
    p.done()
    p = s.part("west", anim="grow")
    ashlar(p, "stone", "z", -HZ, HZ, F, F + H, HX1 + t / 2, t, key_alt="stoneDark")
    p.done()
    # the south wall is cut low so the interior reads as a section
    p = s.part("south", anim="grow")
    ashlar(p, "stone", "x", HX0 - t, HX1 + t, F, F + 3, -zc, t, key_alt="stoneDark")
    p.done()
    # the east wall: a 10-cubit doorway, lintel above
    for side in (-1, 1):
        p = s.part(f"east_{'n' if side > 0 else 's'}", anim="grow")
        lo, hi = sorted((side * 5.0, side * HZ))
        ashlar(p, "stone", "z", lo, hi, F, F + H, HX0 - t / 2, t, key_alt="stoneDark")
        p.done()
    p = s.part("lintel")
    ashlar(p, "stone", "z", -5, 5, F + 15, F + H, HX0 - t / 2, t, key_alt="stoneDark")
    p.box("stoneDark", (t + 0.3, 1.2, 11), (HX0 - t / 2, F + 15.6, 0), bevel=0.1)
    p.done()


# ------------------------------------------------------------------- porch
def porch():
    s = Step("porch")
    zc = HZ + t / 2
    p = s.part("north", anim="grow")
    ashlar(p, "stone", "x", PX0 - t, PX1, F, F + H, zc, t, key_alt="stoneDark")
    p.done()
    p = s.part("south", anim="grow")
    ashlar(p, "stone", "x", PX0 - t, PX1, F, F + 3, -zc, t, key_alt="stoneDark")
    p.done()
    for side in (-1, 1):
        p = s.part(f"pier_{'n' if side > 0 else 's'}", anim="grow")
        lo, hi = sorted((side * 6.0, side * (HZ + t)))
        ashlar(p, "stone", "z", lo, hi, F, F + H, PX0 - t / 2, t, key_alt="stoneDark")
        p.done()
    p = s.part("lintel", hero=True)
    ashlar(p, "stone", "z", -6, 6, F + 20, F + H, PX0 - t / 2, t, key_alt="stoneDark")
    p.box("stoneDark", (t + 0.4, 1.4, 13), (PX0 - t / 2, F + 20.7, 0), bevel=0.12)
    p.done()
    # cedar roof over the north half, left open to see in
    p = s.part("roof")
    n = 8
    span = PX1 - (PX0 - t)
    for i in range(n):
        x = PX0 - t + span * (i + 0.5) / n
        p.box("cedar", (span / n - 0.1, 0.5, HZ + t), (x, F + H + 0.25, (HZ + t) / 2), bevel=0.04)
    p.box("cedar", (span + 0.6, 0.35, HZ + t + 0.6), (PX0 - t + span / 2, F + H + 0.68, (HZ + t) / 2), bevel=0.05)
    p.done()


# ---------------------------------------------------------------- chambers
def chambers():
    """
    Three storeys, each five cubits high: the lowest five broad, the middle six,
    the third seven — the house wall steps in so no beam is fastened into it
    (1 Kings 6:5–6, 10). Drawn on the north and west; the south is cut away.
    """
    s = Step("chambers", anchor=(0, F + 15.5, HZ + t + 4))
    face_n = HZ + t  # outside face of the house's north wall
    face_w = HX1 + t
    outer_n = face_n + 7  # inside face of the chambers' outer wall
    outer_w = face_w + 7
    for storey in range(3):
        y0 = F + 5 * storey
        rebate = 2 - storey  # 2, 1, 0 cubits of wall before the rest
        p = s.part(f"storey{storey}")
        if rebate:
            p.box("stoneDark", (HX1 + t - (HX0 - t), 5, rebate), (0, y0 + 2.5, face_n + rebate / 2), bevel=0.06)
            p.box("stoneDark", (rebate, 5, 2 * face_n + rebate), (face_w + rebate / 2, y0 + 2.5, rebate / 2), bevel=0.06)
        windows = [(x - 0.5, x + 0.5, y0 + 2, y0 + 3.5) for x in range(-27, 30, 6)]
        ashlar(p, "stoneDark", "x", HX0 - t, outer_w + 1, y0, y0 + 5, outer_n + 0.5, 1.0, course=1.25, block=2.5, openings=windows, key_alt="stone")
        windows_w = [(z - 0.5, z + 0.5, y0 + 2, y0 + 3.5) for z in range(-8, 18, 6)]
        ashlar(p, "stoneDark", "z", -face_n, outer_n, y0, y0 + 5, outer_w + 0.5, 1.0, course=1.25, block=2.5, openings=windows_w, key_alt="stone")
        p.done()
        # cedar beams resting on the rebate, spanning to the outer wall
        p = s.part(f"floor{storey}", tally="cedar")
        inner_n = face_n + rebate
        inner_w = face_w + rebate
        x = HX0 - t
        while x < inner_w - 0.2:
            p.box("cedar", (0.9, 0.45, outer_n + 1 - inner_n), (x + 0.5, y0 + 5 - 0.22, (inner_n + outer_n + 1) / 2), bevel=0.05)
            x += 1.5
        z = -face_n
        while z < outer_n + 1 - 0.2:
            p.box("cedar", (outer_w + 1 - inner_w, 0.45, 0.9), ((inner_w + outer_w + 1) / 2, y0 + 5 - 0.22, z + 0.5), bevel=0.05)
            z += 1.5
        p.done()


# ------------------------------------------------------------------- cedar
def rosette(p, key, x, y, z, r=0.42, petals=8):
    """an "open flower" carved in the panelling (1 Kings 6:18)"""
    p.star(key, (x, y, z), r, r * 0.55, petals, 0.08)
    p.cyl(key, r * 0.25, r * 0.18, 0.16, None, segs=6, matrix=_facing_north(x, y, z))


def _facing_north(x, y, z):
    """a disc/cylinder lying in a north wall (axis along app z)"""
    from mathutils import Matrix

    return Matrix.Translation(V(x, y, z)) @ Matrix.Rotation(math.pi / 2, 4, "X")


def panelled_wall(p, x0, x1, y0, y1, z, inward):
    """cedar boards framed into panels, flowers in each, gourds along the rails"""
    zf = z + inward * 0.1  # frame face
    p.box("cedar", (x1 - x0, y1 - y0, 0.2), ((x0 + x1) / 2, (y0 + y1) / 2, z))
    cols = max(1, round((x1 - x0) / 4))
    rows = max(1, round((y1 - y0) / 3))
    cw, rh = (x1 - x0) / cols, (y1 - y0) / rows
    for c in range(cols + 1):
        p.box("cedar", (0.28, y1 - y0, 0.16), (x0 + c * cw, (y0 + y1) / 2, zf), bevel=0.04)
    for r in range(rows + 1):
        yy = y0 + r * rh
        p.box("cedar", (x1 - x0, 0.32, 0.16), ((x0 + x1) / 2, yy, zf), bevel=0.04)
        # "knops" — gourds — carved along every other rail
        if 0 < r < rows and r % 2 == 0:
            g = x0 + 0.45
            while g < x1 - 0.3:
                p.sphere("cedar", 0.13, (g, yy, zf + inward * 0.12), segs=(6, 4), scale=(1.8, 1.0, 0.8))
                g += 0.9
    for c in range(cols):
        for r in range(rows):
            rosette(p, "cedar", x0 + (c + 0.5) * cw, y0 + (r + 0.5) * rh, zf + inward * 0.1)


def cedar():
    s = Step("cedar")
    # "the floor of the house with planks of fir" (1 Kings 6:15)
    p = s.part("floor", anim="grow:x", tally="fir")
    z = -HZ
    while z < HZ - 0.01:
        p.box("fir", (60, 0.2, 0.95), (0, F + 0.1, z + 0.5), bevel=0.03)
        z += 1.0
    p.done()
    p = s.part("north_lining", anim="grow", hero=True)
    panelled_wall(p, HX0, HX1, F, F + H, HZ - 0.12, -1)
    p.done()
    for side in (-1, 1):
        p = s.part(f"east_lining_{'n' if side > 0 else 's'}", anim="grow")
        lo, hi = sorted((side * 5.0, side * HZ))
        p.box("cedar", (0.25, H, hi - lo), (HX0 + 0.125, F + H / 2, (lo + hi) / 2))
        for yy in range(int(F) + 3, int(F + H), 3):
            p.box("cedar", (0.16, 0.3, hi - lo), (HX0 + 0.3, yy, (lo + hi) / 2), bevel=0.04)
        p.done()
    # beams of cedar across the house, boards over the north half
    for i in range(16):
        p = s.part(f"beam{i:02d}", tally="cedar")
        p.box("cedar", (0.8, 1.0, 2 * (HZ + t)), (HX0 + 4 * i, F + H + 0.5, 0), bevel=0.08)
        p.done()
    p = s.part("roof")
    x = HX0 - t
    while x < HX1 + t - 0.01:
        p.box("cedar", (0.95, 0.35, HZ + t), (x + 0.5, F + H + 1.18, (HZ + t) / 2), bevel=0.03)
        x += 1.0
    p.done()


# ------------------------------------------------------------------- debir
def debir():
    dx = (HX1 + DEBIR_X + 0.5) / 2
    dl = HX1 - DEBIR_X - 0.5
    s = Step("debir", anchor=(dx, F + 20.4, 0))
    for side in (-1, 1):
        p = s.part(f"partition_{'n' if side > 0 else 's'}", anim="grow")
        p.box("cedar", (1, H, 7.5), (DEBIR_X, F + H / 2, side * 6.25), bevel=0.05)
        for yy in range(int(F) + 2, int(F + H), 3):
            p.box("cedar", (1.15, 0.25, 7.5), (DEBIR_X, yy, side * 6.25), bevel=0.04)
        p.done()
    p = s.part("over_door")
    p.box("cedar", (1, H - 8, 5), (DEBIR_X, F + 8 + (H - 8) / 2, 0), bevel=0.05)
    p.done()
    # "he overlaid it with pure gold" — floor, walls, ceiling of the 20-cubit cube
    p = s.part("gold_floor", anim="grow:x", tally="gold")
    p.box("gold", (dl, 0.12, 2 * HZ), (dx, F + 0.26, 0))
    p.done()
    p = s.part("gold_north", anim="grow", tally="gold")
    p.box("gold", (dl, 20, 0.15), (dx, F + 10, HZ - 0.33))
    p.done()
    p = s.part("gold_west", anim="grow", tally="gold")
    p.box("gold", (0.15, 20, 2 * HZ), (HX1 - 0.08, F + 10, 0))
    p.done()
    p = s.part("gold_ceiling", tally="gold")
    p.box("gold", (dl, 0.3, HZ), (dx, F + 20.15, HZ / 2))
    p.done()
    # "he made a partition by the chains of gold before the oracle" (1 Kings 6:21)
    for row, yy in enumerate((F + 8.6, F + 9.4)):
        p = s.part(f"chain{row}", anim="grow:z", tally="gold")
        n = 52
        for i in range(n):
            z = -HZ + 0.2 + (2 * HZ - 0.4) * (i + 0.5) / n
            sag = 0.25 * math.sin(math.pi * (i + 0.5) / n)
            rot = (math.pi / 2, 0, 0) if i % 2 else (0, 0, 0)
            p.torus("gold", 0.2, 0.05, (DEBIR_X - 0.75, yy - sag, z), rot=rot, segs=(8, 4))
        p.done()


# ---------------------------------------------------------------- cherubim
def cherubim():
    s = Step("cherubim")
    for i, cz in enumerate((5.0, -5.0)):
        p = s.part(f"cherub{i}", anim="grow", hero=i == 0, tally="gold")
        fu.temple_cherub(p, 20.0, cz, F + 0.32)
        p.done()


# -------------------------------------------------------------------- veil
def veil():
    s = Step("veil")
    # doors of olive wood, carved and overlaid with gold (1 Kings 6:31–32)
    for side in (-1, 1):
        p = s.part(f"door_{'n' if side > 0 else 's'}", anim="pop", tally="olive")
        hx, hz = DEBIR_X - 0.6, side * 2.5
        ang = side * 1.0
        # the leaf hangs from its hinge, swung open by `ang`
        off = -side * 1.25
        mx = hx + math.sin(ang) * off
        mz = hz + math.cos(ang) * off
        p.box("olive", (0.2, 8, 2.5), (mx, F + 4, mz), rot_y=ang, bevel=0.04)
        for yy in (F + 2.2, F + 5.8):
            p.box("goldDark", (0.08, 2.6, 1.7), (mx - math.cos(ang) * 0.13, yy, mz + math.sin(ang) * 0.13), rot_y=ang, bevel=0.03)
        p.done()
    # the veil: blue, purple, crimson and fine linen, cherubim wrought on it (2 Chronicles 3:14)
    p = s.part("veil", anim="grow", hero=True, tally="linen", uv="fit")
    cols, rows = 80, 24
    x = DEBIR_X + 0.9
    verts, faces = [], []
    for r in range(rows + 1):
        yy = F + 20 * r / rows
        hang = 1 - r / rows  # folds deepen toward the hem
        for c in range(cols + 1):
            z = -HZ + 2 * HZ * c / cols
            verts.append((x + (0.08 + 0.12 * hang) * math.sin(z * 1.9), yy, z))
    for r in range(rows):
        for c in range(cols):
            i = r * (cols + 1) + c
            faces.append((i, i + 1, i + cols + 2, i + cols + 1))
    p.mesh("veil", verts, faces)
    p.done()


# ------------------------------------------------------------------- court
def court():
    s = Step("court", anchor=(CX0 - 1, 4, -GATE - 4))
    p = s.part("pavement", anim="grow:x", tally="floor")
    slab = 5.0
    x = CX0
    while x < CX1 - 0.01:
        z = -CZ
        while z < CZ - 0.01:
            p.box("floor", (slab - 0.1, 0.1, slab - 0.1), (x + slab / 2, 0.05, z + slab / 2))
            z += slab
        x += slab
    p.done()
    # "three rows of hewed stone, and a row of cedar beams" (1 Kings 6:36)
    east = CZ + 2 - GATE
    for row in range(4):
        beams = row == 3
        h = 0.6 if beams else 1.0
        y0 = float(row)
        key = "cedar" if beams else ("stone" if row % 2 else "stoneDark")
        p = s.part(f"row{row}", tally=key)
        runs = [
            ("x", CX0 - 2, CX1 + 2, CZ + 1),
            ("x", CX0 - 2, CX1 + 2, -CZ - 1),
            ("z", -CZ, CZ, CX1 + 1),
            ("z", GATE, GATE + east, CX0 - 1),
            ("z", -GATE - east, -GATE, CX0 - 1),
        ]
        for axis, a0, a1, c in runs:
            if beams:
                ashlar(p, "cedar", axis, a0, a1, y0, y0 + h, c, 2.0, course=h, block=6.0, bevel=0.06)
            else:
                ashlar(p, key, axis, a0, a1, y0, y0 + h, c, 2.0, course=h, block=3.5 if row != 1 else 4.0, bevel=0.08)
        p.done()


# ----------------------------------------------------------------- pillars
def pillar(step_id, z):
    """
    Bronze, eighteen cubits high, twelve round; a molten chapiter of five
    cubits with nets of checker work, wreaths of chain work, lily work, and two
    rows of pomegranates — two hundred (1 Kings 7:15–22; Jeremiah 52:21–23).
    """
    s = Step(step_id)
    r = 12 / TAU
    px = PILLAR_X
    p = s.part("shaft", anim="grow", hero=True, tally="bronze")
    p.cyl("bronze", r + 0.5, r + 0.35, 0.6, (px, F + 0.3, z), segs=40, bevel=0.06)
    p.torus("bronze", r + 0.12, 0.22, (px, F + 0.75, z), segs=(40, 6))
    p.cyl("bronze", r, r, 18, (px, F + 9, z), segs=40)
    p.torus("bronze", r + 0.05, 0.14, (px, F + 17.7, z), segs=(40, 6))
    p.done()

    p = s.part("chapiter", anim="drop", tally="bronze")
    y0 = F + 18
    # the bowl (gullah, 1 Kings 7:41) and the lily work above it
    bowl = [(0, 0), (r + 0.05, 0), (r + 0.55, 0.5), (r + 0.85, 1.3), (r + 0.75, 2.2), (r + 0.4, 2.6), (r + 0.3, 2.62), (0, 2.62)]
    p.lathe("bronze", bowl, (px, y0, z), segs=40)
    lily = [(0, 2.6), (r + 0.35, 2.6), (r + 0.5, 3.1), (r + 0.95, 4.0), (r + 1.25, 4.9), (r + 1.1, 5.0), (0, 5.0)]
    p.lathe("goldDark", lily, (px, y0, z), segs=40)
    # "lily work": petals opening up and out around the crown
    for i in range(16):
        a = TAU * i / 16
        petal = []
        for (rr, yy, w) in ((r + 0.45, 2.7, 0.0), (r + 0.75, 3.4, 0.36), (r + 1.15, 4.3, 0.42), (r + 1.55, 5.05, 0.0)):
            petal.append((rr, yy, w))
        verts, faces = [], []
        for rr, yy, w in petal:
            for side in (-1, 1):
                b = a + side * w / rr
                verts.append((px + math.cos(b) * rr, y0 + yy, z + math.sin(b) * rr))
        for k in range(len(petal) - 1):
            i0 = 2 * k
            faces.append((i0, i0 + 1, i0 + 3, i0 + 2))
        p.mesh("goldDark", verts, faces, smooth=True)
    # nets of checker work over the bowl
    rings = [(0.2, r + 0.3), (0.9, r + 0.82), (1.7, r + 0.95), (2.35, r + 0.74)]
    for (ya, ra), (yb, rb) in zip(rings, rings[1:]):
        for i in range(28):
            for d in (-1, 1):
                a0 = TAU * i / 28
                a1 = a0 + d * TAU / 28
                rod(p, "bronze", (px + math.cos(a0) * ra, y0 + ya, z + math.sin(a0) * ra), (px + math.cos(a1) * rb, y0 + yb, z + math.sin(a1) * rb), 0.05, segs=4)
    # "two hundred pomegranates in rows round about" (1 Kings 7:20)
    for row, (yy, rr) in enumerate(((y0 + 0.55, r + 0.62), (y0 + 1.95, r + 0.95))):
        for i in range(100):
            a = TAU * (i + 0.5 * row) / 100
            cx, cz = px + math.cos(a) * rr, z + math.sin(a) * rr
            p.sphere("bronze", 0.14, (cx, yy, cz), segs=(6, 4))
            p.cyl("bronze", 0.05, 0.07, 0.08, (cx, yy - 0.18, cz), segs=5)
    p.done()


def jachin():
    pillar("jachin", -6.0)


def boaz():
    pillar("boaz", 6.0)


# --------------------------------------------------------------------- sea
def sea():
    s = Step("sea")
    sx, sz = SEA
    for x, z, yaw in fu.sea_ox_places(sx, sz):
        p = s.part("ox", anim="drop:6", tally="bronze")
        p.merge_object("bronze", skin_object("ox", *fu.ox_skeleton(x, z, yaw), subsurf=1))
        p.done()
    p = s.part("basin", anim="drop:10", hero=True, tally="bronze")
    fu.sea_basin(p, sx, sz)
    p.done()


# ------------------------------------------------------------------ lavers
def laver(p, x, z):
    """
    A base of bronze, four by four by three, panels with lions, oxen and
    cherubim, wheels like chariot wheels a cubit and a half high, and a laver
    of four cubits above (1 Kings 7:27–38).
    """
    y = 0.1
    p.box("bronze", (4, 3, 4), (x, y + 2.1, z), bevel=0.06)
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.box("bronze", (0.35, 3.3, 0.35), (x + sx * 1.95, y + 2.05, z + sz * 1.95), bevel=0.05)
    # panels between ledges, a raised figure on each face
    for face in range(4):
        a = TAU * face / 4
        nx, nz = math.cos(a), math.sin(a)
        for j, yy in enumerate((y + 1.35, y + 2.85)):
            ledge = (0.06, 0.08, 4.1) if abs(nx) > 0.5 else (4.1, 0.08, 0.06)
            p.box("bronze", ledge, (x + nx * 2.03, yy - 0.75 if j == 0 else yy + 0.65, z + nz * 2.03))
            fx, fz = x + nx * 2.04, z + nz * 2.04
            p.sphere("goldDark", 0.42, (fx, yy, fz), segs=(8, 5), scale=(0.35 if abs(nx) > 0.5 else 1.0, 0.8, 1.0 if abs(nx) > 0.5 else 0.35))
    for wx in (-1.4, 1.4):
        for wz in (-2.2, 2.2):
            cx, cz = x + wx, z + wz
            # rim upright, axle along z
            p.torus("bronze", 0.68, 0.08, (cx, y + 0.75, cz), rot=(math.pi / 2, 0, 0), segs=(18, 4))
            for k in range(6):
                a = TAU * k / 6
                rod(p, "bronze", (cx, y + 0.75, cz), (cx + math.cos(a) * 0.66, y + 0.75 + math.sin(a) * 0.66, cz), 0.05, segs=4)
        rod(p, "bronze", (x + wx, y + 0.75, z - 2.3), (x + wx, y + 0.75, z + 2.3), 0.09, segs=6)
    p.cyl("bronze", 0.7, 0.9, 0.6, (x, y + 3.95, z), segs=20)
    bowl = [(0, 0), (1.2, 0.05), (1.85, 0.5), (2.05, 1.3), (1.95, 1.32), (1.75, 0.55), (1.1, 0.18), (0, 0.15)]
    p.lathe("bronze", bowl, (x, y + 4.2, z), segs=40)
    p.cyl("water", 1.75, 1.75, 0.05, (x, y + 5.3, z), segs=32)


def lavers():
    s = Step("lavers")
    for x in LAVER_XS:
        for side in (-1, 1):
            p = s.part("laver", tally="bronze")
            laver(p, float(x), side * LAVER_Z)
            p.done()


# ------------------------------------------------------------------- altar
def altar():
    x, z = ALTAR
    s = Step("altar")
    p = s.part("base", anim="grow", hero=True, tally="bronze")
    fu.great_altar_base(p, x, z)
    p.done()
    p = s.part("upper", anim="grow", tally="bronze")
    fu.great_altar_upper(p, x, z)
    p.done()
    for sx in (-1, 1):
        for sz in (-1, 1):
            p = s.part("horn", anim="pop", tally="bronze")
            fu.great_altar_horn(p, x, z, sx, sz)
            p.done()


# ------------------------------------------------------------- furnishings
def furnishings():
    """
    Ten candlesticks of gold, five on the right and five on the left
    (1 Kings 7:49), the table of shewbread and the golden altar.
    """
    s = Step("furnishings")
    for x in (-24, -18, -12, -6, 0):
        for z in (-7, 7):
            p = s.part("lampstand", anim="pop", tally="gold")
            fu.lampstand(p, (x, F + 0.2, z))
            p.done()
    p = s.part("table", anim="pop", tally="gold")
    fu.table(p, (-12.0, F + 0.2, 0.0))
    p.done()
    p = s.part("incense", anim="pop", tally="gold")
    fu.incense_altar(p, (6.0, F + 0.2, 0.0))
    p.done()


def ark():
    s = Step("ark")
    p = s.part("ark", anim="slide:-14,0,0", tally="gold")
    fu.ark(p, (20.0, F + 0.32, 0.0))
    p.done()


for build in (foundation, walls, porch, chambers, cedar, debir, cherubim, veil, court, jachin, boaz, sea, lavers, altar, furnishings, ark):
    build()
    print("built", build.__name__)

export(out_path())
