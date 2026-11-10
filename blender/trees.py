"""
The diorama's near trees (src/components/diorama/scatter.ts): the trees,
scrub, grass and boulders the map stands on the land when the camera is low,
made as games make them. A trunk and branches, and a crown of leaf cards:
quads textured from a painted leaf atlas (public/models/foliage.png, painted
here too), cut out by its alpha. Each card's normals point out from the
crown's centre, so the crown lights as one soft volume rather than as a heap
of flat cards; its colours darken toward the inside of the crown, where the
light doesn't reach.

    npm run build:models -- trees

Real metres (Blender z up; exported y up), each object's origin at its foot.
The olive, the Tabor oak (or terebinth), the stone pine, the cypress, the
date palm, the acacia; maquis scrub, tufts of grass, and boulders. The
low-poly kit in landscape.py stands in for them further off.
"""

import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(__file__))
from vb import out_path  # noqa: E402

random.seed(17)
rng = np.random.default_rng(17)

ATLAS = os.path.join(os.path.dirname(__file__), "..", "public", "models", "foliage.png")
AW, AH, CELL = 1024, 512, 256
# the atlas's cells, 4 × 2
CELLS = ["olive", "oak", "pine", "cypress", "palm", "acacia", "shrub", "grass"]

# ------------------------------------------------------------------ the atlas

# sRGB, darker and lighter ends of each leaf's colour
PALETTE = {
    # the dull, dusty greens of the Mediterranean summer, not a lawn's
    "olive": ((0.33, 0.38, 0.29), (0.55, 0.59, 0.48)),
    "oak": ((0.17, 0.25, 0.11), (0.33, 0.4, 0.19)),
    "pine": ((0.13, 0.22, 0.12), (0.26, 0.35, 0.19)),
    "cypress": ((0.08, 0.15, 0.09), (0.18, 0.26, 0.15)),
    "palm": ((0.25, 0.33, 0.15), (0.43, 0.48, 0.25)),
    "acacia": ((0.34, 0.38, 0.21), (0.5, 0.52, 0.31)),
    "shrub": ((0.25, 0.29, 0.17), (0.42, 0.43, 0.27)),
    "grass": ((0.4, 0.42, 0.24), (0.7, 0.62, 0.38)),
}
TWIG = (0.32, 0.26, 0.19)

img = np.zeros((AH, AW, 4), np.float32)  # drawn y down, row 0 at the top


