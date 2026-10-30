"""
The diorama's city kit: the landmarks and housing the map builds its ancient
cities from (src/components/diorama/cities.ts, src/world/towns.ts). Low-poly
and flat-shaded, coloured in their materials, in real metres (Blender z up,
x east, y north; exported y up), each object's origin at its foot. Big pieces
carry foundations below z 0, so on a slope the low side stands on its footing
instead of floating.

    npm run build:models -- city

Temples (Greek, Egyptian), theatres, the circus, the amphitheatre, colonnaded
streets, ziggurats, palaces and the Persian apadana, pyramids and obelisks,
the Pharos, citadels, harbour moles and aqueducts; Roman houses and
apartment blocks; and whole neighbourhoods as single pieces, for cities seen
from far off.
"""

import math
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, __import__("os").path.dirname(__file__))
from vb import export, out_path  # noqa: E402

random.seed(11)

COLOURS = {
    "limestone": (0.8, 0.75, 0.65),
    "marble": (0.86, 0.84, 0.79),
    "mudbrick": (0.68, 0.54, 0.4),
    "plaster": (0.82, 0.72, 0.56),
    "sandstone": (0.78, 0.64, 0.44),
    "terracotta": (0.62, 0.26, 0.15),
    "roof": (0.6, 0.53, 0.43),
    "glazed": (0.08, 0.22, 0.55),
    "gold": (0.85, 0.62, 0.2),
    "granite": (0.55, 0.32, 0.28),
    "cedar": (0.3, 0.2, 0.13),
    "sand": (0.78, 0.68, 0.5),
    "paving": (0.62, 0.6, 0.55),
    "dark": (0.1, 0.08, 0.07),
}
_mats = {}


def mat(key):
    if key not in _mats:
        m = bpy.data.materials.new(key)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*COLOURS[key], 1)
        bsdf.inputs["Roughness"].default_value = 0.85
        _mats[key] = m
    return _mats[key]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()


# ------------------------------------------------------------------ shapes


def box(bm, lo, hi):
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    geom = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(
        bm,
        matrix=Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) @ Matrix.Diagonal((x1 - x0, y1 - y0, z1 - z0, 1)),
        verts=geom["verts"],
    )
    return geom["verts"]


def gable(bm, lo, hi, along="x"):
    """a pitched roof over a box: the top edge pulled in to a ridge along x (or y)"""
    verts = box(bm, lo, hi)
    (x0, y0, _), (x1, y1, z1) = lo, hi
    for v in verts:
        if abs(v.co.z - z1) < 1e-4:
            if along == "x":
                v.co.y = (y0 + y1) / 2
            else:
                v.co.x = (x0 + x1) / 2
    bmesh.ops.remove_doubles(bm, verts=verts, dist=1e-4)


def hipped(bm, lo, hi, inset):
    """a hipped roof: the top face shrunk to a short ridge"""
    verts = box(bm, lo, hi)
    (x0, y0, _), (x1, y1, z1) = lo, hi
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for v in verts:
        if abs(v.co.z - z1) < 1e-4:
            v.co.x = cx + (v.co.x - cx) * inset
            v.co.y = cy
    bmesh.ops.remove_doubles(bm, verts=verts, dist=1e-4)


def column(bm, x, y, z0, z1, r, segs=8):
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r * 0.86, depth=z1 - z0)
    bmesh.ops.translate(bm, vec=(x, y, (z0 + z1) / 2), verts=geom["verts"])


def frustum(bm, x, y, z0, z1, r0, r1, segs=4, turn=math.pi / 4):
    """a cone or pyramid (segs 4) from z0 to z1"""
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r0, radius2=r1, depth=z1 - z0)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(turn, 3, "Z"), verts=geom["verts"])
    bmesh.ops.translate(bm, vec=(x, y, (z0 + z1) / 2), verts=geom["verts"])


