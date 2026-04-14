# RackZone 3D Planner — Model Pipeline

## Overview

Raw CAD-exported `.gltf` files are processed by `@gltf-transform/cli` before being
committed to the repository. Raw files are gitignored; only optimised `.glb` files
are committed.

## Directory Structure

```
/models/raw/        # Raw .gltf + .bin files — gitignored, never committed
/public/models/     # Optimised .glb files — committed and served at runtime
/public/draco/      # DRACOLoader decoder files — committed
```

## Performance — Raw vs Optimised

### Before Optimisation (Raw CAD Export)

| Metric      | Value          |
|-------------|----------------|
| Disk size   | 15.2 MB        |
| VRAM        | 3.9 MB         |
| Draw calls  | 35,337         |
| Frame rate  | 3 FPS          |

Root cause: full engineering precision export from CAD tooling.

### After Optimisation (Target)

| Metric      | Target         |
|-------------|----------------|
| Disk size   | < 2 MB per model |
| VRAM        | TBD            |
| Draw calls  | < 100          |
| Frame rate  | 55+ FPS        |

_After stats to be filled once models are processed._

## Filename Convention

Format: `[Height]X-[Width]-[Levels]L-[Type]`

Example: `H3000X-L2300-2L-Extender`

Dimensions are encoded in the filename and used for model mapping at runtime.

## How to Run the Optimisation Script

1. Place raw `.gltf` (+ associated `.bin`) files into `/models/raw/`
2. Run:

```bash
bash scripts/optimise-models.sh
```

3. Optimised `.glb` files will appear in `/public/models/`
4. Verify output at [gltf-viewer.donmccurdy.com](https://gltf-viewer.donmccurdy.com)
5. Commit `/public/models/` — do **not** commit `/models/raw/`

## Optimisation Command (per file)

```bash
npx @gltf-transform/cli optimize input.gltf output.glb \
  --simplify --ratio 0.1 --error 0.001 \
  --compress draco \
  --texture-compress webp
```

## Model Fallback

If a `.glb` fails to load at runtime, the planner silently reverts to procedural
`BoxGeometry`. No error is shown to the user — the planner remains fully functional.