def origin(name):
    i = CELLS.index(name)
    return (i % 4) * CELL, (i // 4) * CELL


def blend(region, mask, rgb):
    region[mask, 0] = rgb[0]
    region[mask, 1] = rgb[1]
    region[mask, 2] = rgb[2]
    region[mask, 3] = 1.0


def leaf(name, cx, cy, a, b, ang, t):
    """a leaf: an ellipse at (cx, cy) in the cell, a and b its half-length and half-width, lit along its midrib"""
    x0, y0 = origin(name)
    r = int(math.ceil(max(a, b))) + 1
    xa, xb = max(0, int(cx) - r), min(CELL, int(cx) + r + 1)
    ya, yb = max(0, int(cy) - r), min(CELL, int(cy) + r + 1)
    if xa >= xb or ya >= yb:
        return
    Y, X = np.mgrid[ya:yb, xa:xb].astype(np.float32)
    dx, dy = X - cx, Y - cy
    c, s = math.cos(ang), math.sin(ang)
    u = dx * c + dy * s
    v = -dx * s + dy * c
    d = (u / a) ** 2 + (v / b) ** 2
    mask = d <= 1.0
    lo, hi = PALETTE[name]
    base = np.array(lo) + (np.array(hi) - np.array(lo)) * t
    # one half of the leaf a little lighter than the other, the edge a little darker
    shade = 0.86 + 0.18 * np.sign(v) * 0.5 + 0.1 * (1 - d)
    region = img[y0 + ya : y0 + yb, x0 + xa : x0 + xb]
    for k in range(3):
        ch = region[..., k]
        ch[mask] = (base[k] * shade)[mask]
    region[..., 3][mask] = 1.0


def twig(name, p0, p1, w):
    x0, y0 = origin(name)
    xa, xb = int(max(0, min(p0[0], p1[0]) - w - 1)), int(min(CELL, max(p0[0], p1[0]) + w + 2))
    ya, yb = int(max(0, min(p0[1], p1[1]) - w - 1)), int(min(CELL, max(p0[1], p1[1]) + w + 2))
    if xa >= xb or ya >= yb:
        return
    Y, X = np.mgrid[ya:yb, xa:xb].astype(np.float32)
    px, py = p1[0] - p0[0], p1[1] - p0[1]
    l2 = px * px + py * py or 1
    t = np.clip(((X - p0[0]) * px + (Y - p0[1]) * py) / l2, 0, 1)
    dist = np.hypot(X - p0[0] - px * t, Y - p0[1] - py * t)
    mask = dist <= w * (1 - 0.5 * t)
    blend(img[y0 + ya : y0 + yb, x0 + xa : x0 + xb], mask, TWIG)


def sprigs(name, count, leaves, a, b, spread, droop=0.0):
    """twigs fanning up from the cell's foot, leaves along each at an angle"""
    for _ in range(count):
        bx = CELL * (0.12 + 0.76 * random.random())
        ang = -math.pi / 2 + random.uniform(-1.15, 1.15)
        length = CELL * random.uniform(0.6, 0.95)
        p0 = (bx, CELL - 4)
        p1 = (bx + math.cos(ang) * length, CELL - 4 + math.sin(ang) * length)
        twig(name, p0, p1, 2.2)
        for k in range(leaves):
            t = 0.15 + 0.85 * random.random()
            px = p0[0] + (p1[0] - p0[0]) * t
            py = p0[1] + (p1[1] - p0[1]) * t
            side = 1 if random.random() < 0.5 else -1
            la = ang + side * spread + random.uniform(-0.25, 0.25) + droop
            off = a * 0.9
            leaf(name, px + math.cos(la) * off, py + math.sin(la) * off, a * random.uniform(0.75, 1.15), b * random.uniform(0.8, 1.2), la, random.random())


def paint_atlas():
    # olive: narrow silver-green leaves in pairs along the twigs
    sprigs("olive", 13, 44, 15, 3.6, 0.7)
    # oak: broader leaves, denser
    sprigs("oak", 13, 40, 13, 7.5, 0.9)
    # stone pine: tufts of long needles
    for _ in range(42):
        cx, cy = random.uniform(18, CELL - 18), random.uniform(18, CELL - 18)
        for _ in range(50):
            ang = random.uniform(0, math.tau)
            ln = random.uniform(14, 24)
            leaf("pine", cx + math.cos(ang) * ln * 0.55, cy + math.sin(ang) * ln * 0.55, ln * 0.55, 1.3, ang, random.random())
    # cypress: a dense sheet of small scale-leaf sprays, ragged at the edge
    for _ in range(1500):
        cx, cy = random.uniform(8, CELL - 8), random.uniform(8, CELL - 8)
        edge = min(cx, cy, CELL - cx, CELL - cy)
        if edge < 26 and random.random() > edge / 26:
            continue
        leaf("cypress", cx, cy, random.uniform(5, 8), random.uniform(3, 4.5), random.uniform(-1.9, -1.2), random.random())
    # palm: one frond, its rachis up the middle, leaflets angled out and down either side
    twig("palm", (CELL / 2, CELL - 2), (CELL / 2, 4), 3.0)
    for k in range(64):
        t = k / 64
        y = CELL - 6 - t * (CELL - 14)
        ln = 60 * (1 - 0.6 * t) + 8
        for side in (-1, 1):
            ang = -math.pi / 2 + side * (1.05 - 0.25 * t)
            leaf("palm", CELL / 2 + math.cos(ang) * ln * 0.5, y + math.sin(ang) * ln * 0.5 + 6, ln * 0.5, 2.4, ang, random.random())
    # acacia: feathery sprays of tiny leaflets
    sprigs("acacia", 18, 90, 4.8, 2.0, 1.2)
    # maquis: small tough leaves, dense
    sprigs("shrub", 16, 60, 6.5, 4.4, 0.8)
    # grass: blades up from the foot, green and dry together
    for _ in range(90):
        bx = random.uniform(20, CELL - 20)
        ang = -math.pi / 2 + random.uniform(-0.35, 0.35)
        ln = random.uniform(90, 200)
        leaf("grass", bx + math.cos(ang) * ln * 0.5, CELL - 2 + math.sin(ang) * ln * 0.5, ln * 0.5, 2.3, ang, random.random())

    # bleed each cell's mean colour into its empty pixels, so the cut-out edges don't darken as it mips
    for name in CELLS:
        x0, y0 = origin(name)
        cell = img[y0 : y0 + CELL, x0 : x0 + CELL]
        solid = cell[..., 3] > 0.5
        mean = cell[solid][:, :3].mean(axis=0) if solid.any() else np.array([0.4, 0.45, 0.3])
        for k in range(3):
            ch = cell[..., k]
            ch[~solid] = mean[k]

    im = bpy.data.images.new("foliage", AW, AH, alpha=True)
    im.pixels.foreach_set(img[::-1].ravel())
    im.filepath_raw = os.path.abspath(ATLAS)
    im.file_format = "PNG"
    im.save()
    print(f"atlas {os.path.abspath(ATLAS)}")


def uv_rect(name):
    i = CELLS.index(name)
    col, row = i % 4, i // 4
    inset = 2 / AW
    return (col / 4 + inset, 1 - (row + 1) / 2 + inset * 2, (col + 1) / 4 - inset, 1 - row / 2 - inset * 2)


# ------------------------------------------------------------------ materials

MATS = {"bark": (0.27, 0.21, 0.16), "foliage": (1, 1, 1), "rock": (0.56, 0.53, 0.48)}
_mats = {}


def mat(key):
    if key not in _mats:
        m = bpy.data.materials.new(key)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*MATS[key], 1)
        bsdf.inputs["Roughness"].default_value = 0.9
        _mats[key] = m
    return _mats[key]