def ring(bm, r0, r1, a0, a1, z0, z1, segs, sx=1.0, sy=1.0):
    """a solid annular sector (a whole ring if a1 - a0 is a full turn), its axis up"""
    full = abs((a1 - a0) - math.tau) < 1e-6
    n = segs if full else segs + 1
    rows = []
    for i in range(n):
        a = a0 + (a1 - a0) * i / segs
        c, s = math.cos(a), math.sin(a)
        rows.append([bm.verts.new((r * c * sx, r * s * sy, z)) for r, z in ((r0, z0), (r1, z0), (r1, z1), (r0, z1))])
    for i in range(segs):
        a, b = rows[i], rows[(i + 1) % n]
        for k in range(4):
            bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
    if not full:
        bm.faces.new(rows[0])
        bm.faces.new(list(reversed(rows[-1])))


def finish(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def obj_from_bm(name, bm, key):
    finish(bm)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat(key))
    for p in mesh.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    return o


def join(name, parts):
    """parts: {material: bm} -> one object, a material slot each"""
    objs = [obj_from_bm(f"{name}_{key}", bm, key) for key, bm in parts.items()]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


class Parts(dict):
    """a bmesh per material, made on first use"""

    def __missing__(self, key):
        self[key] = bmesh.new()
        return self[key]


# ----------------------------------------------------------------- housing


def flat_house(p, x, y, w, d, h, stuff, yaw=0.0):
    """a flat-roofed house with a parapet, its footing below ground"""
    c, s = math.cos(yaw), math.sin(yaw)
    for key, lo, hi in (
        (stuff, (-w / 2, -d / 2, -3), (w / 2, d / 2, h)),
        (stuff, (-w / 2, -d / 2, h), (w / 2, -d / 2 + 0.3, h + 0.6)),
        (stuff, (-w / 2, d / 2 - 0.3, h), (w / 2, d / 2, h + 0.6)),
        ("roof", (-w / 2 + 0.3, -d / 2 + 0.3, h), (w / 2 - 0.3, d / 2 - 0.3, h + 0.1)),
        ("dark", (-0.5, -d / 2 - 0.05, 0), (0.5, -d / 2 + 0.02, 1.9)),
    ):
        verts = box(p[key], lo, hi)
        bmesh.ops.transform(p[key], matrix=Matrix.Translation((x, y, 0)) @ Matrix(((c, -s, 0), (s, c, 0), (0, 0, 1))).to_4x4(), verts=verts)


def tiled_house(p, x, y, w, d, h, stuff="plaster"):
    """a Greek or Roman house: walls round an open court, under red tiles"""
    t = 3.0
    for lo, hi in (
        ((-w / 2, -d / 2, -3), (w / 2, -d / 2 + t, h)),
        ((-w / 2, d / 2 - t, -3), (w / 2, d / 2, h)),
        ((-w / 2, -d / 2, -3), (-w / 2 + t, d / 2, h)),
        ((w / 2 - t, -d / 2, -3), (w / 2, d / 2, h)),
    ):
        box(p[stuff], (lo[0] + x, lo[1] + y, lo[2]), (hi[0] + x, hi[1] + y, hi[2]))
    # roofs sloping in to the court
    gable(p["terracotta"], (x - w / 2 - 0.3, y - d / 2 - 0.3, h), (x + w / 2 + 0.3, y - d / 2 + t + 0.3, h + 1.6), "x")
    gable(p["terracotta"], (x - w / 2 - 0.3, y + d / 2 - t - 0.3, h), (x + w / 2 + 0.3, y + d / 2 + 0.3, h + 1.6), "x")
    gable(p["terracotta"], (x - w / 2 - 0.3, y - d / 2 + t, h), (x - w / 2 + t + 0.3, y + d / 2 - t, h + 1.6), "y")
    gable(p["terracotta"], (x + w / 2 - t - 0.3, y - d / 2 + t, h), (x + w / 2 + 0.3, y + d / 2 - t, h + 1.6), "y")


