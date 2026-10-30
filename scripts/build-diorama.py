"""
Builds the diorama map of the biblical world: a relief model of the land from
Egypt to Persia, rendered in Blender and staged in three.js.

    python3 scripts/build-diorama.py            (npm run build:diorama)
    python3 scripts/build-diorama.py data       just the source rasters
    python3 scripts/build-diorama.py render     just Blender's renders and meshes
    python3 scripts/build-diorama.py pack       just the web files

The steps:

  data    For every render tile, elevation (AWS Terrarium) and a painted base
          colour: the land's own hue from Sentinel-2 cloudless 2016 (EOX, CC BY
          4.0), softened so no modern field or town shows; the sea by its
          depth, from turquoise shallows to deep blue; lakes, rivers and snow.
          Into data/raw/diorama/work/.
  render  Blender (blender/diorama.py) sculpts each tile from its heights,
          lights it with a low north-west sun and renders it from straight
          above with Cycles: shaded relief with real cast shadows. It also
          builds the web mesh of each chunk, decimated to keep its shape.
  pack    The renders become the chunks' textures (WebP), plus a whole-map
          preview, a heightmap for the app, and meta.json, into
          public/diorama/.

The map is 8 x 4 chunks over 10-56 E, 22-44 N. Each is textured at 2048 px; the
six around the Levant (the Nile to the Euphrates) again at 4096, from finer
elevation. Units are kilometres: x east, y up, z south, heights exaggerated.

Needs numpy, scipy, Pillow and requests; Blender (BLENDER= to override).
Downloads are cached in data/raw/diorama/.
"""

import json
import math
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import requests
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW = os.path.join(ROOT, "data", "raw", "diorama")
OLD = os.path.join(ROOT, "data", "raw", "relief")  # the painted relief's downloads, reused
WORK = os.path.join(RAW, "work")
OUT = os.path.join(ROOT, "public", "diorama")
BLENDER = os.environ.get("BLENDER", "/Applications/Blender.app/Contents/MacOS/Blender")

WEST, EAST, SOUTH, NORTH = 10.0, 56.0, 22.0, 44.0
COLS, ROWS = 8, 4
CW = (EAST - WEST) / COLS  # 5.75 deg
CH = (NORTH - SOUTH) / ROWS  # 5.5 deg
#: chunks textured again at 4096: the Nile delta, Sinai, the Levant, Syria and Mesopotamia
FINE = {(c, r) for c in (3, 4, 5) for r in (1, 2)}
REF_LAT = 33.0
KM_LAT = 111.32
KM_LNG = KM_LAT * math.cos(math.radians(REF_LAT))
#: the land drawn this many times taller than life; the seabed less, or the seas would be canyons
VERTICAL = 7.0
#: and the highest ground eased down, as relief models do, so hills stay bold and peaks don't spike:
#: heights go through H * asinh(h / H) (750 m loses 2%; Ararat's 5137 m becomes ~3350)
PEAK_EASE = 2000.0
SEA_VERTICAL = 2.5
SEA_FLOOR = -3000.0
#: shadows and occlusion reach in from beyond a tile's edge
MARGIN = 0.3
VERSION = 1
#: bump when the painting or the model heights change, and the tiles are redone from the cache
PAINT = 6

TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
CLOUDLESS = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg"

session = requests.Session()


# ------------------------------------------------------------------ tiles


def tile_xy(lng, lat, z):
    n = 2**z
    la = math.radians(max(-85.05, min(85.05, lat)))
    return (lng + 180) / 360 * n, (1 - math.log(math.tan(la) + 1 / math.cos(la)) / math.pi) / 2 * n