# ------------------------------------------------------------------ building

class Part:
    """a mesh being built: vertices, faces, uvs, per-vertex normals and colours"""

    def __init__(self):
        self.v, self.f, self.uv, self.n, self.c = [], [], [], [], []

    def quad(self, corners, uvs, normals, colour):
        i = len(self.v)
        self.v += corners
        self.uv += uvs
        self.n += normals
        self.c += [colour] * 4
        self.f.append((i, i + 1, i + 2, i + 3))

    def merge_bm(self, bm, colour_fn):
        """a bmesh's faces, smooth-shaded, coloured per vertex"""
        bm.normal_update()
        idx = {}
        for vert in bm.verts:
            idx[vert] = len(self.v)
            self.v.append(tuple(vert.co))
            self.n.append(tuple(vert.normal))
            self.uv.append((0.0, 0.0))
            self.c.append(colour_fn(vert.co))
        for face in bm.faces:
            self.f.append(tuple(idx[v] for v in face.verts))
        bm.free()


def to_object(name, parts):
    """parts: {material: Part} -> one object, a material slot each, with custom normals and vertex colours"""
    objs = []
    for key, p in parts.items():
        if not p.f:
            continue
        me = bpy.data.meshes.new(f"{name}_{key}")
        me.from_pydata(p.v, [], p.f)
        me.update()
        uvl = me.uv_layers.new(name="UVMap")
        col = me.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
        for li, loop in enumerate(me.loops):
            uvl.data[li].uv = p.uv[loop.vertex_index]
        for vi, c in enumerate(p.c):
            col.data[vi].color = (*c, 1.0)
        me.normals_split_custom_set_from_vertices([Vector(n).normalized() for n in p.n])
        me.materials.append(mat(key))
        o = bpy.data.objects.new(f"{name}_{key}", me)
        bpy.context.scene.collection.objects.link(o)
        objs.append(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


def bark_colour(z, top):
    k = 0.72 + 0.28 * min(1, z / max(top, 0.1))
    return (k, k * 0.98, k * 0.95)


def limb(part, a, b, r0, r1, top, segs=7):
    bm = bmesh.new()
    a, b = Vector(a), Vector(b)
    axis = b - a
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r0, radius2=r1, depth=axis.length)
    rot = axis.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=geom["verts"])
    part.merge_bm(bm, lambda co: bark_colour(co.z, top))


