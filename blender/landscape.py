"""
The diorama's landscape kit: the trees, scrub, rocks and town pieces the map
scatters over the land as the camera comes down (src/components/diorama/
scatter.ts). Low-poly and flat-shaded, coloured in their materials, in real
metres (Blender z up; exported y up), each object's origin at its foot.

    npm run build:models -- landscape

Trees of the land the Bible knows: the olive, the cypress, the date palm, the
stone pine, the oak (or terebinth), the acacia of the wilderness; scrub and
boulders; and the flat-roofed houses, walls, towers and gates of its towns.
"""

import math
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, __import__("os").path.dirname(__file__))
from vb import export, out_path  # noqa: E402

random.seed(7)

COLOURS = {
    "bark": (0.27, 0.2, 0.14),
    "olive": (0.36, 0.42, 0.29),
    "cypress": (0.12, 0.2, 0.12),
    "palm": (0.3, 0.42, 0.17),
    "pine": (0.17, 0.27, 0.14),
    "oak": (0.25, 0.34, 0.15),
    "acacia": (0.4, 0.43, 0.22),
    "scrub": (0.38, 0.38, 0.24),
    "rock": (0.62, 0.58, 0.52),
    "limestone": (0.8, 0.75, 0.65),
    "mudbrick": (0.68, 0.54, 0.4),
    "roof": (0.6, 0.53, 0.43),
    "dark": (0.1, 0.08, 0.07),
}
_mats = {}


def mat(key):
    if key not in _mats:
        m = bpy.data.materials.new(key)
        m.use_nodes = True
        bsdf = m.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Base Color"].default_value = (*COLOURS[key], 1)
        bsdf.inputs["Roughness"].default_value = 0.9
        _mats[key] = m
    return _mats[key]


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()


def obj_from_bm(name, bm, key):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat(key))
    for p in mesh.polygons:
        p.use_smooth = False
    o = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(o)
    return o


def blob(bm, centre, radius, squash=(1, 1, 1), subdiv=1, jitter=0.18):
    """a lumpy icosphere: a clump of leaves, or a boulder"""
    geom = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    verts = geom["verts"]
    for v in verts:
        n = v.co.normalized()
        r = radius * (1 + random.uniform(-jitter, jitter))
        v.co = Vector((n.x * r * squash[0], n.y * r * squash[1], n.z * r * squash[2])) + Vector(centre)
    return verts


def cylinder(bm, base, top, r0, r1, segs=6):
    """a tapered column from base to top"""
    base, top = Vector(base), Vector(top)
    axis = top - base
    length = axis.length
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r0, radius2=r1, depth=length)
    rot = axis.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((base + top) / 2) @ rot, verts=geom["verts"])
    return geom["verts"]


def join(name, parts):
    """parts: [(bm, material)] -> one object, a material slot each"""
    objs = [obj_from_bm(f"{name}_{i}", bm, key) for i, (bm, key) in enumerate(parts)]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = name
    o.data.name = name
    return o


# ------------------------------------------------------------------- trees


def olive(name, x):
    trunk = bmesh.new()
    # a gnarled trunk: a few leaning, twisting segments
    pts = [(0, 0, 0), (0.2, 0.1, 0.8), (-0.1, 0.25, 1.6), (0.15, 0.1, 2.2)]
    for a, b in zip(pts, pts[1:]):
        cylinder(trunk, a, b, 0.32, 0.26)
    cylinder(trunk, pts[2], (-0.9, 0.4, 2.8), 0.16, 0.1)
    cylinder(trunk, pts[2], (0.9, -0.3, 2.9), 0.15, 0.1)
    leaves = bmesh.new()
    for c in [(0, 0, 3.4), (-1.1, 0.5, 3.0), (1.1, -0.3, 3.1), (0.3, 1.0, 3.2), (-0.2, -1.0, 3.0)]:
        blob(leaves, c, 1.3, squash=(1.1, 1.1, 0.7))
    return place(join(name, [(trunk, "bark"), (leaves, "olive")]), x)


def cypress(name, x):
    trunk = bmesh.new()
    cylinder(trunk, (0, 0, 0), (0, 0, 1.5), 0.25, 0.2)
    leaves = bmesh.new()
    geom = bmesh.ops.create_cone(leaves, cap_ends=True, segments=8, radius1=1.1, radius2=0.08, depth=11)
    for v in geom["verts"]:
        # a flame: swelling low, tapering high
        z = v.co.z + 5.5
        k = 1.0 + 0.25 * math.sin(z / 11 * math.pi)
        v.co.x *= k
        v.co.y *= k
        v.co.z = z + 1.0
    return place(join(name, [(trunk, "bark"), (leaves, "cypress")]), x)


