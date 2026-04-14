# RackZone 3D Planner — Architecture Document

> Advisory board decisions captured. All open questions resolved.
> This document is the single source of truth for architecture and product decisions.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Confirmed Tech Stack](#2-confirmed-tech-stack)
3. [Product Structure and Catalogue](#3-product-structure-and-catalogue)
4. [Metafield Schema](#4-metafield-schema)
5. [Shopify Storefront API Integration](#5-shopify-storefront-api-integration)
6. [UX Model and Entry Modes](#6-ux-model-and-entry-modes)
7. [Shelf Level Logic](#7-shelf-level-logic)
8. [Auto-Switch and Structural Validation](#8-auto-switch-and-structural-validation)
9. [3D Model Pipeline](#9-3d-model-pipeline)
10. [Open Questions — All Resolved](#10-open-questions--all-resolved)

---

## 1. Project Overview

**Product:** RackZone 3D Planner

**Purpose:** Standalone SaaS web application. Customers configure shelving layouts in 3D and add products directly to a Shopify cart. RackZone is Client 1.

**SaaS angle:** Future consideration — do not architect for multi-tenancy now, but do not architect against it either.

**Deployment:**
- Hosted URL at launch: `planner.rackzone.ie`
- JS snippet embed — Phase 2

**Markets:**
- IE only at launch, EUR only
- All Shopify calls abstracted behind a single `shopifyClient` module to support future Markets/multi-currency without rebuild

---

## 2. Confirmed Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React | |
| 3D Rendering | Three.js | |
| State Management | Zustand | 5 slices — see below |
| Shopify Connection | Storefront API | Single store, IE/EUR only at launch |
| Backend | Supabase (existing Pro plan) | Tables: `layouts`, `presets` |
| Deployment | Vercel | |
| Charts | Recharts | Not applicable to planner — relevant to dashboard |
| Auth | Supabase Auth | |
| AI Layer | Anthropic Claude API | Phase 2 — not V1 |
| Alerts | Resend | Pipeline failures |

### Zustand State Slices

Five slices — BOM is derived state, not stored:

1. `scene` — 3D scene graph state
2. `config` — configuration controls state
3. `cart` — cart line items and totals
4. `ui` — panel visibility, selection, modals
5. `market` — market/currency context (fixed to IE for V1)

**Sync invariant:** 2D and 3D share a single scene graph. This is an explicit architectural constraint — the two views are never out of sync.

### Shopify Client Abstraction

- All Storefront API calls go via the `shopifyClient` module only
- No component calls Shopify directly — ever
- `@inContext` pattern implemented; market fixed to IE for V1
- Read-only: no write methods in `shopifyClient` ever

### Supabase

- Tables: `layouts`, `presets`
- RLS policies required on both tables
- TypeScript mirrors required for both table schemas

### Three Non-Negotiable Design Principles

1. **IE vs UK is a first-class dimension** — every table has a `market` column
2. **Read-only** — no writes back to source systems ever
3. **Orderwise-ready by design** — financial tables have a `source` field

### react-planner Assessment

Reference only — not used as a foundation. Plugin architecture studied. Zustand preferred over Redux at this scale.

---

## 3. Product Structure and Catalogue

### Object Types

Four values only:

| Type | Description | Placement Rules |
|---|---|---|
| `starter` | First bay in any row. Includes both end uprights. | Cannot be placed as anything other than position 1 in a row. |
| `extender` | Subsequent bays in a row. Shares one upright with adjacent bay. | Requires a Starter in the same row. |
| `shelf` | Extra level panel. Added above default shelf count. | Child object — attaches to parent bay. |
| `accessory` | Standalone specialist items (workbench, picking station). | Placed independently — not part of a bay row. |

### Multi-Bay Bundles

Excluded from planner Version 1.

Bundles (5 BAYS, 10 BAYS products) are pre-configured fixed sets. The planner generates the correct Starter + Extender mix automatically. Bundle SKUs are redundant in the planner context.

### Product Filter

- Shopify tag: `planner-compatible`
- Applied to longspan range as the initial launch set
- All Storefront API product queries filter by this tag

### Dev Catalogue

4 representative products only — full catalogue added after all mechanics are validated. No architectural changes are required to add more products.

| # | Type | Validates |
|---|---|---|
| 1 | Starter | Auto-switch, cart logic, shelf add/remove |
| 2 | Extender | Row validation, auto-resolve, price swap |
| 3 | Shelf | `compatible_shelf_sku` cart line item |
| 4 | Accessory | Accessory placement rules |

---

## 4. Metafield Schema

**All metafields are at variant level.**
- Namespace: `custom`
- Storefront API access: enabled on all fields
- Value format: numeric only — no units appended
- Convention: all dimension values are in millimetres

### Existing Fields — Confirmed Clean

| Field | Type | Example | Notes |
|---|---|---|---|
| `custom.width` | Numeric | `1200` | mm |
| `custom.height` | Numeric | `2000` | mm |
| `custom.depth` | Numeric | `800` | mm |
| `custom.number_of_shelves` | Integer | `3` | Default shelf count |
| `custom.number_of_levels` | Integer | `5` | Maximum shelf count |
| `custom.kg_per_shelf` | Numeric | `500` | kg |
| `custom.frame_material` | Text | `"Steel"` | |
| `custom.frame_coating` | Text | `"Powder Coated"` | |
| `custom.shelf_type` | Text | `"Steel Panels"` | |

### New Fields — To Be Created in Shopify Admin

| Field | Type | Values / Notes |
|---|---|---|
| `custom.object_type` | Text | `starter` \| `extender` \| `shelf` \| `accessory` |
| `custom.compatible_shelf_sku` | Text | SKU of the extra level shelf product added to cart when a shelf is added above default count. Example: `"LSSL12801L"` for an 800mm depth, 1200mm wide bay. |

**How to create:** Shopify Admin → Settings → Custom data → Variants → Add definition

### Field Removed

| Field | Reason |
|---|---|
| `custom.shelf_pitch_mm` | REMOVED. Equidistant spacing approach replaces fixed pitch entirely. No pitch field required. |

---

## 5. Shopify Storefront API Integration

### Authentication

- Storefront API public access token
- Read-only scoped — no write methods in `shopifyClient` ever
- Single token for `rackzone.ie` store

### Product Query Structure

Filter by tag: `planner-compatible`

Retrieve at variant level:
- All `custom.*` metafields listed in Section 4
- Variant SKU, price, `availableForSale`
- Product title, handle, images

### Cart Mutation

Add to cart: correct SKUs, variants, and quantities in one action.

Cart reflects:
- 1x Bay SKU (Starter or Extender as appropriate)
- Additional shelf line items above default count
- Accessory SKUs as independent line items

Behaviour:
- Silent price updates on auto-resolve (see Section 8)
- Checkout blocked if layout has structural validation errors

### Stock Display

- Source field: `availableForSale` from Storefront API
- Out-of-stock products: visible in panel but cannot be placed
- In-scene placed products that go out of stock: amber indicator in scene, warning in cart

---

## 6. UX Model and Entry Modes

### Three-Panel Layout

| Panel | Content |
|---|---|
| Left | Configuration controls — dimensions, rack type, accessories, shelf count controls, quantity |
| Centre | 3D scene — fully interactive and fully editable. Not a viewer. Click to select, drag to move, real-time updates as configuration changes. |
| Right / Bottom | Cart summary — live pricing, SKU list, add to cart |

### Two Entry Modes

Both modes operate within the same tool.

**"Plan my facility" — B2B mode**
- Full room dimensions input
- Multi-bay layout, multiple rows
- Save and share layout (Supabase persistence)
- Shareable link for sign-off workflow

**"Configure my workspace" — Prosumer mode**
- Guided flow, simplified room size input
- Configuration presets / starter templates
- 3–4 pre-built common layouts to start from

### 2D / 3D Toggle

- Single Three.js scene — orthographic camera for 2D view
- No separate SVG renderer — one scene, two camera modes
- Both modes are fully editable — changes in either reflect instantly
- Dimension overlays: `CSS2DObject` labels in both modes

### Trust Signal

TrustPilot score and review count displayed in prosumer mode at the point before add-to-cart. Confidence signal for non-trade buyers at moment of commitment.

---

## 7. Shelf Level Logic

### Counts

| Rule | Source |
|---|---|
| Default shelf count | `custom.number_of_shelves` — included in bay price |
| Maximum shelf count | `custom.number_of_levels` |
| Minimum shelf count | `custom.number_of_shelves` — customer cannot remove below default |

### Spacing Calculation

Equidistant — calculated at runtime:

```
spacing = custom.height ÷ (current_shelf_count + 1)
```

Recalculates automatically when shelves are added or removed. No fixed pitch — shelves redistribute evenly on every change.

### Cart Behaviour

| State | Cart Effect |
|---|---|
| Shelves at default count | No additional line items |
| Each shelf added above default | Additional line item using `custom.compatible_shelf_sku`; quantity = `current_shelf_count − custom.number_of_shelves` |
| Shelves removed back to default | Additional shelf line item removed from cart automatically |
| Attempt to remove below default | Blocked — minus button disabled at default count |

---

## 8. Auto-Switch and Structural Validation

### Auto-Switch Rule

Invisible to the user — fully automatic:

- First bay placed in any row → **Starter SKU** automatically
- Every subsequent bay in the same row → **Extender SKU** automatically
- User never sees or selects Starter vs Extender
- Cart always reflects the correct SKU mix

### Structural Validation — Core Rule

- Every row must contain exactly one Starter at position 1
- An Extender cannot exist in a row without a Starter
- A Starter is always the leftmost bay in its row

### Auto-Resolve on Starter Deletion

If the customer deletes the Starter from a row that contains Extenders:

1. Automatically promote the leftmost remaining Extender to Starter
2. Swap SKU from Extender SKU to equivalent Starter SKU
3. Update cart line item price automatically (upward adjustment)
4. No confirmation step — silent
5. Show dismissible info notice only:

> *"We've updated your layout automatically. The first bay in each row must be a Starter unit."*

### Fallback — If Auto-Resolve Fails

- Highlight affected bays with amber outline in scene
- Show inline warning on affected row:

> *"This row needs a Starter unit. An Extender cannot stand alone."*

- **[Add Starter]** one-click fix button on the affected row
- Cart checkout blocked until all rows are valid
- Cart persistent notice:

> *"Your layout has an invalid configuration. Please fix the highlighted bays to continue."*

- Blocking bays highlighted until resolved
- Checkout re-enabled automatically when resolved

### Valid Layout State

- Every row: exactly one Starter at position 1
- Zero or more Extenders follow it in the same row
- No amber highlights visible
- Checkout enabled

---

## 9. 3D Model Pipeline

### Dev Phase — Procedural Geometry

No model files needed during development.

All objects built from Three.js `BoxGeometry` with dimensions from metafields:

| Component | Geometry | Colour |
|---|---|---|
| Steel / Powder Coated frames | `BoxGeometry` | `#C0C0C0` (light grey) |
| Timber / Laminated frames | `BoxGeometry` | `#C4A265` (warm wood tone) |
| Shelf panels | Flat `BoxGeometry`, 20mm thick | — |
| Uprights | Narrow `BoxGeometry` matching upright profile dimensions | — |

Full interaction logic is built and validated on procedural geometry. No model files required or used in the dev phase.

### Launch Phase — GLTF/GLB Models

One base model per product family, scaled dynamically at runtime from metafield dimensions.

| File | Covers |
|---|---|
| `longspan_bay.glb` | Starters and Extenders |
| `longspan_shelf.glb` | Extra Level shelf panels |
| `longspan_accessory.glb` | Workbench and picking station |

**Source format:** `.gltf + .bin` pairs (20 files available)  
**Output format:** `.glb` (binary single file — combines `.gltf + .bin`)  
**Confirmed texture:** `Metal_Embossed.jpg` — 128×128, 1.15KB (not the performance problem)

### Performance Problem — Raw Files

Raw files are unusable for web without optimisation:

| Metric | Raw Value |
|---|---|
| Disk size | 15.2MB |
| VRAM | 3.9MB |
| Draw calls | 35,337 |
| Frame rate | 3 FPS |

**Root cause:** CAD export at full engineering precision.

### Optimisation

**Tool:** `@gltf-transform/cli` (installed as dev dependency)

**Command:**
```bash
npx @gltf-transform/cli optimize input.gltf output.glb \
  --simplify --ratio 0.1 --error 0.001 \
  --compress draco \
  --texture-compress webp
```

**Target output:** `<2MB` per model, `55+ FPS`, `<100` draw calls

### Draco Decoder Setup

Mandatory in the Three.js loader:

```js
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco/')

const loader = new GLTFLoader()
loader.setDRACOLoader(dracoLoader)
```

Copy `/draco/` decoder files from the Three.js package to `/public/draco/`.

### Repository Structure

```
/models/raw/        # Raw .gltf + .bin files — gitignored
/public/models/     # Optimised .glb files — committed
```

### Filename Convention

Format: `[Height]X-[Width]-[Levels]L-[Type]`  
Example: `H3000X-L2300-2L-Extender`

Dimensions are encoded in the filename and can be used for model mapping.

### Model Fallback

If a `.glb` fails to load → revert to procedural geometry silently. No error shown to the user — the planner continues to function.

### Optimisation Pipeline — Developer's First Task

Before any planner code is written:

1. Set up `/models/raw/` and `/public/models/` folder structure
2. Install `@gltf-transform/cli` as dev dependency
3. Run optimisation on all 20 source files
4. Verify output: `<2MB`, `55+ FPS` in [gltf-viewer.donmccurdy.com](https://gltf-viewer.donmccurdy.com)
5. Document before/after stats in repo README

### Phase 2 — Server-Side Upload Pipeline (SaaS Admin)

Out of scope for Version 1.

- Retailer uploads raw model via admin panel
- `gltf-transform` runs as Node.js child process server-side
- Optimised `.glb` stored to CDN, URL saved to database

---

## 10. Open Questions — All Resolved

| ID | Question | Resolution |
|---|---|---|
| OQ-1 | Store architecture | Single Shopify store, IE/EUR only at launch. `shopifyClient` abstraction for future Markets support. UK/GBP out of scope for Version 1. |
| OQ-2 | Embedding method | Hosted URL at launch (`planner.rackzone.ie`). JS snippet embed in Phase 2. Architecture must support both without rebuild. |
| OQ-4 | Product tagging | Tag `planner-compatible` applied to longspan products. Storefront API query filters by this tag. |
| OQ-5 | Metafield schema | See Section 4. Namespace `custom`, all numeric, Storefront API access enabled. |

### Additional Resolved Decisions

| Topic | Resolution |
|---|---|
| Shelf pitch | Equidistant spacing — no fixed pitch field needed. `custom.shelf_pitch_mm` removed. |
| Starter/Extender auto-switch | Fully automatic and invisible to user. |
| Structural validation | Auto-resolve with silent SKU swap and price update. Fallback amber highlighting with one-click fix. |
| Model pipeline | Procedural geometry for dev phase; GLTF/GLB for launch. |
| Dev catalogue | 4 products only for dev phase. Full catalogue added post-validation. |
| Multi-bay bundles | Excluded from planner Version 1. |
