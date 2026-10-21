"""
Shared helpers for the Visual Bible model scripts (run inside Blender).

Models are authored in the app's own coordinates — 1 unit = 1 cubit, y up,
x east→west, z south→north — and converted to Blender's z-up on the way in,
so numbers can be copied straight from `src/data/builds/*.ts`.

Every part belongs to a build step: parts are children of an empty named
`step_<id>`, and carry their animation, label and counter hints as custom
properties, which the glTF exporter writes as `extras` (three: `userData`).
Materials are only named (`stone`, `cedar`, `gold`…): the app swaps in its own
PBR materials by name, so the textures and lighting stay the app's.
"""

import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

# one texture repeat per 2.2 cubits, the same scale as the app's tileMaterial
UV_SCALE = 1 / 2.2


def V(x, y, z):
    """app (y up, z north) → Blender (z up)"""
    return Vector((x, -z, y))


def place(x, y, z, rot_y=0.0, scale=(1, 1, 1), rot_x=0.0):
    """a Blender matrix from app-space position, yaw, pitch about x, and (x, y, z) scale"""
    sx, sy, sz = scale
    return (
        Matrix.Translation(V(x, y, z))
        @ Matrix.Rotation(rot_y, 4, "Z")
        @ Matrix.Rotation(rot_x, 4, "X")
        @ Matrix.Diagonal((sx, sz, sy, 1))
    )


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _MATS.clear()


# ---------------------------------------------------------------- materials --

_MATS = {}

# viewport colours only; the app replaces these by name
_PREVIEW = {
    "stone": (0.78, 0.72, 0.62),
    "stoneDark": (0.54, 0.49, 0.43),
    "floor": (0.77, 0.71, 0.6),
    "cedar": (0.69, 0.48, 0.28),
    "fir": (0.88, 0.77, 0.6),
    "olive": (0.72, 0.63, 0.44),
    "gold": (1.0, 0.85, 0.5),
    "goldDark": (0.88, 0.75, 0.44),
    "bronze": (0.8, 0.55, 0.35),
    "veil": (0.35, 0.2, 0.45),
    "water": (0.24, 0.42, 0.48),
    "linen": (0.95, 0.92, 0.85),
    "wood": (0.66, 0.52, 0.36),
    "pitch": (0.16, 0.12, 0.09),
    "hideGrey": (0.54, 0.52, 0.5),
    "hideBrown": (0.37, 0.25, 0.19),
    "hideTan": (0.69, 0.54, 0.35),
    "hideWhite": (0.9, 0.87, 0.81),
    "acacia": (0.78, 0.56, 0.38),
    "silver": (0.86, 0.88, 0.91),
    "goatHair": (0.23, 0.2, 0.17),
    "ramSkin": (0.54, 0.17, 0.11),
    "tachash": (0.23, 0.27, 0.31),
    "screen": (0.4, 0.22, 0.42),
    "bread": (0.83, 0.69, 0.48),
    "flame": (1.0, 0.71, 0.28),
    "goldGlass": (1.0, 0.84, 0.45),
    "pearl": (0.96, 0.94, 0.9),
    "glory": (1.0, 0.95, 0.8),
    "river": (0.45, 0.75, 0.95),
    "leaf": (0.16, 0.42, 0.16),
    "fruit": (0.82, 0.32, 0.2),
    "jasper": (0.96, 0.9, 0.77),
}


# materials the app has no PBR set for keep their own look from here:
# (metallic, roughness, alpha, emission strength)
_LOOK = {
    "goldGlass": (0.9, 0.08, 0.2, 0.0),
    "pearl": (0.1, 0.18, 1.0, 0.0),
    "glory": (0.0, 0.5, 1.0, 4.0),
    "river": (0.0, 0.05, 0.85, 0.6),
    "leaf": (0.0, 0.7, 1.0, 0.0),
    "fruit": (0.0, 0.45, 1.0, 0.0),
}
# the twelve foundations, Revelation 21:19–20
GEMS = {
    "gem_jasper": (0.55, 0.72, 0.6),
    "gem_sapphire": (0.08, 0.18, 0.62),
    "gem_chalcedony": (0.62, 0.68, 0.78),
    "gem_emerald": (0.04, 0.52, 0.26),
    "gem_sardonyx": (0.72, 0.36, 0.24),
    "gem_sardius": (0.62, 0.08, 0.07),
    "gem_chrysolite": (0.78, 0.72, 0.18),
    "gem_beryl": (0.3, 0.62, 0.62),
    "gem_topaz": (0.88, 0.6, 0.14),
    "gem_chrysoprasus": (0.42, 0.72, 0.36),
    "gem_jacinth": (0.78, 0.34, 0.1),
    "gem_amethyst": (0.46, 0.2, 0.58),
}


