"""
The diorama map's Blender side (run by scripts/build-diorama.py):

    blender -b --factory-startup -P blender/diorama.py -- <work dir> <tile>.json ...

For each render tile it sculpts the land from the tile's heights (already in
model kilometres, exaggerated), paints it with the tile's base colour, lights
it like a relief model on a table — a low sun from the north-west, soft, with
the sky's light filling the shadows — and renders it from straight above with
Cycles. The render, with its real cast shadows and occlusion, is the texture
the app drapes over the land.

For each chunk's whole tile (level 1) it also builds the chunk's web mesh: a
grid over the chunk decimated where the land is plain, its borders kept exact
so neighbouring chunks meet without a crack. Exported as <work>/mesh/<chunk>.glb.
"""

import json
import math
import os
import sys
import time

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
WORK = argv[0]
TILES = argv[1:]

#: the sun: from the north-west, as relief maps are lit, fairly low for long shadows
SUN_AZIMUTH = 315.0
SUN_ELEVATION = 34.0
SUN_SOFTNESS = 3.5  # degrees: the sun's apparent size, how soft the shadow edges are
SAMPLES = 24
#: the web mesh: grid spacing over the chunk, and how many triangles to keep
WEB_GRID = {1: 4, 2: 2}  # 1 vertex per this many render pixels
WEB_TRIS = {1: 50000, 2: 120000}


def bilinear(a, gx, gy):
    """a sampled at fractional columns gx and rows gy (a grid of them), bilinearly"""
    x0 = np.clip(np.floor(gx).astype(int), 0, a.shape[1] - 2)
    y0 = np.clip(np.floor(gy).astype(int), 0, a.shape[0] - 2)
    tx = np.clip(gx - x0, 0, 1)[None, :]
    ty = np.clip(gy - y0, 0, 1)[:, None]
    a00 = a[y0][:, x0]
    a01 = a[y0][:, x0 + 1]
    a10 = a[y0 + 1][:, x0]
    a11 = a[y0 + 1][:, x0 + 1]
    return ((a00 * (1 - tx) + a01 * tx) * (1 - ty) + (a10 * (1 - tx) + a11 * tx) * ty).astype(np.float32)


def setup_cycles():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = True
                scene.cycles.device = "GPU"
                print(f"cycles on {kind}", flush=True)
                break
        except TypeError:
            continue
    scene.cycles.samples = SAMPLES
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 3
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 1
    scene.cycles.transmission_bounces = 0
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100


def clear():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
        for b in list(coll):
            coll.remove(b)


def grid_mesh(name, heights, width_km, height_km, x0=0.0, y0=0.0, uv=None):
    """a quad grid over width x height km, centred on (x0, y0), z from heights (rows run north to south)"""
    H, W = heights.shape
    xs = x0 - width_km / 2 + (np.arange(W) + 0.5) / W * width_km if uv is None else x0 + uv[0]
    ys = y0 + height_km / 2 - (np.arange(H) + 0.5) / H * height_km if uv is None else y0 + uv[1]
    X, Y = np.meshgrid(xs, ys)
    co = np.stack([X, Y, heights], -1).reshape(-1, 3).astype(np.float32)
    i = np.arange(H - 1)[:, None] * W + np.arange(W - 1)[None, :]
    quads = np.stack([i + W, i + W + 1, i + 1, i], -1).reshape(-1, 4)  # counter-clockwise seen from above
    mesh = bpy.data.meshes.new(name)
    mesh.vertices.add(len(co))
    mesh.vertices.foreach_set("co", co.ravel())
    mesh.loops.add(quads.size)
    mesh.loops.foreach_set("vertex_index", quads.ravel().astype(np.int32))
    mesh.polygons.add(len(quads))
    mesh.polygons.foreach_set("loop_start", (np.arange(len(quads)) * 4).astype(np.int32))
    mesh.polygons.foreach_set("loop_total", np.full(len(quads), 4, np.int32))
    # texture space: the grid spans the image edge to edge (pixel centres)
    u = (np.arange(W) + 0.5) / W
    v = 1 - (np.arange(H) + 0.5) / H
    U, V = np.meshgrid(u, v)
    uvs = np.stack([U, V], -1).reshape(-1, 2)[quads.ravel()]
    layer = mesh.uv_layers.new(name="UVMap")
    layer.data.foreach_set("uv", uvs.astype(np.float32).ravel())
    mesh.update(calc_edges=True)
    mesh.shade_smooth()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def land_material(colour_path):
    mat = bpy.data.materials.new("land")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes["Principled BSDF"]
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(colour_path)
    tex.image.colorspace_settings.name = "sRGB"
    tex.interpolation = "Linear"
    tex.extension = "EXTEND"
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.92
    bsdf.inputs["Specular IOR Level"].default_value = 0.15
    return mat


def light_scene():
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 2.9
    sun.angle = math.radians(SUN_SOFTNESS)
    sun.color = (1.0, 0.96, 0.9)
    obj = bpy.data.objects.new("sun", sun)
    bpy.context.scene.collection.objects.link(obj)
    az = math.radians(SUN_AZIMUTH)
    el = math.radians(SUN_ELEVATION)
    to_sun = Vector((math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el)))
    obj.rotation_euler = (-to_sun).to_track_quat("-Z", "Y").to_euler()
    world = bpy.data.worlds.new("sky")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.62, 0.7, 0.85, 1)
    # enough sky that slopes turned from the sun stay legible, as on a model under a window
    bg.inputs["Strength"].default_value = 0.72
    bpy.context.scene.world = world


