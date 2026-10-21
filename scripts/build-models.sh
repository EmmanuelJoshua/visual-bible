#!/usr/bin/env bash
# Builds the Blender models (blender/<name>.py) into compressed GLBs in public/models/.
#   npm run build:models            # every model
#   npm run build:models -- temple  # just one
# BLENDER overrides the Blender binary (default: the macOS app).
set -euo pipefail
cd "$(dirname "$0")/.."

BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
names=("$@")
if [ ${#names[@]} -eq 0 ]; then
  # a model script is one that exports; vb.py and furniture.py are libraries
  for f in $(grep -l "out_path()" blender/*.py | grep -v "/vb.py"); do
    names+=("$(basename "$f" .py)")
  done
fi

mkdir -p blender/out public/models
for n in "${names[@]}"; do
  echo "▸ $n"
  log="$("$BLENDER" -b --factory-startup -P "blender/$n.py" -- "$PWD/blender/out/$n.raw.glb" 2>&1)" || true
  echo "$log" | grep -E "Error|Traceback" && { echo "✗ $n: Blender failed"; exit 1; }
  # a script may export one model or several (objects.py): compress each
  exported="$(echo "$log" | sed -n 's/^exported //p')"
  [ -n "$exported" ] || { echo "✗ $n: Blender did not export"; exit 1; }
  while IFS= read -r raw; do
    out="public/models/$(basename "$raw" .raw.glb).glb"
    # meshopt-compressed and quantized; three's GLTFLoader decodes it (see lib/artifacts/build/model.ts).
    # UVs are kept although no texture is referenced yet: the app's materials use them.
    npx gltf-transform optimize "$raw" "$out" \
      --compress meshopt --texture-compress false --simplify false --prune-attributes false \
      --join false --instance false --flatten false --palette false | tail -1
  done <<< "$exported"
done