def mat(key):
    if key not in _MATS:
        m = bpy.data.materials.new(key)
        # distinct colours also keep the optimizer from merging same-looking materials
        h = sum(ord(ch) * (i + 1) for i, ch in enumerate(key)) % 97 / 970
        c = GEMS.get(key) or _PREVIEW.get(key, (0.7 + h, 0.7, 0.7 - h))
        m.diffuse_color = (*c, 1)
        if hasattr(m, "use_nodes") and not m.use_nodes:
            m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF") if m.node_tree else None
        look = _LOOK.get(key) or ((0.15, 0.22, 1.0, 0.0) if key in GEMS else None)
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (*c, 1)
            if look:
                metal, rough, alpha, glow = look
                bsdf.inputs["Metallic"].default_value = metal
                bsdf.inputs["Roughness"].default_value = rough
                bsdf.inputs["Alpha"].default_value = alpha
                if glow:
                    bsdf.inputs["Emission Color"].default_value = (*c, 1)
                    bsdf.inputs["Emission Strength"].default_value = glow
                if alpha < 1 and hasattr(m, "surface_render_method"):
                    m.surface_render_method = "BLENDED"
        _MATS[key] = m
    return _MATS[key]


# -------------------------------------------------------------------- parts --


class Part:
    """
    One animated piece of a step: any number of primitives, merged into a
    single mesh. Primitives are placed in app coordinates.
    """

    def __init__(self, name, anim="drop", hero=False, tally=None, uv="world"):
        self.name = name
        self.props = {"anim": anim}
        if hero:
            self.props["hero"] = True
        if tally is not None:
            self.props["tally"] = tally
        self.uv = uv
        self.bm = bmesh.new()
        self.keys = []

    # material slot for a key, added on first use
    def _slot(self, key):
        if key not in self.keys:
            self.keys.append(key)
        return self.keys.index(key)

    def _adopt(self, before, key, bevel=0.0, segments=1, smooth=False):
        """material, shading and optional bevel for faces created since `before`"""
        new_faces = [f for f in self.bm.faces if f not in before]
        slot = self._slot(key)
        for f in new_faces:
            f.material_index = slot
            # round things share vertices; a cylinder's caps stay flat
            f.smooth = smooth is True or (smooth == "sides" and abs(f.normal.z) < 0.9)
        if bevel > 0:
            edges = {e for f in new_faces for e in f.edges}
            bmesh.ops.bevel(
                self.bm,
                geom=list(edges),
                offset=bevel,
                segments=segments,
                profile=0.5,
                affect="EDGES",
                clamp_overlap=True,
            )
            for f in self.bm.faces:
                if f not in before:
                    f.material_index = slot
        self.bm.faces.index_update()

    def _outward(self, before):
        """point new faces outward (closed solids) or consistently (open sheets)"""
        new_faces = [f for f in self.bm.faces if f not in before]
        bmesh.ops.recalc_face_normals(self.bm, faces=new_faces)
        self.bm.normal_update()

    def _mark(self):
        self.bm.faces.ensure_lookup_table()
        return set(self.bm.faces)

    def box(self, key, size, at, rot_y=0.0, bevel=0.0, segments=1, rot_x=0.0):
        before = self._mark()
        w, h, d = size
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=place(*at, rot_y=rot_y, scale=(w, h, d), rot_x=rot_x))
        self._adopt(before, key, bevel, segments)
        return self

    def cyl(self, key, r1, r2, h, at, segs=24, rot_y=0.0, bevel=0.0, matrix=None):
        """vertical frustum centred at `at` (r1 bottom, r2 top)"""
        before = self._mark()
        m = matrix if matrix is not None else place(*at, rot_y=rot_y)
        bmesh.ops.create_cone(
            self.bm,
            cap_ends=True,
            cap_tris=False,
            segments=segs,
            radius1=r1,
            radius2=r2,
            depth=h,
            matrix=m,
        )
        self.bm.normal_update()
        self._adopt(before, key, bevel, smooth="sides" if segs >= 8 else False)
        return self

    def sphere(self, key, r, at, segs=(10, 6), scale=(1, 1, 1)):
        before = self._mark()
        bmesh.ops.create_uvsphere(
            self.bm, u_segments=segs[0], v_segments=segs[1], radius=r, matrix=place(*at, scale=scale)
        )
        self._adopt(before, key, smooth=True)
        return self

    def torus(self, key, R, r, at, rot=(0.0, 0.0, 0.0), segs=(10, 5)):
        """a ring (chain link): R major, r minor; rot is Blender-space XYZ euler"""
        before = self._mark()
        verts = []
        for i in range(segs[0]):
            a = 2 * math.pi * i / segs[0]
            ring = []
            for j in range(segs[1]):
                b = 2 * math.pi * j / segs[1]
                p = Vector(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
                ring.append(p)
            verts.append(ring)
        from mathutils import Euler

        m = Matrix.Translation(V(*at)) @ Euler(rot).to_matrix().to_4x4()
        bv = [[self.bm.verts.new(m @ p) for p in ring] for ring in verts]
        for i in range(segs[0]):
            for j in range(segs[1]):
                a, b = bv[i][j], bv[i][(j + 1) % segs[1]]
                c, d = bv[(i + 1) % segs[0]][(j + 1) % segs[1]], bv[(i + 1) % segs[0]][j]
                self.bm.faces.new((a, b, c, d))
        self._adopt(before, key, smooth=True)
        return self

    def lathe(self, key, profile, at, segs=48, scale=1.0):
        """turn a (radius, height) profile about the vertical through `at`"""
        before = self._mark()
        m = Matrix.Translation(V(*at))
        edge_verts = [self.bm.verts.new(m @ Vector((r * scale, 0, y * scale))) for r, y in profile]
        edges = [self.bm.edges.new((edge_verts[i], edge_verts[i + 1])) for i in range(len(edge_verts) - 1)]
        bmesh.ops.spin(
            self.bm,
            geom=edge_verts + edges,
            cent=V(*at),
            axis=(0, 0, 1),
            angle=2 * math.pi,
            steps=segs,
            use_merge=True,
        )
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts[:], dist=1e-5)
        self._outward(before)
        self._adopt(before, key, smooth=True)
        return self

    def star(self, key, at, r_out, r_in, points, depth, normal="z"):
        """a flat, extruded star — a carved flower — facing along app `normal` (x or z)"""
        x, y, z = at
        n = points * 2
        ring = []
        for i in range(n):
            a = math.pi * i / points
            r = r_out if i % 2 == 0 else r_in
            u, v = math.cos(a) * r, math.sin(a) * r
            ring.append((u, v))
        if normal == "z":
            front = [(x + u, y + v, z + depth / 2) for u, v in ring]
            back = [(x + u, y + v, z - depth / 2) for u, v in ring]
        else:
            front = [(x + depth / 2, y + v, z + u) for u, v in ring]
            back = [(x - depth / 2, y + v, z + u) for u, v in ring]
        faces = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
        faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        return self.mesh(key, front + back, faces)

    def mesh(self, key, verts, faces, smooth=False):
        """raw geometry, verts in app coordinates"""
        before = self._mark()
        bv = [self.bm.verts.new(V(*p)) for p in verts]
        for f in faces:
            self.bm.faces.new([bv[i] for i in f])
        self._outward(before)
        self._adopt(before, key, smooth=smooth)
        return self

    def merge_object(self, key, obj):
        """merge an object's evaluated mesh (modifiers applied), then delete it"""
        dg = bpy.context.evaluated_depsgraph_get()
        ev = obj.evaluated_get(dg)
        me = ev.to_mesh()
        me.transform(obj.matrix_world)
        before = self._mark()
        self.bm.from_mesh(me)
        ev.to_mesh_clear()
        self._adopt(before, key, smooth=True)
        bpy.data.objects.remove(obj, do_unlink=True)
        return self

    # ----------------------------------------------------------------- finish

    def _uvs(self):
        uv = self.bm.loops.layers.uv.verify()
        if self.uv == "fit":
            # one 0..1 square across the part's broadest plane (the veil's weave)
            xs = [v.co for v in self.bm.verts]
            lo = Vector((min(p.x for p in xs), min(p.y for p in xs), min(p.z for p in xs)))
            hi = Vector((max(p.x for p in xs), max(p.y for p in xs), max(p.z for p in xs)))
            span = hi - lo
            axes = sorted(range(3), key=lambda i: -span[i])[:2]
            for f in self.bm.faces:
                for l in f.loops:
                    l[uv].uv = tuple((l.vert.co[a] - lo[a]) / (span[a] or 1) for a in axes)
            return
        for f in self.bm.faces:
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            u, v = [(1, 2), (0, 2), (0, 1)][ax]
            for l in f.loops:
                l[uv].uv = (l.vert.co[u] * UV_SCALE, l.vert.co[v] * UV_SCALE)

    def finish(self, parent):
        self.bm.normal_update()
        self._uvs()
        # origin at the centre of the bounds: pop and grow scale about it sensibly
        lo = Vector((min(v.co.x for v in self.bm.verts), min(v.co.y for v in self.bm.verts), min(v.co.z for v in self.bm.verts)))
        hi = Vector((max(v.co.x for v in self.bm.verts), max(v.co.y for v in self.bm.verts), max(v.co.z for v in self.bm.verts)))
        c = (lo + hi) / 2
        bmesh.ops.translate(self.bm, vec=-c, verts=self.bm.verts[:])
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        for key in self.keys:
            me.materials.append(mat(key))
        obj = bpy.data.objects.new(self.name, me)
        obj.location = c
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = parent
        for k, v in self.props.items():
            obj[k] = v
        return obj