def card(part, at, size, normal, cell, centre, radius, upright=False, spin=None, whole=None):
    """a leaf card: a square at `at`, facing `normal`, its uvs a cell of the atlas; lit from the crown's centre"""
    at, normal = Vector(at), Vector(normal).normalized()
    if upright:
        # stands up (grass, cypress): its up stays up, it faces out
        up = Vector((0, 0, 1))
        side = up.cross(normal)
        if side.length < 1e-3:
            side = Vector((1, 0, 0))
        side.normalize()
        up = normal.cross(side).normalized()
    else:
        ref = Vector((0, 0, 1)) if abs(normal.z) < 0.9 else Vector((1, 0, 0))
        side = ref.cross(normal).normalized()
        up = normal.cross(side).normalized()
        a = spin if spin is not None else random.uniform(0, math.tau)
        side, up = side * math.cos(a) + up * math.sin(a), -side * math.sin(a) + up * math.cos(a)
    h = size / 2
    corners = [at - side * h - up * h, at + side * h - up * h, at + side * h + up * h, at - side * h + up * h]
    u0, v0, u1, v1 = uv_rect(cell)
    uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    c = Vector(centre)
    wc, wr = (Vector(whole[0]), whole[1]) if whole else (c, radius)
    normals, ao = [], []
    for p in corners:
        d = p - c
        rel = Vector((d.x / radius[0], d.y / radius[1], d.z / radius[2]))
        # a clump of leaves rounds the light by itself, within the crown's own rounding
        dw = p - wc
        relw = Vector((dw.x / wr[0], dw.y / wr[1], dw.z / wr[2]))
        normals.append(tuple((rel.normalized() * 0.6 + relw.normalized() * 0.5 + Vector((0, 0, 0.3))).normalized()))
        ao.append(0.5 * rel.length + 0.5 * relw.length)
    # darker deep in the crown and underneath, where the light doesn't reach
    depth = sum(ao) / 4
    under = max(0.0, -(at.z - wc.z) / max(wr[2], 0.1))
    k = max(0.3, min(1.0, 0.42 + 0.62 * depth - 0.3 * under)) * random.uniform(0.8, 1.1)
    tint = random.uniform(-0.05, 0.05)
    part.quad([tuple(p) for p in corners], uvs, normals, (k * (1 + tint), k, k * (1 - tint)))


def crown(part, centre, radius, n, size, cell, flat=0.0, upright=False, whole=None):
    """n cards through an ellipsoid; `flat` tilts them toward lying level (pine, acacia)"""
    cx, cy, cz = centre
    for _ in range(n):
        while True:
            p = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))
            if p.length <= 1:
                break
        # most leaves at the crown's skin
        p = p.normalized() * (0.55 + 0.45 * p.length ** 0.5)
        at = (cx + p.x * radius[0], cy + p.y * radius[1], cz + p.z * radius[2])
        normal = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1))) + p * 0.8
        normal.z += 0.6 + flat * 3
        card(part, at, size * random.uniform(0.8, 1.2), normal, cell, centre, radius, upright, whole=whole)


def clumps(part, centre, radius, count, n, size, cell, flat=0.0, fill=0.5):
    """
    a crown as a tree grows one: `count` clumps of leaves set round an
    ellipsoid, each of n cards and about `fill` of its size, so its outline is
    broken and its light and shade fall clump by clump
    """
    cx, cy, cz = centre
    whole = (centre, radius)
    for i in range(count):
        # spread evenly over the upper sphere (a spiral), then shaken
        t = (i + 0.5) / count
        z = 1 - 1.5 * t  # from the top to a little under the middle
        a = i * 2.39996 + random.uniform(-0.3, 0.3)
        r = math.sqrt(max(0.0, 1 - z * z))
        k = random.uniform(0.5, 0.78)
        c = (cx + math.cos(a) * r * radius[0] * k, cy + math.sin(a) * r * radius[1] * k, cz + z * radius[2] * k)
        f = fill * random.uniform(0.8, 1.25)
        crown(part, c, (radius[0] * f, radius[1] * f, radius[2] * f * (1 - 0.4 * flat)), n, size, cell, flat, whole=whole)


# ------------------------------------------------------------------- the trees

def olive(name):
    bark, leaves = Part(), Part()
    pts = [(0, 0, 0), (0.25, 0.1, 0.9), (-0.1, 0.3, 1.7), (0.2, 0.05, 2.3)]
    for a, b in zip(pts, pts[1:]):
        limb(bark, a, b, 0.38, 0.3, 4.5)
    for end in ((-1.4, 0.6, 3.1), (1.3, -0.4, 3.2), (0.3, 1.4, 3.3), (-0.2, -1.3, 3.1), (0.1, 0.1, 3.6)):
        limb(bark, pts[2], end, 0.17, 0.08, 4.5, 5)
    clumps(leaves, (0, 0, 3.4), (2.6, 2.6, 1.5), 9, 20, 1.05, "olive", fill=0.42)
    return to_object(name, {"bark": bark, "foliage": leaves})