def house_roman(name):
    p = Parts()
    tiled_house(p, 0, 0, 14, 12, 5)
    box(p["dark"], (-1, -6.05, 0), (1, -5.95, 2.6))
    return join(name, p)


def insula(name):
    """a Roman apartment block: shops below, three floors of flats, a tiled roof"""
    p = Parts()
    w, d, h = 24, 18, 13
    box(p["plaster"], (-w / 2, -d / 2, -3), (w / 2, d / 2, h))
    hipped(p["terracotta"], (-w / 2 - 0.4, -d / 2 - 0.4, h), (w / 2 + 0.4, d / 2 + 0.4, h + 3), 0.5)
    for fl in range(3):
        z = 4.2 + fl * 3.0
        for k in range(6):
            xx = -w / 2 + 2.2 + k * 3.9
            box(p["dark"], (xx, -d / 2 - 0.05, z), (xx + 1.1, -d / 2 + 0.02, z + 1.4))
            box(p["dark"], (xx, d / 2 - 0.02, z), (xx + 1.1, d / 2 + 0.05, z + 1.4))
    for k in range(5):
        xx = -w / 2 + 1.5 + k * 4.4
        box(p["dark"], (xx, -d / 2 - 0.05, 0), (xx + 2.6, -d / 2 + 0.02, 2.8))
    return join(name, p)


def block(name, style):
    """a neighbourhood, about 48 × 36 m, as one piece: for a city seen from far off"""
    p = Parts()
    rnd = random.Random(hash(name) & 0xFFFF)
    if style == "roman":
        tiled_house(p, -12, -8, 20, 16, 5)
        tiled_house(p, 12, -9, 18, 14, 5)
        box(p["plaster"], (-22, 2, -3), (2, 16, 12))
        hipped(p["terracotta"], (-22.4, 1.6, 12), (2.4, 16.4, 14.5), 0.5)
        tiled_house(p, 13, 9, 18, 14, 5.5)
        return join(name, p)
    stuff = "mudbrick" if style == "mud" else "limestone"
    # houses packed along two lanes, of a storey or two, a few with an upper room
    for row, y in enumerate((-11, 0, 11)):
        x = -22.0
        while x < 20:
            w = rnd.uniform(6, 10)
            h = rnd.choice((3.0, 3.4, 3.8, 5.6, 6.4))
            flat_house(p, x + w / 2, y, w - 0.6, rnd.uniform(8.5, 10), h, stuff)
            x += w + (2.5 if rnd.random() < 0.18 else 0.4)
    return join(name, p)


# --------------------------------------------------------------- landmarks


def temple_greek(name):
    """a peripteral temple, Parthenon-sized: 8 columns by 17 on three steps"""
    p = Parts()
    W, L = 31, 69
    for i in range(3):
        box(p["marble"], (-W / 2 - 3 + i, -L / 2 - 3 + i, -8 if i == 0 else 0), (W / 2 + 3 - i, L / 2 + 3 - i, 0.55 * (i + 1)))
    zc = 1.65
    box(p["marble"], (-W / 2 + 5, -L / 2 + 9, zc), (W / 2 - 5, L / 2 - 9, zc + 11))
    h = 10.4
    for i in range(8):
        x = -W / 2 + 1.5 + i * (W - 3) / 7
        for y in (-L / 2 + 1.5, L / 2 - 1.5):
            column(p["marble"], x, y, zc, zc + h, 0.95)
    for j in range(1, 16):
        y = -L / 2 + 1.5 + j * (L - 3) / 16
        for x in (-W / 2 + 1.5, W / 2 - 1.5):
            column(p["marble"], x, y, zc, zc + h, 0.95)
    box(p["marble"], (-W / 2 + 0.3, -L / 2 + 0.3, zc + h), (W / 2 - 0.3, L / 2 - 0.3, zc + h + 2.2))
    gable(p["terracotta"], (-W / 2, -L / 2, zc + h + 2.2), (W / 2, L / 2, zc + h + 6.5), "y")
    return join(name, p)