class Step:
    """an empty grouping one build step's parts, in order"""

    def __init__(self, step_id, anchor=None):
        self.id = step_id
        self.empty = bpy.data.objects.new(f"step_{step_id}", None)
        bpy.context.scene.collection.objects.link(self.empty)
        if anchor is not None:
            self.empty["anchor"] = list(anchor)
        self.n = 0

    def part(self, name, **kw):
        self.n += 1
        return _StepPart(self, f"{self.id}_{self.n:03d}_{name}", **kw)


class _StepPart(Part):
    def __init__(self, step, name, **kw):
        super().__init__(name, **kw)
        self.step = step

    def done(self):
        return self.finish(self.step.empty)


# ------------------------------------------------------------------- export --


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_extras=True,
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
    )
    print(f"exported {path}")


def out_path():
    """the path after `--` on Blender's command line"""
    argv = sys.argv
    return argv[argv.index("--") + 1] if "--" in argv else "/tmp/model.glb"


# ---------------------------------------------------------------- organics --


def skin_object(name, verts, edges, radii, subsurf=2):
    """
    A soft, organic form from a stick skeleton (app coordinates): each vertex
    gets an (x, y) skin radius. Used for the cherubim and the oxen.
    """
    me = bpy.data.meshes.new(name)
    me.from_pydata([V(*p) for p in verts], edges, [])
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    sk = obj.modifiers.new("skin", "SKIN")
    sk.use_smooth_shade = True
    layer = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        layer[i].radius = r if isinstance(r, (tuple, list)) else (r, r)
    layer[0].use_root = True
    if subsurf:
        ss = obj.modifiers.new("smooth", "SUBSURF")
        ss.levels = subsurf
    return obj