def fetch(kind, z, x, y):
    """a cached tile, as an array (heights in metres, or RGB)"""
    if kind == "dem":
        old = os.path.join(OLD, f"t{z}_{x}_{y}.png")
        path = old if os.path.exists(old) else os.path.join(RAW, "dem", f"{z}_{x}_{y}.png")
        url = TERRARIUM.format(z=z, x=x, y=y)
    else:
        path = os.path.join(RAW, "s2", f"{z}_{x}_{y}.jpg")
        url = CLOUDLESS.format(z=z, x=x, y=y)
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        for attempt in range(6):
            try:
                r = session.get(url, timeout=60)
                r.raise_for_status()
                break
            except Exception:
                if attempt == 5:
                    raise
        with open(path, "wb") as f:
            f.write(r.content)
    img = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    if kind == "dem":
        return img[..., 0] * 256 + img[..., 1] + img[..., 2] / 256 - 32768
    return img


def mosaic(kind, z, west, south, east, north):
    """the tiles over a box, stitched, and where its corner falls in global tile pixels"""
    x0, y0 = tile_xy(west, north, z)
    x1, y1 = tile_xy(east, south, z)
    xs = range(int(x0), int(x1) + 1)
    ys = range(int(y0), int(y1) + 1)
    with ThreadPoolExecutor(16) as pool:
        tiles = dict(zip([(x, y) for y in ys for x in xs], pool.map(lambda xy: fetch(kind, z, *xy), [(x, y) for y in ys for x in xs])))
    chans = 1 if kind == "dem" else 3
    m = np.zeros((len(ys) * 256, len(xs) * 256) + (() if chans == 1 else (3,)), np.float32)
    for (x, y), t in tiles.items():
        m[(y - ys[0]) * 256 : (y - ys[0] + 1) * 256, (x - xs[0]) * 256 : (x - xs[0] + 1) * 256] = t
    return m, xs[0] * 256, ys[0] * 256


def resample(kind, z, west, south, east, north, w, h):
    """a box onto a lng/lat grid of w x h pixels (pixel centres), bilinear"""
    m, ox, oy = mosaic(kind, z, west, south, east, north)
    lng = west + (np.arange(w) + 0.5) / w * (east - west)
    lat = north - (np.arange(h) + 0.5) / h * (north - south)
    n = 2**z * 256
    gx = (lng + 180) / 360 * n - ox - 0.5
    la = np.radians(lat)
    gy = (1 - np.log(np.tan(la) + 1 / np.cos(la)) / math.pi) / 2 * n - oy - 0.5
    X, Y = np.meshgrid(gx, gy)
    if m.ndim == 2:
        return ndimage.map_coordinates(m, [Y, X], order=1, mode="nearest").astype(np.float32)
    return np.stack([ndimage.map_coordinates(m[..., c], [Y, X], order=1, mode="nearest") for c in range(3)], -1)


# ------------------------------------------------------------- vectors


def geojson(name):
    with open(os.path.join(OLD, name)) as f:
        return json.load(f)["features"]


LAND = LAKES = RIVERS = None


def vectors():
    global LAND, LAKES, RIVERS
    if LAND is None:
        LAND = geojson("ne_10m_land.geojson")
        LAKES = geojson("ne_10m_lakes.geojson")
        RIVERS = geojson("ne_10m_rivers.geojson")


def polys(features):
    for f in features:
        g = f["geometry"]
        if not g:
            continue
        for p in g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]:
            yield f["properties"], p


def lines(features):
    for f in features:
        g = f["geometry"]
        if not g:
            continue
        for ln in g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]:
            yield f["properties"], ln