def theatre(name):
    """a Greco-Roman theatre: the cavea a half bowl of stepped seats, open to the south, and the stage"""
    p = Parts()
    R, r = 52, 12
    tiers = 8
    for i in range(tiers):
        r0 = r + (R - r) * i / tiers
        ring(p["limestone"], r0, R, 0, math.pi, -6 if i == 0 else 0, 2.4 * (i + 1), 16)
    box(p["limestone"], (-R, -1, -6), (-R + 3, 2, 21))
    box(p["limestone"], (R - 3, -1, -6), (R, 2, 21))
    # the orchestra, the stage and its building
    ring(p["paving"], 0, r, 0, math.tau, -1, 0.15, 16)
    box(p["limestone"], (-30, -12, -4), (30, -4, 1.5))
    box(p["plaster"], (-34, -18, -4), (34, -12, 16))
    for k in range(9):
        column(p["marble"], -28 + k * 7, -11.2, 1.5, 9, 0.5, 6)
    return join(name, p)


def shifted(bm, offset, make):
    """run `make` (which adds to bm) and move what it added"""
    before = set(bm.verts)
    make()
    bmesh.ops.translate(bm, vec=offset, verts=[v for v in bm.verts if v not in before])


def hippodrome(name):
    """the circus: a sand track 450 m long, banked seats round it, the spina down the middle, gates at the west end"""
    p = Parts()
    L, W = 450, 80
    east = L / 2 - W / 2
    box(p["sand"], (-L / 2, -W / 2, -1), (east, W / 2, 0.1))
    shifted(p["sand"], (east, 0, 0), lambda: ring(p["sand"], 0, W / 2, -math.pi / 2, math.pi / 2, -1, 0.1, 12))
    for i in range(4):
        z0 = -4 if i == 0 else 0
        box(p["limestone"], (-L / 2, W / 2 + i * 4, z0), (east, W / 2 + 16, 3 * (i + 1)))
        box(p["limestone"], (-L / 2, -W / 2 - 16, z0), (east, -W / 2 - i * 4, 3 * (i + 1)))
        shifted(p["limestone"], (east, 0, 0), lambda i=i, z0=z0: ring(p["limestone"], W / 2 + i * 4, W / 2 + 16, -math.pi / 2, math.pi / 2, z0, 3 * (i + 1), 14))
    box(p["limestone"], (-150, -3, 0), (150, 3, 1.6))
    frustum(p["granite"], 0, 0, 1.6, 24, 1.3, 0.8)
    for x in (-150, 150):
        frustum(p["limestone"], x, 0, 1.6, 6, 1.6, 0.4, 8, 0)
    box(p["limestone"], (-L / 2 - 10, -W / 2 - 16, -4), (-L / 2, W / 2 + 16, 10))
    return join(name, p)


def amphitheatre(name):
    """the Colosseum: an elliptical bowl 188 × 156 m, 48 m high, arcaded outside"""
    p = Parts()
    a, b = 94, 78
    ring(p["limestone"], 0.9, 1.0, 0, math.tau, -6, 48, 40, a, b)
    for i in range(6):
        k0 = 0.45 + 0.075 * i
        ring(p["limestone"], k0, 0.9, 0, math.tau, -6 if i == 0 else 0, 8 + 6.5 * i, 40, a, b)
    ring(p["sand"], 0, 0.45, 0, math.tau, -1, 0.2, 24, a, b)
    # the arcades' shadows: dark bands round the outside, a storey each
    for z in (6, 18, 30):
        ring(p["dark"], 1.0, 1.004, 0, math.tau, z, z + 6, 40, a, b)
    return join(name, p)