# ------------------------------------------------------------------ masonry --


def _cuts(a0, a1, offset, block):
    """block joints along a course, with no sliver shorter than a third of a block"""
    pts = [a0]
    x = a0 + (offset or block)
    while x < a1 - block / 3:
        pts.append(x)
        x += block
    pts.append(a1)
    return pts


def _minus(segments, lo, hi):
    out = []
    for a, b in segments:
        if b <= lo or a >= hi:
            out.append((a, b))
            continue
        if a < lo:
            out.append((a, lo))
        if b > hi:
            out.append((hi, b))
    return out


def ashlar(part, key, axis, a0, a1, y0, y1, c, thick, course=1.5, block=3.0, openings=(), bevel=0.07, key_alt=None):
    """
    A wall of dressed stone, course by course with staggered joints.
    `axis` is the direction it runs ("x" or "z"), `c` the centre of its
    thickness on the other axis. `openings` are (a0, a1, y0, y1) holes —
    doors and windows — that the blocks stop short of.
    """
    i = 0
    y = y0
    while y < y1 - 1e-6:
        h = min(course, y1 - y)
        segs = list(zip(_cuts(a0, a1, (i % 2) * block / 2, block)[:-1], _cuts(a0, a1, (i % 2) * block / 2, block)[1:]))
        for oa0, oa1, oy0, oy1 in openings:
            if y < oy1 - 1e-6 and y + h > oy0 + 1e-6:
                segs = _minus(segs, oa0, oa1)
        for j, (a, b) in enumerate(segs):
            if b - a < 0.05:
                continue
            k = key_alt if key_alt and (i + j) % 5 == 0 else key
            mid = (a + b) / 2
            gap = 0.04
            if axis == "x":
                part.box(k, (b - a - gap, h - gap, thick), (mid, y + h / 2, c), bevel=bevel)
            else:
                part.box(k, (thick, h - gap, b - a - gap), (c, y + h / 2, mid), bevel=bevel)
        y += h
        i += 1