def oak(name):
    bark, leaves = Part(), Part()
    limb(bark, (0, 0, 0), (0, 0, 2.8), 0.5, 0.38, 7)
    ends = [(math.cos(a) * 2.3, math.sin(a) * 2.3, 4.6 + random.uniform(-0.3, 0.5)) for a in (0.3, 1.5, 2.7, 3.9, 5.1)]
    for e in ends:
        limb(bark, (0, 0, 2.6), e, 0.22, 0.1, 7, 6)
    clumps(leaves, (0, 0, 5.3), (3.9, 3.9, 2.6), 13, 22, 1.45, "oak", fill=0.44)
    return to_object(name, {"bark": bark, "foliage": leaves})


def pine(name):
    bark, leaves = Part(), Part()
    limb(bark, (0, 0, 0), (0.35, 0, 8.4), 0.42, 0.24, 10)
    ends = []
    for a in (0.2, 1.4, 2.6, 3.8, 5.0):
        e = (0.35 + math.cos(a) * 2.6, math.sin(a) * 2.6, 9.4 + random.uniform(-0.3, 0.3))
        ends.append(e)
        limb(bark, (0.35, 0, 7.6), e, 0.17, 0.09, 10, 6)
    # the stone pine's parasol: wide, flat, dense on top
    clumps(leaves, (0.35, 0, 10.0), (4.5, 4.5, 1.5), 12, 20, 1.6, "pine", flat=0.6, fill=0.42)
    return to_object(name, {"bark": bark, "foliage": leaves})


def cypress(name):
    bark, leaves = Part(), Part()
    limb(bark, (0, 0, 0), (0, 0, 2.0), 0.26, 0.2, 11)
    # a dark flame: cards standing round the axis, the profile swelling low and tapering to a point
    for _ in range(150):
        z = 1.0 + random.random() ** 0.85 * 10.6
        t = (z - 1.0) / 10.6
        r = 1.15 * math.sin(min(1, t * 1.25 + 0.15) * math.pi) * (1 - 0.15 * t) + 0.15
        a = random.uniform(0, math.tau)
        at = (math.cos(a) * r * 0.75, math.sin(a) * r * 0.75, z)
        out = Vector((math.cos(a), math.sin(a), 0.15))
        card(leaves, at, random.uniform(1.0, 1.4), out, "cypress", (0, 0, z), (r + 0.3, r + 0.3, 1.6), upright=True)
    return to_object(name, {"bark": bark, "foliage": leaves})


def palm(name):
    bark, leaves = Part(), Part()
    pts = [(0, 0, 0), (0.25, 0, 3.5), (0.65, 0.08, 7.5), (1.15, 0.15, 11.5)]
    for a, b in zip(pts, pts[1:]):
        limb(bark, a, b, 0.33, 0.28, 12, 8)
    top = Vector(pts[-1])
    u0, v0, u1, v1 = uv_rect("palm")
    # fronds: each a strip of three quads, up and out, then drooping; the frond texture along it
    for i in range(18):
        ang = i / 18 * math.tau + random.uniform(-0.15, 0.15)
        lift = random.uniform(-0.3, 0.6)
        d = Vector((math.cos(ang), math.sin(ang), 0))
        side = Vector((-d.y, d.x, 0))
        path = [top, top + d * 1.6 + Vector((0, 0, 0.9 + lift)), top + d * 3.3 + Vector((0, 0, 0.7 + lift)), top + d * 4.8 + Vector((0, 0, -0.5 + lift))]
        widths = [0.5, 1.5, 1.3, 0.6]
        for k in range(3):
            a, b = path[k], path[k + 1]
            wa, wb = widths[k], widths[k + 1]
            va, vb = v0 + (v1 - v0) * k / 3, v0 + (v1 - v0) * (k + 1) / 3
            n = (b - a).cross(side).normalized()
            if n.z < 0:
                n = -n
            nn = tuple((n + Vector((0, 0, 0.6))).normalized())
            shade = 0.75 + 0.1 * k
            leaves.quad(
                [tuple(a - side * wa), tuple(a + side * wa), tuple(b + side * wb), tuple(b - side * wb)],
                [(u0, va), (u1, va), (u1, vb), (u0, vb)],
                [nn] * 4,
                (shade, shade, shade),
            )
    return to_object(name, {"bark": bark, "foliage": leaves})