def colonnade(name):
    """20 m of colonnaded street along x: the paved way, porticoes and shops either side"""
    p = Parts()
    box(p["paving"], (-10, -7, -1), (10, 7, 0.2))
    for side in (-1, 1):
        y = side * 8.5
        for k in range(4):
            column(p["marble"], -7.5 + k * 5, y, 0.2, 8, 0.45, 6)
        yb0, yb1 = sorted((side * 13.5, side * 14.5))
        box(p["plaster"], (-10, yb0, -2), (10, yb1, 9))
        lo, hi = sorted((side * 7.8, side * 14.6))
        box(p["paving"], (-10, lo, 0), (10, hi, 0.3))
        gable(p["terracotta"], (-10, lo, 8), (10, hi, 9.2), "x")
    return join(name, p)


def ziggurat(name):
    """a ziggurat, Etemenanki-sized: seven stepped stages, the shrine on top, a stair up the front"""
    p = Parts()
    stages = [(91, 0, 33), (78, 33, 51), (60, 51, 59), (51, 59, 65), (42, 65, 71), (33, 71, 77)]
    for i, (w, z0, z1) in enumerate(stages):
        box(p["mudbrick"], (-w / 2, -w / 2, -6 if i == 0 else z0), (w / 2, w / 2, z1))
        # a baked-brick skin at each stage's foot
        box(p["sandstone"], (-w / 2 - 0.3, -w / 2 - 0.3, z0 - (0 if i else 6)), (w / 2 + 0.3, w / 2 + 0.3, z0 + 2))
    box(p["glazed"], (-12, -12, 77), (12, 12, 91))
    box(p["gold"], (-12.5, -12.5, 91), (12.5, 12.5, 92))
    # the great stair from the south, rising to the second stage
    stair = box(p["sandstone"], (-5, -91 / 2 - 60, -2), (5, -91 / 2 + 2, 51))
    for v in stair:
        if v.co.y < -91 / 2 - 1 and v.co.z > 0:
            v.co.z = 0.5
    bmesh.ops.remove_doubles(p["sandstone"], verts=stair, dist=1e-4)
    return join(name, p)


def palace(name):
    """an Assyrian or Babylonian palace: buttressed mudbrick round courts, the throne room, a raised platform"""
    p = Parts()
    W, D = 180, 120
    box(p["mudbrick"], (-W / 2 - 6, -D / 2 - 6, -8), (W / 2 + 6, D / 2 + 6, 6))
    t, h = 6, 20
    for lo, hi in (
        ((-W / 2, -D / 2, 6), (W / 2, -D / 2 + t, 6 + h)),
        ((-W / 2, D / 2 - t, 6), (W / 2, D / 2, 6 + h)),
        ((-W / 2, -D / 2, 6), (-W / 2 + t, D / 2, 6 + h)),
        ((W / 2 - t, -D / 2, 6), (W / 2, D / 2, 6 + h)),
        ((-10, -D / 2, 6), (-4, D / 2, 6 + h)),
    ):
        box(p["plaster"], lo, hi)
    for k in range(13):
        x = -W / 2 + 6 + k * (W - 12) / 12
        box(p["plaster"], (x - 1.5, -D / 2 - 1.5, 6), (x + 1.5, -D / 2 + 1, 6 + h + 2))
    box(p["plaster"], (-4, -20, 6), (W / 2 - t, 4, 6 + h + 4))
    box(p["cedar"], (-3, -19, 6 + h + 4), (W / 2 - t - 1, 3, 6 + h + 4.6))
    for x, y, w, d in ((-W / 2 + t, 14, 40, 40), (-W / 2 + t + 44, -D / 2 + t, 34, 30), (10, 10, 70, 44)):
        box(p["plaster"], (x, y, 6), (x + w, y + d, 6 + 12))
        box(p["roof"], (x + 0.3, y + 0.3, 18), (x + w - 0.3, y + d - 0.3, 18.15))
    box(p["dark"], (-4, -D / 2 - 1.6, 6), (4, -D / 2 + 1.2, 16))
    return join(name, p)