def rod(part, key, p0, p1, r, segs=6):
    """a thin cylinder from p0 to p1 (app coordinates): nets, chains, spokes"""
    a, b = V(*p0), V(*p1)
    d = b - a
    if d.length < 1e-6:
        return part
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    m = Matrix.Translation((a + b) / 2) @ rot
    return part.cyl(key, r, r, d.length, None, segs=segs, matrix=m)


# ----------------------------------------------------------------- feathers --


def feather(p, key, top, length, width, lean, broad="z"):
    """
    A tapered, slightly thick feather hanging from `top` (app coordinates),
    broad along `broad` ("z" or "x") and leaning `lean` along it.
    """
    x, y, z = top
    th = max(0.012, min(0.07, width * 0.16))
    rings = [(0.0, width * 0.5), (0.55, width * 0.5), (0.92, width * 0.28), (1.0, width * 0.06)]
    verts = []
    for u, hw in rings:
        cy = y - length * u
        shift = lean * u
        for a, b in ((-th, -hw), (-th, hw), (th, hw), (th, -hw)):
            if broad == "z":
                verts.append((x + a, cy, z + shift + b))
            else:
                verts.append((x + shift + b, cy, z + a))
    faces = [(3, 2, 1, 0)]
    for k in range(len(rings) - 1):
        o = 4 * k
        for i in range(4):
            j = (i + 1) % 4
            faces.append((o + i, o + j, o + 4 + j, o + 4 + i))
    last = 4 * (len(rings) - 1)
    faces.append((last, last + 1, last + 2, last + 3))
    p.mesh(key, verts, faces)


def arc_wing(p, pts, broad, outward, flight=(1.6, 1.6), covert=(0.75, 0.3), width=0.42, edge=0.16, keys=("gold", "goldDark")):
    """
    A wing along `pts` (its leading edge, app coordinates, root first):
    a rounded edge, coverts in front, flight feathers that lengthen toward the
    tip. `outward` (+1/−1) is which way along `broad` the feathers fan.
    """
    n = len(pts) - 1
    for i, (a, c) in enumerate(zip(pts, pts[1:])):
        rod(p, keys[0], a, c, edge * (1 - 0.4 * i / n), segs=8)
    for i in range(1, n + 1):
        u = i / n
        x, y, z = pts[i]
        fl = flight[0] + flight[1] * u * u
        cv = covert[0] + covert[1] * u
        off = width * 0.3
        if broad == "z":
            feather(p, keys[0], (x + off * 0.4, y, z), fl, width, outward * 0.25 * u * width / 0.42, "z")
            feather(p, keys[1], (x - off * 0.3, y + edge * 0.3, z), cv, width * 0.86, outward * 0.08 * width / 0.42, "z")
        else:
            feather(p, keys[0], (x, y, z + off * 0.4), fl, width, outward * 0.25 * u * width / 0.42, "x")
            feather(p, keys[1], (x, y + edge * 0.3, z - off * 0.3), cv, width * 0.86, outward * 0.08 * width / 0.42, "x")


# -------------------------------------------------------------------- cloth --


