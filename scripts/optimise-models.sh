#!/usr/bin/env bash
# Optimise all .gltf files in /models/raw/ → /public/models/ as .glb
# Before: 15.2MB disk, 3.9MB VRAM, 35,337 draw calls, 3 FPS
# Target:  <2MB per model, 55+ FPS, <100 draw calls
#
# Usage: bash scripts/optimise-models.sh

set -euo pipefail

RAW_DIR="$(dirname "$0")/../models/raw"
OUT_DIR="$(dirname "$0")/../public/models"

if [ ! -d "$RAW_DIR" ]; then
  echo "ERROR: $RAW_DIR does not exist. Place raw .gltf files there first."
  exit 1
fi

mkdir -p "$OUT_DIR"

shopt -s nullglob
FILES=("$RAW_DIR"/*.gltf)

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No .gltf files found in $RAW_DIR"
  exit 0
fi

echo "Optimising ${#FILES[@]} file(s) from $RAW_DIR → $OUT_DIR"
echo ""

for INPUT in "${FILES[@]}"; do
  BASENAME="$(basename "$INPUT" .gltf)"
  OUTPUT="$OUT_DIR/${BASENAME}.glb"

  echo "  → $BASENAME.gltf"

  npx @gltf-transform/cli optimize "$INPUT" "$OUTPUT" \
    --simplify --ratio 0.1 --error 0.001 \
    --compress draco \
    --texture-compress webp

  echo "     ✓ $OUTPUT"
done

echo ""
echo "Done. Verify output at https://gltf-viewer.donmccurdy.com"
