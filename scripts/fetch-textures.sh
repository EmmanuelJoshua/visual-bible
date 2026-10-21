#!/usr/bin/env bash
# Re-download CC0 cubit-model maps into public/textures/
# Gold/copper: ambientCG. Wood/linen/fabric/stone/HDRI: Poly Haven.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p public/textures/{gold,bronze,wood,linen,scarlet,stone,env}

download_ph() {
  local id="$1" dest="$2"
  shift 2
  local json url
  json=$(curl -sS "https://api.polyhaven.com/files/${id}")
  mkdir -p "$dest"
  for map in "$@"; do
    url=$(python3 -c "import json,sys; d=json.load(sys.stdin); k={'diff':'Diffuse','nor':'nor_gl','rough':'Rough'}['$map']; print(d[k]['1k']['jpg']['url'])" <<<"$json")
    echo "  $id $map"
    curl -sSL --fail -o "$dest/${map}.jpg" "$url"
  done
}

download_ph brown_planks_08 public/textures/wood diff nor rough
download_ph rough_linen public/textures/linen diff nor rough
download_ph crepe_satin public/textures/scarlet diff nor rough
download_ph medieval_blocks_02 public/textures/stone diff nor rough

echo "HDRI"
curl -sSL --fail -o public/textures/env/studio_small_03_1k.hdr \
  "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr"

tmpdir=$(mktemp -d)
curl -sSL --fail -o "$tmpdir/gold.zip" "https://ambientcg.com/get?file=Metal048A_1K-JPG.zip"
curl -sSL --fail -o "$tmpdir/copper.zip" "https://ambientcg.com/get?file=Metal047A_1K-JPG.zip"
unzip -qo "$tmpdir/gold.zip" -d "$tmpdir/gold"
unzip -qo "$tmpdir/copper.zip" -d "$tmpdir/copper"

copy_maps() {
  local src="$1" dest="$2"
  mkdir -p "$dest"
  find "$src" -type f -iname '*_Color.jpg' -exec cp {} "$dest/diff.jpg" \;
  find "$src" -type f -iname '*_NormalGL.jpg' -exec cp {} "$dest/nor.jpg" \;
  find "$src" -type f -iname '*_Roughness.jpg' -exec cp {} "$dest/rough.jpg" \;
  find "$src" -type f -iname '*_Metalness.jpg' -exec cp {} "$dest/metal.jpg" \;
}
copy_maps "$tmpdir/gold" public/textures/gold
copy_maps "$tmpdir/copper" public/textures/bronze
rm -rf "$tmpdir"
echo "done"