def cloth(part, key, rows, thick=0.05):
    """
    A hanging or draped fabric from a grid of points (`rows`: lists of app
    coordinates), given a little thickness so it shows from both sides.
    """
    nr, nc = len(rows), len(rows[0])
    me = bpy.data.meshes.new("cloth")
    verts = [V(*p) for row in rows for p in row]
    faces = [(r * nc + c, r * nc + c + 1, (r + 1) * nc + c + 1, (r + 1) * nc + c) for r in range(nr - 1) for c in range(nc - 1)]
    me.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new("cloth", me)
    bpy.context.scene.collection.objects.link(obj)
    for poly in me.polygons:
        poly.use_smooth = True
    sol = obj.modifiers.new("thick", "SOLIDIFY")
    sol.thickness = thick
    sol.offset = 0
    return part.merge_object(key, obj)


def hanging(part, key, a, b, y0, y1, folds=0.12, per=1.4, axis="x", c=0.0, step=0.5):
    """a curtain between a and b along `axis`, at `c` across it, rippled in folds"""
    rows = []
    n = max(2, int(abs(b - a) / step))
    m = max(2, int((y1 - y0) / 1.0))
    for r in range(m + 1):
        yy = y0 + (y1 - y0) * r / m
        row = []
        for i in range(n + 1):
            t = a + (b - a) * i / n
            off = folds * math.sin(t * math.pi * 2 / per)
            row.append((t, yy, c + off) if axis == "x" else (c + off, yy, t))
        rows.append(row)
    return cloth(part, key, rows)


# -------------------------------------------------------------------- beasts --


def beast(x, y, z, yaw, length=2.4, leg=0.9, girth=0.5, neck=0.0, head=0.25, horns=0.0, trunk=0.0, hump=0.0, tail=0.5):
    """
    A quadruped from a stick skeleton (skin modifier), facing local +x,
    placed at (x, y, z) and turned by `yaw`. Proportions, not anatomy.
    Returns (verts, edges, radii) for `skin_object`.
    """
    c, s_ = math.cos(yaw), math.sin(yaw)

    def P(lx, ly, lz):
        return (x + lx * c + lz * s_, y + ly, z - lx * s_ + lz * c)

    hl = length / 2
    back = leg + girth * 0.95  # legs reach the belly
    w = girth * 0.55
    pts = [P(-hl * 0.7, back, 0), P(0, back + hump * 0.4, 0), P(hl * 0.7, back + 0.05, 0)]
    edges = [(0, 1), (1, 2)]
    radii = [(girth * 0.8, girth), (girth * 0.85, girth * 1.05 + hump * 0.3), (girth * 0.85, girth)]

    def add(pt, r, parent):
        pts.append(P(*pt))
        radii.append(r if isinstance(r, tuple) else (r, r))
        edges.append((parent, len(pts) - 1))
        return len(pts) - 1

    lr = max(0.06, girth * 0.24)
    for lx, root in ((-hl * 0.72, 0), (hl * 0.72, 2)):
        for lz in (-w * 0.6, w * 0.6):
            k = add((lx, leg * 0.5, lz), lr, root)
            add((lx + 0.02, 0.02, lz), lr * 0.75, k)
    # neck and head
    nx = hl * 0.9 + neck * 0.35
    ny = back + 0.15 + neck * 0.9
    n = add((nx, ny, 0), girth * 0.45, 2)
    hd = add((nx + head * 1.4, ny - head * 0.4, 0), head, n)
    add((nx + head * 2.6, ny - head * 1.0, 0), head * 0.6, hd)
    if horns:
        for lz in (-1, 1):
            hb = add((nx + head * 0.9, ny + head * 0.6, lz * head * 0.9), head * 0.25, hd)
            add((nx + head * 1.2, ny + head * 0.6 + horns, lz * (head * 0.9 + horns * 0.6)), head * 0.12, hb)
    if trunk:
        t1 = add((nx + head * 2.2, ny - head * 1.6, 0), head * 0.35, hd)
        add((nx + head * 2.4, ny - head * 1.6 - trunk, 0), head * 0.2, t1)
    if tail:
        t1 = add((-hl * 0.95, back - 0.1, 0), 0.05, 0)
        add((-hl * 1.05, back - tail, 0), 0.04, t1)
    return pts, edges, radii