def palm(name, x):
    trunk = bmesh.new()
    pts = [(0, 0, 0), (0.3, 0, 4), (0.8, 0.1, 8), (1.4, 0.15, 12)]
    for a, b in zip(pts, pts[1:]):
        cylinder(trunk, a, b, 0.32, 0.27, segs=7)
    fronds = bmesh.new()
    top = Vector(pts[-1])
    for i in range(11):
        ang = i / 11 * math.tau + random.uniform(-0.2, 0.2)
        d = Vector((math.cos(ang), math.sin(ang), 0))
        side = Vector((-d.y, d.x, 0)) * 0.55
        # a frond: up and out, then drooping, a narrow leaf strip
        p0, p1, p2 = top, top + d * 2.4 + Vector((0, 0, 1.0)), top + d * 4.6 + Vector((0, 0, -0.9))
        verts = [fronds.verts.new(p) for p in (p0, p1 + side, p2, p1 - side)]
        # one face: the material is double-sided, so both sides show
        fronds.faces.new(verts)
    return place(join(name, [(trunk, "bark"), (fronds, "palm")]), x)


def pine(name, x):
    trunk = bmesh.new()
    cylinder(trunk, (0, 0, 0), (0.3, 0, 8), 0.35, 0.22)
    cylinder(trunk, (0.3, 0, 7), (-1.6, 0.4, 9), 0.15, 0.1)
    cylinder(trunk, (0.3, 0, 7), (1.8, -0.5, 9.2), 0.15, 0.1)
    leaves = bmesh.new()
    # the stone pine's parasol
    for c in [(0, 0, 10), (-1.8, 0.6, 9.6), (1.9, -0.4, 9.7), (0.4, 1.9, 9.5), (-0.3, -1.9, 9.6)]:
        blob(leaves, c, 2.0, squash=(1.3, 1.3, 0.55))
    return place(join(name, [(trunk, "bark"), (leaves, "pine")]), x)


def oak(name, x):
    trunk = bmesh.new()
    cylinder(trunk, (0, 0, 0), (0, 0, 2.6), 0.45, 0.35)
    for ang in (0.3, 2.4, 4.4):
        cylinder(trunk, (0, 0, 2.4), (math.cos(ang) * 1.8, math.sin(ang) * 1.8, 4.2), 0.2, 0.14)
    leaves = bmesh.new()
    for c in [(0, 0, 5.2), (-2.0, 0.5, 4.6), (2.0, -0.4, 4.7), (0.5, 2.0, 4.8), (-0.4, -2.1, 4.6), (0, 0, 6.3)]:
        blob(leaves, c, 2.1, squash=(1, 1, 0.8))
    return place(join(name, [(trunk, "bark"), (leaves, "oak")]), x)


def acacia(name, x):
    trunk = bmesh.new()
    cylinder(trunk, (0, 0, 0), (0.2, 0, 2.2), 0.2, 0.15)
    for ang in (0.5, 2.6, 4.6):
        cylinder(trunk, (0.2, 0, 2.0), (math.cos(ang) * 2.2, math.sin(ang) * 2.2, 3.8), 0.1, 0.07)
    leaves = bmesh.new()
    # a flat umbrella of thorny leaves
    for c in [(0, 0, 4.2), (-2.0, 0.6, 4.0), (2.1, -0.5, 4.0), (0.5, 2.1, 4.0), (-0.5, -2.0, 4.0)]:
        blob(leaves, c, 1.7, squash=(1.3, 1.3, 0.3), jitter=0.3)
    return place(join(name, [(trunk, "bark"), (leaves, "acacia")]), x)


def shrub(name, x):
    leaves = bmesh.new()
    for c in [(0, 0, 0.5), (0.6, 0.2, 0.4), (-0.5, 0.3, 0.4), (0.1, -0.6, 0.35)]:
        blob(leaves, c, 0.6, squash=(1, 1, 0.75), jitter=0.25)
    return place(join(name, [(leaves, "scrub")]), x)


def boulder(name, x, size):
    bm = bmesh.new()
    blob(bm, (0, 0, size * 0.35), size, squash=(1.2, 0.9, 0.6), subdiv=1, jitter=0.3)
    return place(join(name, [(bm, "rock")]), x)


# ------------------------------------------------------------------- towns