def acacia(name):
    bark, leaves = Part(), Part()
    limb(bark, (0, 0, 0), (0.2, 0, 2.2), 0.24, 0.17, 4.5)
    ends = []
    for a in (0.5, 1.8, 3.0, 4.2, 5.4):
        e = (0.2 + math.cos(a) * 2.6, math.sin(a) * 2.6, 3.9 + random.uniform(-0.2, 0.3))
        ends.append(e)
        limb(bark, (0.2, 0, 2.0), e, 0.11, 0.06, 4.5, 5)
    clumps(leaves, (0.2, 0, 4.3), (3.4, 3.4, 0.8), 9, 14, 1.3, "acacia", flat=0.8, fill=0.4)
    return to_object(name, {"bark": bark, "foliage": leaves})


def shrub(name):
    leaves = Part()
    clumps(leaves, (0, 0, 0.55), (1.15, 1.15, 0.75), 5, 9, 0.75, "shrub", fill=0.55)
    return to_object(name, {"foliage": leaves})


def grass(name):
    leaves = Part()
    for i in range(5):
        a = i / 5 * math.pi + random.uniform(-0.2, 0.2)
        n = Vector((math.cos(a), math.sin(a), 0.0))
        card(leaves, (random.uniform(-0.15, 0.15), random.uniform(-0.15, 0.15), 0.42), 0.95, n, "grass", (0, 0, 0), (1, 1, 1), upright=True)
    # tufts are lit from above, not from a centre
    p = leaves
    p.n = [(0.0, 0.0, 1.0)] * len(p.n)
    p.c = [(0.75 + 0.25 * min(1, v[2] / 0.8),) * 3 for v in p.v]
    return to_object(name, {"foliage": p})


def stone(part, at, size, squash):
    """a stone as limestone breaks: angular, flat-faced, half sunk in the ground, paler on top"""
    bm = bmesh.new()
    geom = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    turn = Matrix.Rotation(random.uniform(0, math.tau), 3, "Z")
    for v in geom["verts"]:
        n = v.co.normalized()
        r = size * random.uniform(0.62, 1.12)
        v.co = turn @ Vector((n.x * r * squash[0], n.y * r * squash[1], n.z * r * squash[2])) + Vector((at[0], at[1], size * squash[2] * 0.3))
    # a facet each: its own vertices and the face's normal, so it catches the light as cut stone does
    bm.normal_update()
    for face in bm.faces:
        n = face.normal
        up = max(0.0, n.z)
        shade = (0.6 + 0.4 * up) * random.uniform(0.82, 1.08)
        warm = random.uniform(-0.03, 0.04)
        i = len(part.v)
        for vert in face.verts:
            part.v.append(tuple(vert.co))
            part.n.append(tuple(n))
            part.uv.append((0.0, 0.0))
            part.c.append((shade * (1 + warm), shade, shade * (1 - warm * 1.5)))
        part.f.append(tuple(range(i, i + len(face.verts))))
    bm.free()


def boulder(name, stones):
    """a scatter of stones, as they lie on a hillside: [(x, y, size, squash)]"""
    part = Part()
    for x, y, size, squash in stones:
        stone(part, (x, y), size, squash)
    return to_object(name, {"rock": part})


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_vertex_color="ACTIVE",
        export_normals=True,
    )
    print(f"exported {path}")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    paint_atlas()
    for name, fn in (("olive", olive), ("oak", oak), ("pine", pine), ("cypress", cypress), ("palm", palm), ("acacia", acacia), ("shrub", shrub), ("grass", grass)):
        fn(name)
    # loose stones; and an outcrop, a ledge of bedrock with its fallen pieces
    boulder("rock_a", [(0, 0, 0.9, (1.3, 0.9, 0.6)), (1.5, 0.6, 0.5, (1.1, 1.0, 0.7)), (-0.9, 1.3, 0.35, (1, 1, 0.7)), (0.4, -1.4, 0.45, (1.2, 0.8, 0.6))])
    boulder("rock_b", [(0, 0, 2.1, (1.6, 1.0, 0.45)), (2.4, 0.9, 1.1, (1.3, 0.9, 0.5)), (-1.9, -1.2, 0.8, (1.1, 1.0, 0.6)), (0.6, 2.2, 0.6, (1, 1, 0.7)), (1.2, -2.0, 0.4, (1, 1, 0.7))])
    for o in bpy.context.scene.objects:
        o.location = (0, 0, 0)
    export(out_path())


main()