def raster(box, w, h, scale=2):
    """land / lake masks and river lines on the grid, drawn at `scale`x and averaged down (soft edges)"""
    vectors()
    west, south, east, north = box
    W, H = w * scale, h * scale
    px = lambda pts: [((x - west) / (east - west) * W, (north - y) / (north - south) * H) for x, y in pts]  # noqa: E731
    land = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(land)
    for _, p in polys(LAND):
        d.polygon(px(p[0]), fill=255)
        for hole in p[1:]:
            d.polygon(px(hole), fill=0)
    lake = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(lake)
    for props, p in polys(LAKES):
        if (props.get("scalerank") or 9) <= 9:
            d.polygon(px(p[0]), fill=255)
    river = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(river)
    km_px = (east - west) * KM_LNG / W
    for props, ln in lines(RIVERS):
        rank = props.get("scalerank") or 10
        if rank > 8 or props.get("featurecla") not in ("River", "Lake Centerline"):
            continue
        # great rivers ~1.2 km on the map, streams a few hundred metres, never under a pixel
        width = max(1, round((1.4 - rank * 0.13) / km_px))
        d.line(px(ln), fill=255, width=width, joint="curve")
    down = lambda im: np.asarray(im.resize((w, h), Image.BILINEAR), np.float32) / 255  # noqa: E731
    return down(land), down(lake), down(river)


# -------------------------------------------------------------- paint


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (np.asarray(b, np.float32) - a) * t[..., None]


def paint(heights, sat, land, lake, river, lat, px_km):
    """the base colour of the model: land in its own hues, painted soft; the sea by depth"""
    # the satellite's hue, softened past the scale of any field or town
    sigma = max(0.6, 0.8 / px_km)
    soft = np.stack([ndimage.gaussian_filter(sat[..., c], sigma) for c in range(3)], -1) / 255
    # a little richer and warmer, like a painted model rather than a photograph
    lum = soft @ np.array([0.3, 0.59, 0.11], np.float32)
    col = lum[..., None] + (soft - lum[..., None]) * 1.12
    col = col * np.array([1.03, 1.0, 0.95], np.float32)
    # bright desert held back a little, so its relief still shows under the sun
    col = np.clip(col, 0, 1) * (1 - 0.18 * smoothstep(0.45, 0.85, lum))[..., None]
    # bare high rock goes grey-brown, and snow where the mountains carry it
    h = heights
    rock = smoothstep(1800, 3400, h)
    col = lerp(col, [0.55, 0.5, 0.45], rock * 0.35)
    snowline = 3800 + (39 - lat[:, None]) * 120
    col = lerp(col, [0.95, 0.96, 0.98], smoothstep(snowline - 300, snowline + 200, h) * 0.9)
    # rivers and the green that follows them
    green = ndimage.gaussian_filter(river, max(1.0, 1.2 / px_km))
    col = lerp(col, [0.33, 0.42, 0.22], np.clip(green * 1.5, 0, 1) * 0.35)
    col = lerp(col, [0.2, 0.36, 0.42], river * 0.9)
    # the sea by its depth: turquoise shallows, then blues to the abyss
    depth = np.clip(-h, 0, None)
    sea = np.zeros_like(col)
    sea[:] = [0.42, 0.72, 0.68]
    sea = lerp(sea, [0.17, 0.46, 0.58], smoothstep(5, 120, depth))
    sea = lerp(sea, [0.08, 0.22, 0.38], smoothstep(120, 1400, depth))
    sea = lerp(sea, [0.05, 0.13, 0.27], smoothstep(1400, 3500, depth))
    col = lerp(col, sea, 1 - land)
    lakes = np.zeros_like(col)
    lakes[:] = [0.13, 0.35, 0.42]
    col = lerp(col, lakes, lake)
    return np.clip(col, 0, 1)


def fill_seabed(fine, coarse, land, px_km):
    """the fine elevation's sea floor has holes, whole tiles left flat (0 m in the Adriatic, -28 m in
    the Caspian); zoom 6 has it whole. Near the coasts keep the fine floor (shelves, canyons), out at
    sea and wherever a hole is take the whole one, blended so no seam shows"""
    sea = land < 0.5
    k = 9
    mean = ndimage.uniform_filter(fine, k)
    var = ndimage.uniform_filter(fine * fine, k) - mean * mean
    hole = ndimage.binary_opening(sea & (var < 0.25) & (fine > -60), iterations=4)
    hole = ndimage.binary_dilation(hole, iterations=10)
    shore_km = ndimage.distance_transform_edt(sea) * px_km
    w = np.maximum(ndimage.gaussian_filter(hole.astype(np.float32), 8), smoothstep(12, 45, shore_km))
    out = fine * (1 - w) + np.minimum(coarse, -1) * w
    return np.where(sea, out, fine).astype(np.float32)