def camera(width_km, height_km, px, py):
    cam = bpy.data.cameras.new("top")
    cam.type = "ORTHO"
    cam.sensor_fit = "VERTICAL" if py >= px else "HORIZONTAL"
    cam.ortho_scale = height_km if py >= px else width_km
    cam.clip_start = 1
    cam.clip_end = 2000
    obj = bpy.data.objects.new("top", cam)
    obj.location = (0, 0, 500)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    s = bpy.context.scene.render
    s.resolution_x, s.resolution_y = px, py


def render_tile(meta):
    t0 = time.time()
    tid = meta["id"]
    out = os.path.join(WORK, "render", f"{tid}.png")
    if os.path.exists(out):
        return
    os.makedirs(os.path.dirname(out), exist_ok=True)
    clear()
    heights = np.load(os.path.join(WORK, f"{tid}.height.npy"))
    # a vertex per 2x2 pixels (the colour stays full size): a quarter of the vertices, the same shapes
    H2, W2 = heights.shape[0] // 2 * 2, heights.shape[1] // 2 * 2
    pooled = heights[:H2, :W2].reshape(H2 // 2, 2, W2 // 2, 2).mean(axis=(1, 3))
    w, s, e, n = meta["outer"]
    kx, ky = meta["kmPerDeg"]
    ow, oh = (e - w) * kx * W2 / heights.shape[1], (n - s) * ky * H2 / heights.shape[0]
    t1 = time.time()
    land = grid_mesh("land", pooled, ow, oh)
    # the pooled grid may have dropped an odd last row or column: keep it centred where it was
    land.location = (-(e - w) * kx * (heights.shape[1] - W2) / heights.shape[1] / 2, (n - s) * ky * (heights.shape[0] - H2) / heights.shape[0] / 2, 0)
    land.data.materials.append(land_material(os.path.join(WORK, f"{tid}.colour.png")))
    light_scene()
    pw, ph = meta["render"]
    iw, is_, ie, in_ = meta["box"]
    camera((ie - iw) * kx, (in_ - is_) * ky, pw, ph)
    bpy.context.scene.render.filepath = out
    t2 = time.time()
    bpy.ops.render.render(write_still=True)
    print(f"rendered {tid} in {time.time() - t0:.0f}s (mesh {t2 - t1:.0f}s, render {time.time() - t2:.0f}s)", flush=True)


def web_mesh(meta):
    """the chunk's mesh for the app: its own grid, decimated inside, its border left exact"""
    tid = meta["id"]
    out = os.path.join(WORK, "mesh", f"{tid}.glb")
    if meta["level"] != 1 or os.path.exists(out):
        return
    os.makedirs(os.path.dirname(out), exist_ok=True)
    clear()
    c, r = meta["chunk"]
    level = 2 if meta.get("fine") else 1
    heights = np.load(os.path.join(WORK, f"{tid}.height.npy"))
    mx, my = meta["margin"]
    pw, ph = meta["render"]
    step = WEB_GRID[level]
    # vertices on the chunk's own edges (inclusive), so a neighbour's border lands on the same points
    nx = pw // step + 1
    ny = ph // step + 1
    gx = mx - 0.5 + np.linspace(0, pw, nx)
    gy = my - 0.5 + np.linspace(0, ph, ny)
    hs = bilinear(heights, gx, gy)
    iw, is_, ie, in_ = meta["box"]
    kx, ky = meta["kmPerDeg"]
    cw, ch = (ie - iw) * kx, (in_ - is_) * ky
    # placed in the map's frame: kilometres from the map's centre, north up
    mw, ms, me, mn = meta["map"]
    cx = ((iw + ie) / 2 - (mw + me) / 2) * kx
    cy = ((is_ + in_) / 2 - (ms + mn) / 2) * ky
    xs = np.linspace(-cw / 2, cw / 2, nx)
    ys = np.linspace(ch / 2, -ch / 2, ny)
    obj = grid_mesh(f"chunk_{tid}", hs, cw, ch, cx, cy, uv=(xs, ys))
    # its UVs span the chunk exactly (the grid's own linspace, not pixel centres)
    U, V = np.meshgrid(np.linspace(0, 1, nx), np.linspace(1, 0, ny))
    uv_v = np.stack([U, V], -1).reshape(-1, 2)
    loops = np.zeros(len(obj.data.loops), np.int32)
    obj.data.loops.foreach_get("vertex_index", loops)
    obj.data.uv_layers[0].data.foreach_set("uv", uv_v[loops].astype(np.float32).ravel())
    # the border may not move: only the interior is decimated
    vg = obj.vertex_groups.new(name="interior")
    border = np.zeros((ny, nx), bool)
    border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
    vg.add([int(i) for i in np.flatnonzero(~border.ravel())], 1.0, "REPLACE")
    tris = 2 * (nx - 1) * (ny - 1)
    mod = obj.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = min(1.0, WEB_TRIS[level] / tris)
    mod.vertex_group = "interior"
    mod.vertex_group_factor = 1000.0
    mod.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier="decimate")
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format="GLB",
        use_selection=True,
        export_materials="NONE",
        export_yup=True,
        export_normals=True,
        export_apply=True,
    )
    print(f"meshed {tid}: {len(obj.data.polygons)} triangles", flush=True)


if __name__ == "__main__":
    setup_cycles()
    for name in TILES:
        with open(os.path.join(WORK, name)) as f:
            meta = json.load(f)
        render_tile(meta)
        web_mesh(meta)