def apadana(name):
    """the Persian audience hall: a terrace of stairs, 6 × 6 tall columns under a cedar roof, porticoes and corner towers"""
    p = Parts()
    T = 160
    box(p["limestone"], (-T / 2, -T / 2, -8), (T / 2, T / 2, 12))
    for x in (-24, 24):
        stair = box(p["limestone"], (x - 8, -T / 2 - 30, -2), (x + 8, -T / 2 + 1, 12))
        for v in stair:
            if v.co.y < -T / 2 - 1 and v.co.z > 0:
                v.co.z = 0.3
        bmesh.ops.remove_doubles(p["limestone"], verts=stair, dist=1e-4)
    H = 32
    for i in range(6):
        for j in range(6):
            column(p["limestone"], -27.5 + i * 11, -27.5 + j * 11, 12, 12 + H - 2, 1.0)
    for j in range(6):
        column(p["limestone"], -27.5 + j * 11, -45, 12, 12 + H - 2, 1.0)
    box(p["cedar"], (-36, -50, 12 + H - 2), (36, 36, 12 + H + 1))
    box(p["plaster"], (-37, -51, 12 + H + 1), (37, 37, 12 + H + 2.5))
    for x in (-40, 40):
        for y in (-48, 40):
            box(p["mudbrick"], (x - 9, y - 9, 12), (x + 9, y + 9, 12 + H + 4))
    return join(name, p)


def pyramid(name):
    """the Great Pyramid: 230 m square, 146 m high, with its white casing"""
    p = Parts()
    frustum(p["limestone"], 0, 0, -6, 146, 230 / math.sqrt(2) * (152 / 146), 0)
    return join(name, p)


def step_pyramid(name):
    """Djoser's step pyramid at Saqqara: six steps, 125 × 109 m, 62 m high"""
    p = Parts()
    for i in range(6):
        k = 1 - i * 0.14
        box(p["sandstone"], (-62.5 * k, -54.5 * k, -4 if i == 0 else i * 10.3), (62.5 * k, 54.5 * k, (i + 1) * 10.3))
    return join(name, p)


def obelisk(name):
    p = Parts()
    box(p["granite"], (-2.6, -2.6, -2), (2.6, 2.6, 1.2))
    frustum(p["granite"], 0, 0, 1.2, 21, 2.4 / math.sqrt(2) * 1.414, 1.5, 4)
    frustum(p["gold"], 0, 0, 21, 23, 1.5, 0.0, 4)
    return join(name, p)


def egypt_temple(name):
    """an Egyptian temple from the front (south): the pylon, an open court, the hypostyle hall, the sanctuary"""
    p = Parts()
    for x in (-21, 21):
        frustum(p["sandstone"], x, -40, -4, 28, 17, 13, 4, math.pi / 4)
    box(p["dark"], (-4, -46, 0), (4, -34, 14))
    box(p["sandstone"], (-4, -46, 14), (4, -34, 22))
    for lo, hi in (((-35, -34, -3), (-32, 26, 11)), ((32, -34, -3), (35, 26, 11))):
        box(p["sandstone"], lo, hi)
    for y in (-26, -14, -2, 10):
        for x in (-26, 26):
            column(p["sandstone"], x, y, 0, 10, 1.4, 8)
    box(p["sandstone"], (-35, 26, -3), (35, 76, 22))
    for k in range(8):
        column(p["sandstone"], -28 + k * 8, 25, 0, 20, 1.8, 8)
    box(p["sandstone"], (-20, 76, -3), (20, 112, 13))
    return join(name, p)


def lighthouse(name):
    """the Pharos of Alexandria: a square tower, an octagon, a round lantern, near 100 m"""
    p = Parts()
    box(p["limestone"], (-36, -36, -8), (36, 36, 6))
    frustum(p["limestone"], 0, 0, 6, 62, 22 * math.sqrt(2), 17 * math.sqrt(2), 4)
    frustum(p["limestone"], 0, 0, 62, 92, 11, 9.5, 8, math.pi / 8)
    frustum(p["limestone"], 0, 0, 92, 102, 6, 5, 12, 0)
    frustum(p["gold"], 0, 0, 102, 108, 2.5, 0.5, 8, 0)
    return join(name, p)