def surface(heights, land, lake):
    """model heights, km: the land exaggerated; the sea floor less, and no deeper than the floor"""
    sea = (1 - land) > 0.5
    h = heights.copy()
    # inside the coast nothing dips below the water but true depressions (the Dead Sea's, the Caspian's)
    h = np.where(~sea & (h < 0) & (lake < 0.5) & ~depression(heights, land), 0.0, h)
    eased = np.where(h > 0, PEAK_EASE * np.arcsinh(np.maximum(h, 0) / PEAK_EASE), h)
    land_km = np.maximum(eased, -450) * VERTICAL / 1000
    sea_km = np.minimum(-np.clip(-h, 3, -SEA_FLOOR), 0) * SEA_VERTICAL / 1000 - 0.02
    return np.where(sea, sea_km, land_km).astype(np.float32)


def depression(heights, land):
    """land below sea level far enough from any sea to be a real basin, not noise at the shore"""
    near_sea = ndimage.binary_dilation(land < 0.5, iterations=6)
    return (heights < -5) & ~near_sea


# ------------------------------------------------------------ the grid


def chunk_box(c, r):
    return (WEST + c * CW, NORTH - (r + 1) * CH, WEST + (c + 1) * CW, NORTH - r * CH)


def render_tiles():
    """every render: the chunks at 2048, and the fine chunks again as four 2048 quarters"""
    out = []
    for r in range(ROWS):
        for c in range(COLS):
            out.append(dict(id=f"c{c}r{r}", chunk=[c, r], level=1, box=chunk_box(c, r), px=2048, dem=9, s2=8))
    for c, r in sorted(FINE):
        w, s, e, n = chunk_box(c, r)
        for qy in range(2):
            for qx in range(2):
                box = (w + qx * CW / 2, n - (qy + 1) * CH / 2, w + (qx + 1) * CW / 2, n - qy * CH / 2)
                out.append(dict(id=f"c{c}r{r}q{qx}{qy}", chunk=[c, r], quarter=[qx, qy], level=2, box=box, px=2048, dem=10, s2=9))
    return out


def km_size(box):
    w, s, e, n = box
    return (e - w) * KM_LNG, (n - s) * KM_LAT


def step_data(only=None):
    os.makedirs(WORK, exist_ok=True)
    tiles = [t for t in render_tiles() if not only or t["id"] == only or (only.endswith("*") and t["id"].startswith(only[:-1]))]
    for i, t in enumerate(tiles):
        done = os.path.join(WORK, f"{t['id']}.json")
        if os.path.exists(done):
            with open(done) as f:
                if json.load(f).get("paint") == PAINT:
                    continue
        w, s, e, n = t["box"]
        # the grid: the render's pixels in lng, as many in lat as keep them about square on the ground
        wk, hk = km_size(t["box"])
        pw = t["px"]
        ph = round(pw * hk / wk)
        dx = (e - w) / pw
        dy = (n - s) / ph
        mx = round(MARGIN / dx)
        my = round(MARGIN / dy)
        box = (w - mx * dx, s - my * dy, e + mx * dx, n + my * dy)
        W, H = pw + 2 * mx, ph + 2 * my
        print(f"  [{i + 1}/{len(tiles)}] {t['id']}: {W}x{H}", flush=True)
        heights = resample("dem", t["dem"], *box, W, H)
        sat = resample("s2", t["s2"], *box, W, H)
        land, lake, river = raster(box, W, H)
        px_km = (box[2] - box[0]) * KM_LNG / W
        heights = fill_seabed(heights, resample("dem", 6, *box, W, H), land, px_km)
        lat = box[3] - (np.arange(H) + 0.5) / H * (box[3] - box[1])
        px_km = (box[2] - box[0]) * KM_LNG / W
        colour = paint(heights, sat, land, lake, river, lat, px_km)
        model = surface(heights, land, lake)
        Image.fromarray((colour * 255 + 0.5).astype(np.uint8)).save(os.path.join(WORK, f"{t['id']}.colour.png"))
        np.save(os.path.join(WORK, f"{t['id']}.height.npy"), model)
        np.save(os.path.join(WORK, f"{t['id']}.land.npy"), (land > 0.5).astype(np.uint8))
        meta = dict(t, grid=[W, H], margin=[mx, my], outer=box, render=[pw, ph], kmPerDeg=[KM_LNG, KM_LAT], paint=PAINT)
        # a repainted tile is rendered and meshed again
        for old in (os.path.join(WORK, "render", f"{t['id']}.png"), os.path.join(WORK, "mesh", f"{t['id']}.glb")):
            if os.path.exists(old):
                os.remove(old)
        with open(done, "w") as f:
            json.dump(meta, f)


