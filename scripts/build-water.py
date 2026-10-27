"""
Bakes the land / sea / lake masks the globe uses to flatten the sea and give
water its glint, from Natural Earth (public domain).

    python3 scripts/build-water.py        (npm run build:water)

Writes to public/globe/:
  water-world.png   the whole Earth, equirectangular, 0.1° a pixel
  water-region.png  Rome to Persia (10–56°E, 22–44°N), 0.01° a pixel (~1 km)
Values: 0 land, 128 lake (keeps its height: the Dead Sea lies 430 m down),
255 sea (flattened to sea level).

Needs Pillow and requests. Downloads are cached in data/raw/relief/.
"""

import json
import os

import requests
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), "..")
RAW = os.path.join(ROOT, "data", "raw", "relief")
OUT = os.path.join(ROOT, "public", "globe")
NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"

MASKS = {
    "water-world.png": (-180.0, 180.0, -90.0, 90.0, 0.1),
    "water-region.png": (10.0, 56.0, 22.0, 44.0, 0.01),
}


def cached(name):
    path = os.path.join(RAW, name)
    if not os.path.exists(path):
        r = requests.get(NE + name, timeout=120)
        r.raise_for_status()
        with open(path, "wb") as f:
            f.write(r.content)
    with open(path) as f:
        return json.load(f)


def polygons(geo):
    for f in geo["features"]:
        g = f["geometry"]
        if not g:
            continue
        for poly in g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]:
            yield f["properties"], poly


def main():
    os.makedirs(RAW, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    land = cached("ne_10m_land.geojson")
    lakes = cached("ne_10m_lakes.geojson")
    for name, (w0, e0, s0, n0, step) in MASKS.items():
        w = round((e0 - w0) / step)
        h = round((n0 - s0) / step)
        img = Image.new("L", (w, h), 255)
        d = ImageDraw.Draw(img)
        px = lambda pts: [((x - w0) / step, (n0 - y) / step) for x, y in pts]  # noqa: E731
        for _, poly in polygons(land):
            d.polygon(px(poly[0]), fill=0)
            for hole in poly[1:]:
                d.polygon(px(hole), fill=255)
        for props, poly in polygons(lakes):
            if (props.get("scalerank", 9) or 9) <= 9:
                d.polygon(px(poly[0]), fill=128)
        img.save(os.path.join(OUT, name), optimize=True)
        print(f"  {name}: {w}×{h}, {os.path.getsize(os.path.join(OUT, name)) / 1e3:.0f} KB")


if __name__ == "__main__":
    main()