def box(bm, lo, hi):
    (x0, y0, z0), (x1, y1, z1) = lo, hi
    geom = bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(
        bm,
        matrix=Matrix.Translation(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)) @ Matrix.Diagonal((x1 - x0, y1 - y0, z1 - z0, 1)),
        verts=geom["verts"],
    )


def parapet(bm, w, d, z, h=0.6, t=0.25):
    box(bm, (-w / 2, -d / 2, z), (w / 2, -d / 2 + t, z + h))
    box(bm, (-w / 2, d / 2 - t, z), (w / 2, d / 2, z + h))
    box(bm, (-w / 2, -d / 2, z), (-w / 2 + t, d / 2, z + h))
    box(bm, (w / 2 - t, -d / 2, z), (w / 2, d / 2, z + h))


def house(name, x, w, d, h, stuff, upper=None):
    walls = bmesh.new()
    box(walls, (-w / 2, -d / 2, 0), (w / 2, d / 2, h))
    parapet(walls, w, d, h)
    roof = bmesh.new()
    box(roof, (-w / 2 + 0.25, -d / 2 + 0.25, h), (w / 2 - 0.25, d / 2 - 0.25, h + 0.08))
    if upper:
        uw, ud, uh = upper
        box(walls, (w / 2 - uw, d / 2 - ud, h), (w / 2, d / 2, h + uh))
        box(roof, (w / 2 - uw + 0.2, d / 2 - ud + 0.2, h + uh), (w / 2 - 0.2, d / 2 - 0.2, h + uh + 0.08))
    door = bmesh.new()
    box(door, (-0.5, -d / 2 - 0.05, 0), (0.5, -d / 2 + 0.02, 1.9))
    return place(join(name, [(walls, stuff), (roof, "roof"), (door, "dark")]), x)


def tower(name, x):
    walls = bmesh.new()
    box(walls, (-3, -3, 0), (3, 3, 10))
    for i in range(4):
        for k in range(3):
            # crenellations
            a = -3 + k * 2.4
            if i == 0:
                box(walls, (a, -3, 10), (a + 1.2, -2.5, 11))
            elif i == 1:
                box(walls, (a, 2.5, 10), (a + 1.2, 3, 11))
            elif i == 2:
                box(walls, (-3, a, 10), (-2.5, a + 1.2, 11))
            else:
                box(walls, (2.5, a, 10), (3, a + 1.2, 11))
    return place(join(name, [(walls, "limestone")]), x)


def wall(name, x):
    """20 m of city wall along x, its foot at z 0; scaled along x to fit a ring"""
    walls = bmesh.new()
    box(walls, (-10, -1.6, 0), (10, 1.6, 7))
    for k in range(9):
        a = -10 + k * 2.3
        box(walls, (a, -1.6, 7), (a + 1.2, -1.0, 8))
    return place(join(name, [(walls, "limestone")]), x)


def gate(name, x):
    walls = bmesh.new()
    box(walls, (-7, -3.5, 0), (-2, 3.5, 10))
    box(walls, (2, -3.5, 0), (7, 3.5, 10))
    box(walls, (-2, -3.5, 6), (2, 3.5, 10))
    dark = bmesh.new()
    box(dark, (-2, -2.5, 0), (2, 2.5, 6))
    return place(join(name, [(walls, "limestone"), (dark, "dark")]), x)


def place(o, x):
    """laid out in a row in the .blend for looking at; the app reads each by name"""
    o.location = (x, 0, 0)
    return o


def main():
    reset()
    x = 0
    for fn in (olive, cypress, palm, pine, oak, acacia, shrub):
        fn(f"tree_{fn.__name__}" if fn is not shrub else "shrub", x)
        x += 15
    boulder("rock_a", x, 1.6)
    x += 10
    boulder("rock_b", x, 3.2)
    x += 15
    house("house_a", x, 7, 5.5, 3.4, "limestone")
    x += 15
    house("house_b", x, 6, 6, 3.0, "mudbrick")
    x += 15
    house("house_c", x, 9, 7, 3.6, "limestone", upper=(4, 3.5, 2.8))
    x += 15
    house("house_d", x, 5, 4.5, 2.8, "mudbrick", upper=(2.5, 2.5, 2.2))
    x += 15
    tower("tower", x)
    x += 15
    wall("wall", x)
    x += 30
    gate("gate", x)
    # everything sits at the origin in the file it is exported to
    for o in bpy.context.scene.objects:
        o.location = (0, 0, 0)
    export(out_path())


main()