# ------------------------------------------------------------- blender


def step_render(only=None):
    manifest = sorted(f for f in os.listdir(WORK) if f.endswith(".json") and (not only or f.startswith(only)))
    # what Blender needs to place a chunk in the whole map
    for name in manifest:
        path = os.path.join(WORK, name)
        with open(path) as f:
            meta = json.load(f)
        meta["map"] = [WEST, SOUTH, EAST, NORTH]
        meta["fine"] = tuple(meta["chunk"]) in FINE
        with open(path, "w") as f:
            json.dump(meta, f)
    cmd = [BLENDER, "-b", "--factory-startup", "-P", os.path.join(ROOT, "blender", "diorama.py"), "--", WORK, *manifest]
    print("  " + " ".join(cmd[:6]) + f" … ({len(manifest)} tiles)", flush=True)
    subprocess.run(cmd, check=True)


# ---------------------------------------------------------------- pack


#: the app's heightmap and sea mask, degrees a pixel
HEIGHT_STEP = 0.02
SEA_STEP = 0.0125
#: model km stored as uint16: (km + offset) * scale
HEIGHT_OFFSET, HEIGHT_SCALE = 8.0, 1000.0
#: the sun the renders were lit by (blender/diorama.py), for the app's key light
SUN = {"azimuth": 315.0, "elevation": 34.0}


def inner(tid, name):
    """a level-1 tile's array without its margin"""
    with open(os.path.join(WORK, f"{tid}.json")) as f:
        meta = json.load(f)
    a = np.load(os.path.join(WORK, f"{tid}.{name}.npy"))
    mx, my = meta["margin"]
    return a[my : a.shape[0] - my, mx : a.shape[1] - mx]


def whole(name, step):
    """a level-1 array over the whole map, resampled to `step` degrees a pixel"""
    W = round((EAST - WEST) / step)
    H = round((NORTH - SOUTH) / step)
    out = np.zeros((H, W), np.float32)
    cw, ch = W // COLS, H // ROWS
    for r in range(ROWS):
        for c in range(COLS):
            a = inner(f"c{c}r{r}", name).astype(np.float32)
            zoom = (ch / a.shape[0], cw / a.shape[1])
            out[r * ch : (r + 1) * ch, c * cw : (c + 1) * cw] = ndimage.zoom(a, zoom, order=1)[:ch, :cw]
    return out