def citadel(name):
    """a citadel or acropolis keep: a walled square with corner towers and a tall keep"""
    p = Parts()
    S, t, h = 70, 5, 16
    for lo, hi in (
        ((-S / 2, -S / 2, -8), (S / 2, -S / 2 + t, h)),
        ((-S / 2, S / 2 - t, -8), (S / 2, S / 2, h)),
        ((-S / 2, -S / 2, -8), (-S / 2 + t, S / 2, h)),
        ((S / 2 - t, -S / 2, -8), (S / 2, S / 2, h)),
    ):
        box(p["limestone"], lo, hi)
    for x in (-S / 2, S / 2):
        for y in (-S / 2, S / 2):
            box(p["limestone"], (x - 6, y - 6, -8), (x + 6, y + 6, h + 7))
    box(p["limestone"], (-13, -5, -8), (13, 21, 28))
    box(p["dark"], (-3, -S / 2 - 0.1, 0), (3, -S / 2 + 0.5, 7))
    return join(name, p)


def mole(name):
    """20 m of harbour breakwater along x: a broad quay on rubble, a parapet on the sea side"""
    p = Parts()
    box(p["limestone"], (-10, -9, -12), (10, 9, 2.4))
    box(p["limestone"], (-10, 6.5, 2.4), (10, 9, 4.5))
    return join(name, p)


def aqueduct(name):
    """20 m of aqueduct along x: two arches on piers, the channel on top"""
    p = Parts()
    for x in (-10, 0, 10):
        x0, x1 = max(-10, x - 1.6), min(10, x + 1.6)
        box(p["limestone"], (x0, -1.6, -4), (x1, 1.6, 9))
    box(p["limestone"], (-10, -1.8, 9), (10, 1.8, 14))
    return join(name, p)


def gate_glazed(name):
    """the Ishtar Gate: twin towers in blue glazed brick, the arch between"""
    p = Parts()
    for x in (-13, 13):
        box(p["glazed"], (x - 8, -9, -4), (x + 8, 9, 25))
        for k in range(4):
            box(p["glazed"], (x - 9 + k * 6, -9.6, 25), (x - 6 + k * 6, -8.4, 28))
    box(p["glazed"], (-5, -7, 13), (5, 7, 23))
    box(p["dark"], (-5, -9.2, 0), (5, 9.2, 13))
    for z in (6, 12, 18):
        box(p["gold"], (-21.2, -9.3, z), (21.2, -9.1, z + 0.8))
    return join(name, p)


def paving(name):
    """20 × 20 m of forum or agora paving, its kerb below ground"""
    p = Parts()
    box(p["paving"], (-10, -10, -3), (10, 10, 0.4))
    return join(name, p)


PIECES = [
    ("house_roman", house_roman),
    ("insula", insula),
    ("block_stone", lambda n: block(n, "stone")),
    ("block_mud", lambda n: block(n, "mud")),
    ("block_roman", lambda n: block(n, "roman")),
    ("temple_greek", temple_greek),
    ("theatre", theatre),
    ("hippodrome", hippodrome),
    ("amphitheatre", amphitheatre),
    ("colonnade", colonnade),
    ("ziggurat", ziggurat),
    ("palace", palace),
    ("apadana", apadana),
    ("pyramid", pyramid),
    ("step_pyramid", step_pyramid),
    ("obelisk", obelisk),
    ("egypt_temple", egypt_temple),
    ("lighthouse", lighthouse),
    ("citadel", citadel),
    ("mole", mole),
    ("aqueduct", aqueduct),
    ("gate_glazed", gate_glazed),
    ("paving", paving),
]


def main():
    reset()
    for name, fn in PIECES:
        o = fn(name)
        o.location = (0, 0, 0)
    export(out_path())


main()