def step_pack():
    os.makedirs(os.path.join(OUT, "tex"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "mesh"), exist_ok=True)
    render = os.path.join(WORK, "render")
    chunks = []
    previews = {}
    for r in range(ROWS):
        for c in range(COLS):
            cid = f"c{c}r{r}"
            img = Image.open(os.path.join(render, f"{cid}.png")).convert("RGB")
            img.save(os.path.join(OUT, "tex", f"{cid}.webp"), quality=86, method=5)
            previews[(c, r)] = img.resize((512, round(512 * img.height / img.width)), Image.LANCZOS)
            entry = dict(id=cid, col=c, row=r, west=WEST + c * CW, east=WEST + (c + 1) * CW, north=NORTH - r * CH, south=NORTH - (r + 1) * CH, mesh=f"mesh/{cid}.glb", l1=f"tex/{cid}.webp")
            if (c, r) in FINE:
                q = [[Image.open(os.path.join(render, f"{cid}q{qx}{qy}.png")).convert("RGB") for qx in range(2)] for qy in range(2)]
                qw, qh = q[0][0].size
                big = Image.new("RGB", (qw * 2, qh * 2))
                for qy in range(2):
                    for qx in range(2):
                        big.paste(q[qy][qx], (qx * qw, qy * qh))
                big.save(os.path.join(OUT, "tex", f"{cid}-2.webp"), quality=84, method=5)
                entry["l2"] = f"tex/{cid}-2.webp"
            subprocess.run(
                ["npx", "gltf-transform", "optimize", os.path.join(WORK, "mesh", f"{cid}.glb"), os.path.join(OUT, "mesh", f"{cid}.glb"),
                 "--compress", "meshopt", "--texture-compress", "false", "--simplify", "false", "--prune-attributes", "false",
                 "--join", "false", "--instance", "false", "--flatten", "false", "--palette", "false"],
                check=True, cwd=ROOT, capture_output=True,
            )
            chunks.append(entry)
            print(f"  {cid}", flush=True)
    pw, ph = previews[(0, 0)].size
    preview = Image.new("RGB", (pw * COLS, ph * ROWS))
    for (c, r), im in previews.items():
        preview.paste(im, (c * pw, r * ph))
    preview.save(os.path.join(OUT, "preview.webp"), quality=82, method=5)
    preview.resize((preview.width // 2, preview.height // 2), Image.LANCZOS).save(os.path.join(OUT, "preview-2k.webp"), quality=82, method=5)
    # heights for markers and lines, as 16-bit in red and green
    h = whole("height", HEIGHT_STEP)
    v = np.clip(np.round((h + HEIGHT_OFFSET) * HEIGHT_SCALE), 0, 65535).astype(np.uint32)
    rgb = np.stack([(v >> 8) & 255, v & 255, np.zeros_like(v)], -1).astype(np.uint8)
    Image.fromarray(rgb).save(os.path.join(OUT, "height.png"), optimize=True)
    # where the resin of the sea goes
    land = whole("land", SEA_STEP)
    Image.fromarray(((land < 0.5) * 255).astype(np.uint8)).save(os.path.join(OUT, "sea.png"), optimize=True)
    meta = dict(
        version=int(os.path.getmtime(os.path.join(OUT, "preview.webp"))),
        west=WEST, south=SOUTH, east=EAST, north=NORTH, grid=[COLS, ROWS], refLat=REF_LAT, vertical=VERTICAL, sun=SUN,
        preview="preview.webp", height=dict(path="height.png", offset=HEIGHT_OFFSET, scale=HEIGHT_SCALE), sea="sea.png", chunks=chunks,
    )
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    total = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(OUT) for fn in fns)
    print(f"  public/diorama: {total / 1e6:.1f} MB", flush=True)


# ---------------------------------------------------------------- close up
#
# What the app needs to build the land itself as the camera nears: the painted
# colour without its shading (it lights the land live up close), the lakes at
# their own levels, heights in metres, and the grain of the ground.

#: the ground's grain, by layer: textures from Poly Haven (CC0); luminance only, packed four to an image
GROUND = {
    "a": ["rock_face", "aerial_rocks_04", "rocky_terrain_02", "aerial_beach_01"],  # cliff, stony hill, meadow, sand
    "b": ["dry_ground_rocks"],  # plain
}
METRE_OFFSET = 11000.0
LAKE_MIN_DEG2 = 0.004  # smaller lakes are left to the painting


def step_close():
    os.makedirs(os.path.join(OUT, "alb"), exist_ok=True)
    # the painted colour, unshaded: a 1024 for every chunk, a 2048 where the land is finer
    for r in range(ROWS):
        for c in range(COLS):
            cid = f"c{c}r{r}"
            with open(os.path.join(WORK, f"{cid}.json")) as f:
                meta = json.load(f)
            mx, my = meta["margin"]
            img = Image.open(os.path.join(WORK, f"{cid}.colour.png")).convert("RGB")
            img = img.crop((mx, my, img.width - mx, img.height - my))
            img.resize((1024, round(1024 * img.height / img.width)), Image.LANCZOS).save(os.path.join(OUT, "alb", f"{cid}.webp"), quality=88, method=5)
            if (c, r) in FINE:
                q = []
                for qy in range(2):
                    row = []
                    for qx in range(2):
                        with open(os.path.join(WORK, f"{cid}q{qx}{qy}.json")) as f:
                            qm = json.load(f)
                        qmx, qmy = qm["margin"]
                        im = Image.open(os.path.join(WORK, f"{cid}q{qx}{qy}.colour.png")).convert("RGB")
                        row.append(im.crop((qmx, qmy, im.width - qmx, im.height - qmy)))
                    q.append(row)
                qw, qh = q[0][0].size
                big = Image.new("RGB", (qw * 2, qh * 2))
                for qy in range(2):
                    for qx in range(2):
                        big.paste(q[qy][qx], (qx * qw, qy * qh))
                big.resize((2048, round(2048 * big.height / big.width)), Image.LANCZOS).save(os.path.join(OUT, "alb", f"{cid}-2.webp"), quality=86, method=5)
            print(f"  albedo {cid}", flush=True)
    # heights in metres over the whole map (the fallback until the live terrain is in)
    W = round((EAST - WEST) / HEIGHT_STEP)
    H = round((NORTH - SOUTH) / HEIGHT_STEP)
    h = resample("dem", 8, WEST, SOUTH, EAST, NORTH, W, H)
    land = whole("land", HEIGHT_STEP)
    h = fill_seabed(h, resample("dem", 6, WEST, SOUTH, EAST, NORTH, W, H), land, (EAST - WEST) * KM_LNG / W)
    v = np.clip(np.round(h + METRE_OFFSET), 0, 65535).astype(np.uint32)
    Image.fromarray(np.stack([(v >> 8) & 255, v & 255, np.zeros_like(v)], -1).astype(np.uint8)).save(os.path.join(OUT, "metres.png"), optimize=True)
    # the lakes, each at its own level
    vectors()
    lakes = []
    for props, poly in polys(LAKES):
        # dammed in the last century: not the Bible's world
        if props.get("featurecla") == "Reservoir":
            continue
        ring = poly[0]
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        if max(xs) < WEST or min(xs) > EAST or max(ys) < SOUTH or min(ys) > NORTH:
            continue
        if (max(xs) - min(xs)) * (max(ys) - min(ys)) < LAKE_MIN_DEG2:
            continue
        box = (min(xs), min(ys), max(xs), max(ys))
        gw = max(8, round((box[2] - box[0]) / 0.004))
        gh = max(8, round((box[3] - box[1]) / 0.004))
        im = Image.new("L", (gw, gh), 0)
        ImageDraw.Draw(im).polygon([((x - box[0]) / (box[2] - box[0]) * gw, (box[3] - y) / (box[3] - box[1]) * gh) for x, y in ring], fill=255)
        mask = np.asarray(im) > 127
        if mask.sum() < 4:
            continue
        hs = resample("dem", 9, *box, gw, gh)[mask]
        level = float(np.percentile(hs, 30))
        # a few metres below the sea is noise at a coast; the true basins lie far deeper
        if -60 < level < 0:
            level = 0.0
        simple = simplify(ring, 0.0025)
        lakes.append(dict(name=props.get("name") or "", level=round(level, 1), ring=[[round(x, 4), round(y, 4)] for x, y in simple]))
        print(f"  lake {props.get('name')}: {level:.0f} m, {len(simple)} points", flush=True)
    with open(os.path.join(OUT, "lakes.json"), "w") as f:
        json.dump(lakes, f)
    # the ground's grain
    for key, names in GROUND.items():
        chans = []
        for name in names:
            path = os.path.join(RAW, "ground", f"{name}.jpg")
            if not os.path.exists(path):
                os.makedirs(os.path.dirname(path), exist_ok=True)
                r = session.get(f"https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/{name}/{name}_diff_1k.jpg", timeout=120)
                r.raise_for_status()
                with open(path, "wb") as f:
                    f.write(r.content)
            lum = np.asarray(Image.open(path).convert("L").resize((1024, 1024), Image.LANCZOS), np.float32)
            # centred on mid-grey, its contrast evened out, so it only shades the colour it lies on
            lum = (lum - lum.mean()) / (lum.std() + 1e-6) * 38 + 128
            chans.append(np.clip(lum, 0, 255).astype(np.uint8))
        while len(chans) < 4:
            chans.append(np.full((1024, 1024), 128, np.uint8))
        Image.fromarray(np.stack(chans, -1), "RGBA").save(os.path.join(OUT, f"ground-{key}.webp"), quality=90, method=5)
    with open(os.path.join(OUT, "meta.json")) as f:
        meta = json.load(f)
    meta.update(
        version=int(os.path.getmtime(os.path.join(OUT, "metres.png"))),
        albedo={c["id"]: dict(l1=f"alb/{c['id']}.webp", **({"l2": f"alb/{c['id']}-2.webp"} if (c["col"], c["row"]) in FINE else {})) for c in meta["chunks"]},
        metres=dict(path="metres.png", offset=METRE_OFFSET),
        lakes="lakes.json",
        ground=["ground-a.webp", "ground-b.webp"],
        model=dict(vertical=VERTICAL, seaVertical=SEA_VERTICAL, seaFloor=SEA_FLOOR, peakEase=PEAK_EASE),
    )
    with open(os.path.join(OUT, "meta.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print("  meta.json updated", flush=True)


def simplify(pts, tol):
    """Douglas-Peucker; a closed ring is split at its farthest point first"""
    pts = [tuple(p) for p in pts]
    if len(pts) > 3 and pts[0] == pts[-1]:
        far = max(range(len(pts)), key=lambda i: math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
        return simplify(pts[: far + 1], tol)[:-1] + simplify(pts[far:], tol)
    if len(pts) < 3:
        return pts
    (ax, ay), (bx, by) = pts[0], pts[-1]
    dx, dy = bx - ax, by - ay
    n = math.hypot(dx, dy) or 1e-12
    dists = [abs(dx * (py - ay) - dy * (px - ax)) / n for px, py in pts[1:-1]]
    i = max(range(len(dists)), key=dists.__getitem__) + 1
    if dists[i - 1] > tol:
        return simplify(pts[: i + 1], tol)[:-1] + simplify(pts[i:], tol)
    return [pts[0], pts[-1]]


if __name__ == "__main__":
    steps = sys.argv[1:2] or ["data", "render", "pack", "close"]
    only = sys.argv[2] if len(sys.argv) > 2 else None
    for step in (["data", "render", "pack", "close"] if steps == ["all"] else steps):
        print(f"▸ {step}", flush=True)
        {"data": lambda: step_data(only), "render": lambda: step_render(only), "pack": step_pack, "close": step_close}[step]()
