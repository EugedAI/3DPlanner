# RackZone 3D Planner — Architecture Document

**Version:** 1.0  
**Date:** 2026-04-13  
**Status:** Advisory Board Review Draft  
**Tier:** 1 — Architecture document only. No code produced in this session.

---

## Purpose of this Document

This document is the Senior Developer's brief and advisory board review artefact for
the RackZone 3D Planner — Version 1.  It covers the full technical architecture,
all data models, integration design, state management, build plan, and scope
assessment.  Nothing in this document should be interpreted as final without advisory
board sign-off.  Open questions requiring decisions before build starts are
catalogued in the final section.

---

## Product Summary

The RackZone 3D Planner is a standalone SaaS conversion tool for rackzone.ie and
rackzone.co.uk — Shopify-powered Irish shelving and racking ecommerce stores.
Customers configure their shelving layout in an interactive 3D scene, review live
pricing, and add the correct SKUs/variants/quantities to their Shopify cart in one
action.

**Primary users:** B2B trade buyers (warehouse managers) and prosumers
(garage/workshop owners).

**Two entry modes within the same tool:**

- **Plan my facility** (B2B) — full room dimensions, multi-bay layout, floor plan
  input, save and share layout.
- **Configure my workspace** (Prosumer) — guided flow, simplified room input,
  configuration presets / starter templates.

**Deployment:** Standalone web application at `planner.rackzone.ie` (and
`planner.rackzone.co.uk`).  Not a Shopify embedded app.

---

## 1. Confirmed Technology Stack

### 1.1 Dependency Table

| Layer | Package | Version | Rationale |
|---|---|---|---|
| Framework | `react` | 19.x | Current stable; concurrent rendering benefits scene updates |
| Framework | `react-dom` | 19.x | |
| Language | `typescript` | 5.7+ | Strict mode throughout |
| Build | `vite` | 6.x | Fast dev server, optimal production bundles |
| 3D Rendering | `three` | r168+ | Core requirement — scene graph, geometry, materials |
| 3D / React bridge | `@react-three/fiber` | 8.x | React renderer for Three.js; integrates cleanly with Zustand |
| 3D helpers | `@react-three/drei` | 9.x | OrbitControls, TransformControls, CSS2DRenderer, Grid, etc. |
| Post-processing | `@react-three/postprocessing` | 2.x | Selection outline effect on picked rack bay |
| State management | `zustand` | 4.5+ | Lightweight, slice-based, direct Three.js integration |
| Styling | `tailwindcss` | 4.x | Utility-first; panel and overlay UI |
| GraphQL client | `graphql-request` | 7.x | Minimal, typed GQL client for Storefront API |
| Animation | `gsap` | 3.x | Camera transition tween (2D ↔ 3D toggle) |
| ID generation | `nanoid` | 5.x | Share tokens, layout IDs |
| Database client | `@supabase/supabase-js` | 2.x | Layouts persistence, preset catalogue |
| GLB model tools | `@gltf-transform/core` | 4.x | Already in repo — model pre-processing pipeline |
| GLB model tools | `@gltf-transform/extensions` | 4.x | Already in repo |

### 1.2 Architecture Decision: @react-three/fiber vs raw Three.js

The brief specifies Three.js.  **React Three Fiber (R3F) is Three.js** — it is a
React renderer that drives the same Three.js scene graph, renderer, and geometry
APIs underneath.  Every Three.js primitive (`BoxGeometry`, `MeshStandardMaterial`,
`Raycaster`, `Box3`, etc.) is used directly within R3F components.

R3F is the correct integration layer because:

- It manages the render loop, resize observer, and WebGL context lifetime.
- Three.js scene objects are declared as JSX, making them naturally reactive to
  Zustand store state.
- `@react-three/drei` provides production-grade implementations of
  `OrbitControls`, `TransformControls`, `CSS2DRenderer`, and `Grid` — saving
  significant implementation time with no loss of control.

**No abstraction sits between the developer and Three.js.**  Where fine-grained
imperative control is needed (e.g. raycasting on pointer events, AABB collision
checks, snap logic), R3F `useThree()` and `useFrame()` provide direct access to the
Three.js renderer, scene, and camera.

### 1.3 Architecture Decision: react-planner Assessment

The brief asks whether
[react-planner](https://cvdlab.github.io/react-planner/) is a viable foundation or
reference only.

**Verdict: Reference only.**

| Criteria | react-planner | This project |
|---|---|---|
| Last maintained | 2020 | N/A |
| State management | Redux | Zustand |
| 3D support | None — 2D SVG only | Three.js / R3F |
| 2D/3D sync | Not applicable | Core requirement |
| Editable 3D | Not supported | Core requirement |
| Shopify integration | None | Core requirement |

react-planner's **plugin architecture pattern** (components self-register with a
scene registry) and its **SVG-based 2D floor plan rendering approach** are worth
studying.  Nothing else is directly reusable.  Building from scratch on React 19 +
R3F + Zustand will produce a cleaner, more maintainable codebase faster.

---

## 2. Repository Structure

```
3DPlanner/
├── public/
│   └── favicon.ico
│
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx          # Three-panel wrapper
│   │   │   ├── LeftPanel.tsx         # Configuration controls host
│   │   │   ├── CentrePanel.tsx       # Scene canvas + toolbar
│   │   │   └── RightPanel.tsx        # Cart summary host
│   │   │
│   │   ├── scene/                    # All R3F / Three.js components
│   │   │   ├── PlannerScene.tsx      # Root <Canvas> component
│   │   │   ├── Room.tsx              # Floor plane + wall planes
│   │   │   ├── BayMesh.tsx           # Single rack bay (GLB + AABB)
│   │   │   ├── BayGroup.tsx          # All placed bays
│   │   │   ├── SnapGrid.tsx          # Visual grid helper
│   │   │   ├── DimensionLabel.tsx    # CSS2DObject label (2D + 3D)
│   │   │   ├── DimensionOverlays.tsx # All dimension labels for scene
│   │   │   ├── SelectionOutline.tsx  # Post-processing outline on selected bay
│   │   │   └── CameraController.tsx  # OrbitControls + 2D/3D camera tween
│   │   │
│   │   ├── controls/                 # Left panel UI
│   │   │   ├── RoomDimensionsPanel.tsx
│   │   │   ├── ProductCatalogue.tsx
│   │   │   ├── VariantSelector.tsx
│   │   │   └── AccessoriesPanel.tsx
│   │   │
│   │   ├── cart/                     # Right panel
│   │   │   ├── CartSummary.tsx
│   │   │   ├── CartLineItem.tsx
│   │   │   ├── StockBadge.tsx
│   │   │   └── AddToCartButton.tsx
│   │   │
│   │   ├── modes/                    # Entry mode flows
│   │   │   ├── ModeSelector.tsx      # Initial B2B / Prosumer picker
│   │   │   ├── B2BFlow.tsx
│   │   │   └── ProsumerFlow.tsx
│   │   │
│   │   └── presets/
│   │       ├── PresetPicker.tsx
│   │       └── PresetCard.tsx
│   │
│   ├── store/                        # Zustand slices
│   │   ├── index.ts                  # Combined store export
│   │   ├── layoutSlice.ts
│   │   ├── catalogueSlice.ts
│   │   ├── cartSlice.ts
│   │   ├── uiSlice.ts
│   │   └── sessionSlice.ts
│   │
│   ├── hooks/
│   │   ├── useSnapToGrid.ts
│   │   ├── useCollisionDetection.ts
│   │   ├── useShopify.ts
│   │   ├── useSupabase.ts
│   │   └── useBOM.ts                 # Bill-of-Materials generator
│   │
│   ├── lib/
│   │   ├── shopify/
│   │   │   ├── client.ts             # graphql-request client factory
│   │   │   ├── queries.ts            # All GQL query strings
│   │   │   ├── mutations.ts          # All GQL mutation strings
│   │   │   └── types.ts              # Shopify response type definitions
│   │   └── supabase/
│   │       ├── client.ts             # Supabase client singleton
│   │       └── types.ts              # Database type definitions
│   │
│   ├── types/
│   │   ├── layout.ts                 # Room, Bay, Accessory, Position types
│   │   ├── product.ts                # ShopifyProduct, Variant, Money types
│   │   └── preset.ts                 # Preset type
│   │
│   ├── App.tsx                       # Route: mode selector → planner
│   ├── main.tsx
│   └── index.css
│
├── supabase/
│   ├── migrations/
│   │   └── 001_initial.sql
│   └── seed.sql                      # Preset data seed
│
├── models/
│   └── glb/                          # Existing GLB assets (already in repo)
│       └── *.glb
│
├── .env.example
├── .env.local                        # gitignored
├── ARCHITECTURE.md
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

### Notes on existing prototype files

The repository currently contains `index.html` and `rackzone-planner.html` — HTML
prototype files with embedded JavaScript.  These are retained as interaction
references for the development team.  They are **not** part of the production build
and should be moved to a `/prototypes` directory or removed before the V1 launch.

The existing GLB models in `models/glb/` are the starting asset library.  The
`strip-textures.js` script pre-processes these models and remains in use during asset
pipeline work.

---

## 3. Full Data Model — Supabase

### 3.1 Design Principles

- **No user authentication in V1.** Layouts are saved anonymously, identified by a
  UUID primary key and a short random share token.
- **Email is optional capture only.** B2B users can provide an email address to
  receive their share link — this is stored in `layouts.meta` as plain text, not a
  user account.
- **Presets are admin-managed.** The `presets` table is seeded via `supabase/seed.sql`
  and managed by the RackZone team through the Supabase dashboard.  No admin UI is
  built in V1.
- **Row Level Security (RLS).** All tables have RLS enabled.  The anon key is the
  only client credential.  Layouts are readable by anyone with the UUID; writes
  require matching the UUID (no auth token needed — the UUID is the secret).

### 3.2 layouts

Stores every saved planner configuration.

```sql
CREATE TABLE layouts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token   TEXT        UNIQUE NOT NULL DEFAULT nanoid(10),
  name          TEXT        NOT NULL DEFAULT 'My Layout',
  entry_mode    TEXT        NOT NULL CHECK (entry_mode IN ('b2b', 'prosumer')),
  room_data     JSONB       NOT NULL,
  bays_data     JSONB       NOT NULL DEFAULT '[]',
  meta          JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER layouts_updated_at
  BEFORE UPDATE ON layouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX layouts_share_token_idx ON layouts (share_token);
```

**`room_data` JSONB shape:**
```json
{
  "width_mm":  6000,
  "depth_mm":  4000,
  "height_mm": 3000
}
```

**`bays_data` JSONB shape** (array of bay objects):
```json
[
  {
    "id":           "bay_abc123",
    "product_id":   "gid://shopify/Product/12345",
    "variant_id":   "gid://shopify/ProductVariant/67890",
    "sku":          "RS-600-3L-S",
    "x_mm":         1200,
    "z_mm":         600,
    "rotation_deg": 0,
    "accessories": [
      {
        "variant_id": "gid://shopify/ProductVariant/11111",
        "sku":        "RS-WIRE-600",
        "quantity":   3
      }
    ]
  }
]
```

**`meta` JSONB shape:**
```json
{
  "market":      "IE",
  "currency":    "EUR",
  "email":       "buyer@example.com",
  "preset_id":   "uuid-or-null",
  "total_price": "1450.00"
}
```

**RLS policies:**
```sql
ALTER TABLE layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "layouts_read"   ON layouts FOR SELECT USING (true);
CREATE POLICY "layouts_insert" ON layouts FOR INSERT WITH CHECK (true);
CREATE POLICY "layouts_update" ON layouts FOR UPDATE USING (true);
```

> **Open Question OQ-9:** Should saved layouts expire?  `expires_at` column is
> present — a Supabase pg_cron job can purge rows where `expires_at < now()`.

### 3.3 presets

Admin-managed library of starter configurations.

```sql
CREATE TABLE presets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  description   TEXT,
  entry_mode    TEXT        NOT NULL CHECK (entry_mode IN ('b2b', 'prosumer')),
  thumbnail_url TEXT,
  room_data     JSONB       NOT NULL,
  bays_data     JSONB       NOT NULL,
  sort_order    INT         NOT NULL DEFAULT 0,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presets_read" ON presets
  FOR SELECT USING (is_active = true);
```

**V1 seed data** (four presets in `supabase/seed.sql`):

| Name | Entry Mode | Description |
|---|---|---|
| Single-aisle warehouse | b2b | Two parallel rows, 6 bays each, 2.4 m aisle |
| Double-aisle warehouse | b2b | Four rows, standard forklift clearance |
| Garage wall storage | prosumer | Single wall run, 3 bays |
| Workshop corner | prosumer | L-shaped, 2 + 2 bays |

### 3.4 TypeScript type mirror

```typescript
// src/types/layout.ts

export interface RoomData {
  width_mm:  number;
  depth_mm:  number;
  height_mm: number;
}

export interface BayAccessory {
  variant_id: string;
  sku:        string;
  quantity:   number;
}

export interface BayData {
  id:           string;
  product_id:   string;
  variant_id:   string;
  sku:          string;
  x_mm:         number;
  z_mm:         number;
  rotation_deg: 0 | 90 | 180 | 270;
  accessories:  BayAccessory[];
}

export interface LayoutMeta {
  market:       'IE' | 'UK';
  currency:     'EUR' | 'GBP';
  email?:       string;
  preset_id?:   string;
  total_price?: string;
}

export interface Layout {
  id:          string;
  share_token: string;
  name:        string;
  entry_mode:  'b2b' | 'prosumer';
  room_data:   RoomData;
  bays_data:   BayData[];
  meta:        LayoutMeta;
  created_at:  string;
  updated_at:  string;
  expires_at?: string;
}

export interface Preset {
  id:             string;
  name:           string;
  description?:   string;
  entry_mode:     'b2b' | 'prosumer';
  thumbnail_url?: string;
  room_data:      RoomData;
  bays_data:      BayData[];
  sort_order:     number;
}
```

---

## 4. Shopify Storefront API Integration

### 4.1 Store Architecture Decision

> **Open Question OQ-1 (blocking):** Is there one Shopify store with Shopify Markets
> configured for IE and UK, or are rackzone.ie and rackzone.co.uk two separate Shopify
> stores?  This section assumes **one store + Shopify Markets** (the most likely
> configuration).  If two stores, the client factory must be updated to select the
> correct endpoint/token pair based on market.

### 4.2 Authentication

The Shopify Storefront API uses a **public Storefront API access token**.  This token
is safe to expose in a frontend application — it provides read access to product and
pricing data, and write access to cart mutations only.  It does not grant merchant
admin access.

```
VITE_SHOPIFY_STOREFRONT_ENDPOINT=https://rackzone.ie/api/2024-10/graphql.json
VITE_SHOPIFY_STOREFRONT_TOKEN=<public token from Shopify admin>
```

The GraphQL client is instantiated once in `src/lib/shopify/client.ts`:

```typescript
// src/lib/shopify/client.ts
import { GraphQLClient } from 'graphql-request';

export const shopifyClient = new GraphQLClient(
  import.meta.env.VITE_SHOPIFY_STOREFRONT_ENDPOINT,
  {
    headers: {
      'X-Shopify-Storefront-Access-Token':
        import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN,
      'Content-Type': 'application/json',
    },
  }
);
```

### 4.3 Shopify Markets / Multi-currency

Shopify Markets allows a single store to serve multiple regions with localised
pricing.  The `@inContext` directive is passed on every query and mutation to instruct
Shopify to return prices in the correct currency.

**Market detection logic** (in priority order):

1. Subdomain/hostname: `rackzone.ie` → `IE` / `EUR`;
   `rackzone.co.uk` → `GB` / `GBP`.
2. Query string: `?market=IE` or `?market=GB` (for iframe/embed fallback).
3. Default: `IE` / `EUR`.

Market is stored in `cartSlice.market` and passed as a variable to every Shopify
query.  The `CountryCode` enum value is `IE` for Ireland and `GB` for United Kingdom
(Shopify uses ISO 3166-1 alpha-2 codes).

### 4.4 Product Catalogue Query

Products participating in the planner are identified by a Shopify tag
(`3d-planner`).  Planner-specific metadata (physical dimensions, GLB model path,
bay type) is stored in Shopify product metafields.

> **Open Question OQ-4 (blocking):** Confirm the Shopify tag or collection used to
> identify planner products.  `3d-planner` is the recommended convention.
>
> **Open Question OQ-5 (blocking):** Define the metafield namespace and keys for
> planner-specific product data before catalogue integration is built.

```graphql
# src/lib/shopify/queries.ts — GetPlannerProducts

query GetPlannerProducts($country: CountryCode!, $language: LanguageCode!)
  @inContext(country: $country, language: $language) {
  products(first: 250, query: "tag:3d-planner") {
    nodes {
      id
      handle
      title
      productType
      tags
      metafields(identifiers: [
        { namespace: "planner", key: "bay_type"    },
        { namespace: "planner", key: "width_mm"    },
        { namespace: "planner", key: "depth_mm"    },
        { namespace: "planner", key: "height_mm"   },
        { namespace: "planner", key: "shelf_count" },
        { namespace: "planner", key: "glb_model"   },
        { namespace: "planner", key: "is_starter"  },
        { namespace: "planner", key: "compatible_accessories" }
      ]) {
        key
        value
      }
      variants(first: 20) {
        nodes {
          id
          title
          sku
          availableForSale
          quantityAvailable
          price {
            amount
            currencyCode
          }
          selectedOptions {
            name
            value
          }
        }
      }
    }
  }
}
```

This query is executed once on planner load and the result is stored in
`catalogueSlice`.  Products are fetched fresh when the market changes.

**Recommended metafield schema** (subject to OQ-5):

| Namespace | Key | Type | Example |
|---|---|---|---|
| `planner` | `bay_type` | single_line_text | `longspan`, `pallet_rack`, `cantilever` |
| `planner` | `width_mm` | number_integer | `1200` |
| `planner` | `depth_mm` | number_integer | `600` |
| `planner` | `height_mm` | number_integer | `3000` |
| `planner` | `shelf_count` | number_integer | `3` |
| `planner` | `glb_model` | single_line_text | `600D_1200L_3000H_3L_Plain_Starter.glb` |
| `planner` | `is_starter` | boolean | `true` / `false` |
| `planner` | `compatible_accessories` | list.single_line_text | `["RS-WIRE-600","RS-UPRIGHT-CAP"]` |

### 4.5 Live Pricing

Pricing is returned per variant in the `GetPlannerProducts` query.  Because the
`@inContext` directive is present, Shopify returns `price.amount` in the correct
currency for the active market.  No client-side currency conversion is needed.

The right panel displays live prices directly from `catalogueSlice` — no polling or
secondary pricing endpoint is required.  If the user changes their market (edge case
— unlikely in V1), the catalogue is re-fetched.

### 4.6 Cart Mutations

**Create cart with all line items in one action (preferred):**

```graphql
# src/lib/shopify/mutations.ts — CartCreate

mutation CartCreate($input: CartInput!, $country: CountryCode!)
  @inContext(country: $country) {
  cartCreate(input: $input) {
    cart {
      id
      checkoutUrl
      lines(first: 50) {
        nodes {
          id
          quantity
          merchandise {
            ... on ProductVariant {
              id
              sku
              title
            }
          }
          cost {
            totalAmount { amount currencyCode }
          }
        }
      }
      cost {
        totalAmount    { amount currencyCode }
        subtotalAmount { amount currencyCode }
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

**Variables shape:**
```json
{
  "country": "IE",
  "input": {
    "lines": [
      { "merchandiseId": "gid://shopify/ProductVariant/67890", "quantity": 2 },
      { "merchandiseId": "gid://shopify/ProductVariant/11111", "quantity": 6 }
    ]
  }
}
```

### 4.7 Add-to-Cart Flow

The Bill of Materials (BOM) generator (`src/hooks/useBOM.ts`) converts the current
layout state into a flat array of `{ merchandiseId, quantity }` line items:

1. Iterate `store.bays` — aggregate by `variant_id`, sum quantities.
2. For each bay, iterate `bay.accessories` — aggregate by `variant_id`, sum
   quantities across all bays.
3. Merge bay quantities and accessory quantities.
4. Call `CartCreate` mutation with the full line item array.
5. On success: store the returned `checkoutUrl` in `cartSlice`.
6. Redirect to `checkoutUrl` — Shopify handles checkout from this point.

The customer lands on the standard Shopify checkout page with all items pre-populated.
No custom checkout page is built in V1.

### 4.8 Stock Status Display

`availableForSale` and `quantityAvailable` are returned in the product query.
`StockBadge` in the cart summary displays:

- Green: `availableForSale: true` AND `quantityAvailable >= requested_quantity`
- Amber: `availableForSale: true` AND `quantityAvailable < requested_quantity` (low stock)
- Red: `availableForSale: false` (out of stock — Add to Cart button is disabled)

---

## 5. Three.js Scene Architecture

### 5.1 Design Principle: Orthographic Camera for 2D Mode

Two approaches exist for the 2D floor plan view:

| Option | Approach | Trade-off |
|---|---|---|
| A | Separate SVG renderer on top of the canvas | Crisper 2D lines; requires a second rendering system, separate event handling, and manual sync |
| **B** | **Three.js orthographic camera looking straight down** | **All geometry is already in Three.js; toggle is a camera switch; raycasting, snap, collision, and dimension labels work identically in both modes** |

**Option B is the correct choice.**  The 2D mode is an orthographic top-down
projection of the same Three.js scene.  No separate 2D rendering system is needed.
Camera mode controls what the user sees, not what data exists.

### 5.2 Scene Graph Structure

```
PlannerScene (<Canvas>)
├── CameraController          — PerspectiveCamera | OrthographicCamera + OrbitControls
│
├── Lights
│   ├── AmbientLight          — softLight (intensity 0.6)
│   └── DirectionalLight      — sun (intensity 1.2, casts shadows)
│
├── Room
│   ├── Plane (floor)         — GridHelper overlaid in 3D mode
│   ├── Plane (back wall)     — ghost/wireframe in 3D, hidden in 2D
│   ├── Plane (left wall)     — ghost/wireframe in 3D, hidden in 2D
│   └── RoomDimensionLabels   — CSS2DObject labels on room edges
│
├── SnapGrid                  — Three.js GridHelper, spacing = GRID_SIZE_MM
│
├── BayGroup
│   └── BayMesh × N           — one per bay in store.bays
│       ├── GLB model (useGLTF loader)
│       ├── BoundingBoxHelper (debug only)
│       └── onClick → setSelectedBay(id)
│
├── TransformHandle           — <TransformControls> attached to selectedBay
│
├── DimensionOverlays         — all CSS2DObject labels
│   ├── BayDimensionLabel × N — per-bay width/height/depth
│   ├── AisleLabel × N        — aisle width between parallel rows
│   └── TotalFootprintLabel   — overall layout bounding box
│
└── SelectionEffects          — @react-three/postprocessing
    └── Outline               — highlight mesh of selectedBay
```

### 5.3 Camera and Controls

```typescript
// CameraController.tsx manages two camera configurations

// 3D mode — perspective, OrbitControls enabled
const perspectiveConfig = {
  position: [roomWidth * 0.8, roomHeight * 1.5, roomDepth * 1.2],
  fov: 50,
  near: 10,
  far: 100_000,
};

// 2D mode — orthographic, looking straight down
// OrbitControls: enableRotate = false, enablePan = true, enableZoom = true
const orthoConfig = {
  position: [roomWidth / 2, roomHeight * 3, roomDepth / 2],
  lookAt:   [roomWidth / 2, 0, roomDepth / 2],
  zoom:     1,
};
```

**Toggle animation:** GSAP `gsap.to()` tweens camera `position`, `rotation`, and
(for perspective→ortho) swaps the camera type mid-tween at the halfway point.
Duration: 600 ms, ease: `power2.inOut`.

### 5.4 Editable Product Placement

#### Click to Select

`BayMesh` registers an `onClick` handler via R3F's synthetic event system
(`onClick={e => { e.stopPropagation(); setSelectedBay(bay.id); }}`).

The R3F event system uses `Raycaster` internally.  `e.stopPropagation()` prevents
click-through to bays behind the selected one.

#### Drag to Move

`<TransformControls>` from `@react-three/drei` is conditionally rendered when
`store.selectedBayId !== null`, attached to the selected bay's `Object3D` ref.

```
TransformControls mode = "translate"
TransformControls showY = false    (racks stay on the floor — no vertical drag)
TransformControls space = "world"
```

The drag pipeline on every `onChange` event:

```
1.  Read proposed position from the dragged Object3D
2.  Snap: snapped = {
      x: Math.round(pos.x / GRID_SIZE_MM) * GRID_SIZE_MM,
      z: Math.round(pos.z / GRID_SIZE_MM) * GRID_SIZE_MM,
    }
3.  Clamp: keep bay inside room bounds
      snapped.x = clamp(snapped.x, 0, roomWidth  - bayWidth)
      snapped.z = clamp(snapped.z, 0, roomDepth  - bayDepth)
4.  Collision check (see §5.5)
5a. No collision → dispatch moveBay(id, snapped.x, snapped.z) to store
5b. Collision     → revert Object3D to last valid position, flash red outline
```

> **Open Question OQ-7 (blocking):** What is the physical snap grid resolution?
> 100 mm is a sensible default for longspan shelving.  Pallet racking is typically
> placed on 600 mm bay pitch — a configurable `VITE_GRID_SIZE_MM` env var
> allows this to be adjusted without code changes.

#### Rotation

`TransformControls` mode switches to `"rotate"` when the user activates rotation via
a toolbar button.  Rotation is constrained to Y-axis only, snapped to 90° increments.

### 5.5 Snap-to-Grid and Collision Detection

**Grid snap** is implemented in `src/hooks/useSnapToGrid.ts`:
```
snappedMm(value, gridSize) = Math.round(value / gridSize) * gridSize
```

**Collision detection** uses Three.js `Box3` (AABB — Axis-Aligned Bounding Box).
This is implemented in `src/hooks/useCollisionDetection.ts`:

```
For each bay in store.bays (excluding the bay being dragged):
  Expand its Box3 by a minimum clearance margin (e.g. 50 mm on all sides)
  If proposedBox3.intersectsBox(otherBox3) → collision detected
```

> **Open Question OQ-8:** Are there minimum aisle width rules to enforce
> (e.g. 2400 mm forklift aisle)?  If yes, these become named constraints in the
> collision detection hook, with a visual warning distinct from the general
> overlap collision.

**Back-to-back racking:** Two bays placed back-to-back (zero clearance on the
depth axis, offset 0 on x) is a valid warehouse configuration.  Collision detection
must allow zero clearance on the shared back face while still preventing overlap.
This is handled by treating back-to-back as a special case: if two bays share the
same Z coordinate and are depth-adjacent, no collision is flagged.

### 5.6 2D / 3D Sync Architecture

Zustand is the **single source of truth**.  The Three.js scene is a **reactive
renderer** of that state.  There is no separate 2D scene state.

```
User interaction (drag in 3D)
        │
        ▼
TransformControls onChange
        │
  Snap + Collision logic
        │
        ▼
store.moveBay(id, x, z)      ← single store mutation
        │
   ┌────┴────┐
   ▼         ▼
BayMesh   DimensionOverlays
(3D pos)  (label positions)
   │
   ▼
If mode === '2D':
  camera is orthographic — same scene, different projection
  user sees top-down view — same BayMesh objects, same state
```

When the user drags in **2D mode**, the exact same `TransformControls` machinery
runs — the only difference is the camera projection.  `TransformControls` correctly
handles orthographic cameras.  The same `moveBay` action fires.  Both views update
because they are the same scene.

**There is no 2D→3D propagation step.** The toggle is purely a camera change.

### 5.7 Dimension Overlays

Dimension labels use Three.js `CSS2DObject` (from `CSS2DRenderer`), which renders
HTML elements in world space.  This produces crisp, scale-independent text at any
zoom level — unlike `TextGeometry` which becomes pixelated.

```
CSS2DRenderer renders on top of the WebGL canvas as a positioned <div>
CSS2DObject positions the label div at a world-space coordinate
Labels auto-hide when camera is too far (fade on distance via CSS opacity)
```

Labels displayed:
- Per-bay: width, depth, height (shown on hover or when bay is selected)
- Aisle width: distance between parallel bay rows (always visible)
- Room footprint: total width × depth at room boundary
- Selected bay: all three dimensions always visible when selected

### 5.8 Performance Considerations

| Concern | Strategy |
|---|---|
| Many identical bays | `InstancedMesh` for bays sharing the same GLB geometry |
| Large GLB files | Pre-process with `@gltf-transform` (already in repo) to strip unused data; target < 500 KB per model |
| Texture memory | Use compressed textures (KTX2 / Basis Universal) for any textured models |
| Re-render cost | `React.memo` on `BayMesh`; Zustand subscriptions scoped to individual bay ID |
| Catalogue size | Lazy-load GLB models per product on first placement, not on app load |
| Shadow maps | Directional light shadow map capped at 1024×1024; `castShadow` only on bay meshes |
| Frustum culling | Three.js default — objects outside the camera frustum are not rendered |

---

## 6. State Management Design — Zustand

### 6.1 Store Architecture

The store is composed of five slices, combined in `src/store/index.ts`.  Each slice
is a separate file with its own state shape and actions.  All slices share a single
`usePlannerStore` hook.

```typescript
// src/store/index.ts
import { create } from 'zustand';
import { createLayoutSlice }    from './layoutSlice';
import { createCatalogueSlice } from './catalogueSlice';
import { createCartSlice }      from './cartSlice';
import { createUISlice }        from './uiSlice';
import { createSessionSlice }   from './sessionSlice';

export const usePlannerStore = create((...a) => ({
  ...createLayoutSlice(...a),
  ...createCatalogueSlice(...a),
  ...createCartSlice(...a),
  ...createUISlice(...a),
  ...createSessionSlice(...a),
}));
```

### 6.2 layoutSlice

The authoritative source of truth for the 3D/2D scene.

```typescript
interface LayoutState {
  // Room
  room: RoomData;
  setRoom: (room: Partial<RoomData>) => void;

  // Bays
  bays:          BayData[];
  addBay:        (bay: BayData) => void;
  removeBay:     (id: string) => void;
  moveBay:       (id: string, x_mm: number, z_mm: number) => void;
  rotateBay:     (id: string, rotation_deg: 0 | 90 | 180 | 270) => void;
  updateBay:     (id: string, patch: Partial<BayData>) => void;

  // Selection
  selectedBayId: string | null;
  setSelectedBay: (id: string | null) => void;

  // Mode
  viewMode:   '2D' | '3D';
  setViewMode: (mode: '2D' | '3D') => void;
  entryMode:  'b2b' | 'prosumer' | null;
  setEntryMode: (mode: 'b2b' | 'prosumer') => void;

  // Grid
  gridSizeMm: number;

  // Bulk reset (used when loading a preset or saved layout)
  loadLayout: (room: RoomData, bays: BayData[]) => void;
}
```

**Key invariant:** `moveBay` and `rotateBay` are the only functions that mutate bay
positions.  Both views (2D and 3D) always call these actions — never mutate a bay's
position directly.

### 6.3 catalogueSlice

```typescript
interface CatalogueState {
  products:     ShopifyProduct[];
  loading:      boolean;
  error:        string | null;
  fetchProducts: (market: 'IE' | 'UK') => Promise<void>;
  getProduct:   (productId: string) => ShopifyProduct | undefined;
  getVariant:   (variantId: string) => ShopifyVariant | undefined;
}
```

`fetchProducts` is called once on app mount (after market is determined) and on
market change.  The result is normalised: products keyed by `product.id`, variants
keyed by `variant.id`, both accessible by lookup functions.

### 6.4 cartSlice

```typescript
interface CartState {
  market:        'IE' | 'UK';
  currency:      'EUR' | 'GBP';
  setMarket:     (market: 'IE' | 'UK') => void;

  // BOM is derived (not stored) — see useBOM hook
  shopifyCartId:  string | null;
  checkoutUrl:    string | null;
  checkoutLoading: boolean;
  checkoutError:  string | null;
  createCheckout: (lines: CartLine[]) => Promise<void>;
}
```

**BOM is derived, not stored.**  `useBOM()` computes the bill of materials on every
render from `store.bays` and `store.products`.  It is not persisted in the store —
it is always recalculated from current state.  This prevents sync bugs between
`bays_data` and a separate `bom` state property.

### 6.5 uiSlice

```typescript
interface UIState {
  leftPanelTab:      'dimensions' | 'catalogue' | 'accessories';
  setLeftPanelTab:   (tab: UIState['leftPanelTab']) => void;

  isPresetModalOpen:  boolean;
  isSaveModalOpen:    boolean;
  isShareModalOpen:   boolean;
  openPresetModal:    () => void;
  openSaveModal:      () => void;
  openShareModal:     () => void;
  closeAllModals:     () => void;
}
```

### 6.6 sessionSlice

```typescript
interface SessionState {
  layoutId:    string | null;
  shareToken:  string | null;
  isDirty:     boolean;       // true if unsaved changes exist
  savedAt:     string | null; // ISO timestamp

  saveLayout:   (name: string, meta: LayoutMeta) => Promise<void>;
  loadLayout:   (idOrToken: string) => Promise<void>;
  markDirty:    () => void;
  markClean:    () => void;
}
```

`isDirty` is set to `true` by every `layoutSlice` mutation that changes scene
content.  It is reset to `false` after a successful `saveLayout`.  A "Unsaved
changes" indicator in the toolbar reads this flag.

### 6.7 How 2D State and 3D Scene State Stay in Sync

This is the most important architectural invariant and is worth stating explicitly:

> **There is no separate "2D state".  There is one layout state.  Both the 2D
> top-down view and the 3D perspective view are projections of that state through
> different camera configurations.**

The Three.js scene is never directly mutated to produce a 2D view.  The `viewMode`
flag in `layoutSlice` controls the camera configuration only.  All geometry,
positions, and labels exist in the same scene at all times.

---

## 7. Two Entry Mode UX Flow

Both modes use the same planner tool and the same Zustand store.  The mode
determines the **onboarding flow** and the **complexity of the left panel**.

### 7.1 Mode Selector (Landing Screen)

On first load (no layout ID in URL), the user sees a full-screen mode selector:

```
┌─────────────────────────────────────────────────────────────────┐
│                    RackZone 3D Planner                          │
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │   Plan my facility       │  │  Configure my workspace  │    │
│  │   (B2B)                  │  │  (Prosumer)               │    │
│  │                          │  │                           │    │
│  │   Full room layout       │  │  Guided setup             │    │
│  │   Multi-bay              │  │  Templates included       │    │
│  │   Save & share           │  │  Quick to complete        │    │
│  └──────────────────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 B2B Flow — "Plan my facility"

**Step 1 — Room dimensions**
- Width, depth, height inputs (mm or metres, with toggle)
- Optional: mark obstacles (columns, doors) — deferred if adds scope
- "Start planning" → enters main planner

**Step 2 — Main planner (left panel tabs)**
- *Dimensions tab:* room size editable, grid size selector
- *Products tab:* bay type filter → product cards → variant picker (dimensions,
  load rating) → click to place in scene
- *Accessories tab:* per-selected-bay accessory picker

**Step 3 — Scene interaction**
- Click empty floor → place new bay at click point
- Click existing bay → select, show TransformControls
- Drag to reposition → snap + collision
- Rotate via toolbar button (90° increments)
- Delete via keyboard Delete or toolbar button

**Step 4 — Review and save**
- Right panel shows live BOM with pricing and stock
- "Save layout" → Supabase write → returns share link
- "Add all to cart" → CartCreate mutation → redirect to Shopify checkout

**B2B data model additions:**
```typescript
interface B2BSession {
  step:          1 | 2 | 3 | 4;  // onboarding progress
  layoutName:    string;
  shareToken:    string | null;
}
```

### 7.3 Prosumer Flow — "Configure my workspace"

**Step 1 — Space type**
Four illustrated options: Garage, Workshop, Home storage, Small warehouse.
Selection pre-populates a suggested room size (editable).

**Step 2 — Preset selection**
Grid of 2–4 preset cards filtered by `entry_mode = 'prosumer'`.  Each card shows:
- Thumbnail image (from `presets.thumbnail_url`)
- Name and short description
- Approximate price range (calculated from preset BOM × catalogue prices)

Selecting a preset calls `store.loadLayout(preset.room_data, preset.bays_data)`.

**Step 3 — Configure from preset**
The planner opens with the preset layout already placed.  The left panel shows a
simplified view:
- Room dimensions (width × depth sliders with live preview)
- Bay configuration (height, shelf count for all bays simultaneously)
- Individual bay editing still available by clicking in scene

**Step 4 — Review and add to cart**
Same right panel as B2B.  Save/share is available but not foregrounded.

**Prosumer data model additions:**
```typescript
interface ProsumerSession {
  step:          1 | 2 | 3 | 4;
  spaceType:     'garage' | 'workshop' | 'home' | 'warehouse' | null;
  selectedPresetId: string | null;
}
```

### 7.4 Configuration Presets Data Model

Presets are stored in the Supabase `presets` table (schema in §3.3).
At application load, all active presets are fetched and cached in a lightweight
in-memory object (not in Zustand — presets are static reference data):

```typescript
// src/lib/supabase/client.ts
export async function fetchPresets(): Promise<Preset[]> {
  const { data } = await supabase
    .from('presets')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  return data ?? [];
}
```

When a preset is applied, `store.loadLayout(preset.room_data, preset.bays_data)`
replaces the current scene state entirely.  The store's `isDirty` flag is set to
`false` (the user has not diverged from the preset yet).  The `sessionSlice.layoutId`
is set to `null` (no saved layout yet).

---

## 8. Save / Share Architecture

### 8.1 Save Flow

Save is triggered from the toolbar ("Save layout") — B2B mode only, available but
secondary in Prosumer mode.

```
1. User clicks "Save layout"
2. If no layoutId in sessionSlice → INSERT new row in layouts
3. If layoutId exists → UPDATE existing row (upsert by id)
4. On success: store layoutId, shareToken, savedAt in sessionSlice
5. isDirty ← false
6. Toast: "Layout saved"
```

Supabase client call:
```typescript
// sessionSlice.saveLayout()
const { data, error } = await supabase
  .from('layouts')
  .upsert({
    id:         store.layoutId ?? undefined,  // undefined → new UUID generated
    name,
    entry_mode: store.entryMode,
    room_data:  store.room,
    bays_data:  store.bays,
    meta,
  })
  .select('id, share_token')
  .single();
```

### 8.2 Share Flow

```
1. User clicks "Share layout"
2. If unsaved → trigger save first (prompt)
3. Share URL: https://planner.rackzone.ie/?layout=<share_token>
4. Show modal with:
   - Copyable URL
   - Optional: "Email this link" → mailto: link (no email sending in V1)
```

The share token is the `share_token` column (10-character nanoid), not the UUID.
The UUID is treated as private; the share token is designed for sharing.

### 8.3 Load from Share Link

On app mount, `App.tsx` checks `window.location.search` for `?layout=<token>`.
If present:

```typescript
// sessionSlice.loadLayout()
const { data } = await supabase
  .from('layouts')
  .select('*')
  .eq('share_token', token)
  .single();

if (data) {
  store.loadLayout(data.room_data, data.bays_data);
  store.setEntryMode(data.entry_mode);
  store.setLayoutId(data.id);
  store.setShareToken(data.share_token);
  store.markClean();
}
```

If the share token is not found (expired or invalid), a friendly error screen is
shown with a "Start a new layout" CTA.

### 8.4 Auto-save Consideration

Auto-save (debounced write on every store mutation) is **not** implemented in V1.
The explicit "Save" action gives the user control and avoids creating partial layouts
on Supabase.  This decision should be revisited in Phase 2 if user feedback shows
layouts being lost.

---

## 9. Assessment of High-Quality Ideas

### 9.1 Walk-through Mode — First-Person Navigation

**Recommendation: Phase 2**

Three.js `PointerLockControls` natively supports first-person navigation and this
is technically straightforward to add.  However:

- It adds a full new interaction paradigm (mouse capture, WASD navigation) that
  requires UX design, keyboard accessibility handling, and mobile consideration.
- The V1 scope is already substantial.
- Value is highest for B2B buyers presenting to directors — this is a compelling
  Phase 2 feature for that use case.

**Phase 2 note:** The scene graph is already structured to support this.  A
"Walk-through mode" button can be added to the toolbar without architectural changes.
The camera controller simply switches to `PointerLockControls`.  No architecture
debt is created by deferring this.

### 9.2 Dimension Overlays — Live Dimension Labels

**Recommendation: Version 1 — already in scope**

Dimension overlays are confirmed in the V1 scope and are architecturally described
in §5.7.  They are implemented as `CSS2DObject` labels in the Three.js scene.  They
update reactively from store state on every `moveBay` or `rotateBay` action.

This is a high-value feature for both B2B buyers (precision layout verification)
and prosumers (confirms the rack fits their space).  Implementation cost is moderate
and is included in the build estimate.

### 9.3 Floor Plan Import — Image Upload / Room Dimension Scanning

**Recommendation: Phase 2**

Manual room dimension entry (width, depth, height inputs) is V1.

Full floor plan import — uploading an image and auto-tracing walls — requires
ML/computer vision (e.g. a floor plan parsing model, or a service like Matterport
or Planner 5D's scan integration).  This is non-trivial and is outside V1 scope.

**Phase 2 scope:** Integrate a lightweight floor plan tracing tool (e.g.
[floorplanner.com API](https://floorplanner.com) or a custom canvas-based tracing
tool where users click to define walls).  The Supabase `room_data` schema is
intentionally kept simple in V1 to allow expansion without migration.

### 9.4 Configuration Presets — Pre-Built Starter Layouts

**Recommendation: Version 1 — already in scope**

Presets are confirmed in V1 scope.  They are architecturally described in §7.4 and
data-modelled in §3.3.  Four presets are seeded in `supabase/seed.sql`.

Presets are the primary conversion driver for the Prosumer mode.  A non-technical
user picking from "Garage wall storage" or "Workshop corner" immediately has a
plausible layout they can modify — significantly reducing drop-off versus a blank
canvas.  Implementation cost is low (the planner engine already exists; presets are
just data).

### 9.5 Snap-to-Grid with Collision Detection

**Recommendation: Version 1 — already in scope**

Snap-to-grid and AABB collision detection are confirmed in V1 scope and architecturally
described in §5.5.  They are essential correctness features — without them, the
planner can produce physically impossible layouts (overlapping bays, bays outside
room bounds).  Implementation cost is moderate and is included in the build estimate.

---

## 10. Revised Build Estimate

### 10.1 Basis for Revision

The original estimate was 128–182 hours.  The following confirmed additions to scope
drive the revision:

| Addition | Hours added |
|---|---|
| Fully editable 3D (click-select, drag-move, snap, collision) | +28 |
| 2D / 3D toggle with orthographic camera sync | +16 |
| Dimension overlays (CSS2DObject, all label types) | +12 |
| Shopify Markets (`@inContext` directive, market detection, currency display) | +10 |
| Two entry modes with full onboarding flows | +12 |
| Total additions | +78 |

### 10.2 Revised Estimate by Module

| Module | Hours |
|---|---|
| Project scaffolding (Vite, React 19, TypeScript, Tailwind, Zustand) | 8 |
| Three.js / R3F scene setup — room, lights, camera, grid | 12 |
| GLB model loading + InstancedMesh optimisation | 12 |
| Click-to-select (raycasting, selection state, outline effect) | 8 |
| Drag-to-move with TransformControls + snap-to-grid | 12 |
| AABB collision detection + back-to-back exception | 8 |
| 2D mode (orthographic camera, mode toggle, GSAP transition) | 16 |
| Dimension overlays — CSS2DObject, all label types, live update | 12 |
| Zustand store — all five slices, derived BOM hook | 10 |
| Left panel UI — dimensions, catalogue, accessories tabs | 16 |
| Shopify Storefront API client + product query + Shopify Markets | 14 |
| Live pricing display + stock status badges | 6 |
| Cart mutation + BOM generation + checkout redirect | 10 |
| Cart summary right panel (SKU list, totals, Add to Cart) | 10 |
| B2B entry mode — onboarding flow, room setup | 10 |
| Prosumer entry mode — space type, preset picker, guided config | 10 |
| Preset system — Supabase seed, fetch, apply to scene | 8 |
| Save layout (Supabase upsert, dirty tracking, toast) | 8 |
| Share link — URL generation, share modal, load from token | 8 |
| Supabase schema + migrations + RLS policies | 4 |
| Environment configuration + Vercel deployment pipeline | 4 |
| Unit tests — store slices, BOM, snap/collision logic | 12 |
| Integration tests — Shopify cart flow, save/load layout | 8 |
| UI polish — transitions, loading states, error handling | 12 |
| QA, cross-browser testing, checkout flow (IE + UK) | 16 |
| **Total** | **234** |

### 10.3 Summary

| Scenario | Hours |
|---|---|
| Original estimate (mid-range) | 155 |
| Revised estimate (low) | 210 |
| Revised estimate (mid) | 234 |
| Revised estimate (high) | 258 |

At a 40-hour working week, the mid estimate is **5.9 weeks of development time**.
The 8-week build plan (§12) accounts for review cycles, QA loops, and scope
clarification overhead.

---

## 11. Environment Variables

Complete list of all required environment variables.  All are prefixed with
`VITE_` to be accessible in the Vite browser bundle.

```bash
# .env.example

# ─── Shopify ───────────────────────────────────────────────────────────────
# Storefront API endpoint (single store + Shopify Markets)
VITE_SHOPIFY_STOREFRONT_ENDPOINT=https://rackzone.ie/api/2024-10/graphql.json

# Public Storefront API access token (safe to expose in browser)
VITE_SHOPIFY_STOREFRONT_TOKEN=

# ─── Supabase ──────────────────────────────────────────────────────────────
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# ─── Application ───────────────────────────────────────────────────────────
# Base URL used for share link generation
VITE_APP_BASE_URL=https://planner.rackzone.ie

# Default market when none can be detected from hostname
# IE = Ireland (EUR) | GB = United Kingdom (GBP)
VITE_DEFAULT_MARKET=IE

# Snap grid resolution in millimetres
# 100 for longspan shelving; 600 for pallet racking bay pitch
VITE_GRID_SIZE_MM=100
```

**Notes:**
- The Shopify Storefront token is intentionally public — this is Shopify's
  designed access model for frontend applications.
- If two separate Shopify stores are confirmed (OQ-1), add:
  `VITE_SHOPIFY_STOREFRONT_ENDPOINT_UK` and `VITE_SHOPIFY_STOREFRONT_TOKEN_UK`.
- `VITE_SUPABASE_ANON_KEY` is the anon/public key, safe to expose.
  The service role key must never be in the frontend bundle.
- No secrets are in this file.  All values are either public keys or
  non-sensitive configuration.

---

## 12. Phase 1 Build Plan — Week by Week

### Week 1 — Foundation

**Goal:** Deployable skeleton with Three.js scene rendering a room and placeholder
bay.

- [ ] Initialise Vite + React 19 + TypeScript + Tailwind 4 project
- [ ] Install and configure R3F, drei, Zustand
- [ ] Implement three-panel AppShell (left / centre / right)
- [ ] Basic Three.js scene: room box, ambient + directional light, grid helper
- [ ] Load one GLB model from `models/glb/` using `useGLTF`
- [ ] Zustand `layoutSlice` — room, bays, selectedBayId
- [ ] Vercel project created; preview deployments on every push to branch
- [ ] `.env.example` and Supabase project initialised

**Exit criterion:** A rack bay GLB renders in a room on the Vercel preview URL.

### Week 2 — Editable 3D Scene

**Goal:** Full click-select + drag-move + snap + collision working in 3D.

- [ ] `BayMesh` with R3F `onClick` → `setSelectedBay`
- [ ] `SelectionOutline` via `@react-three/postprocessing`
- [ ] `TransformControls` (translate + rotate modes) on selected bay
- [ ] `useSnapToGrid` hook — snap on drag
- [ ] Room bounds clamping on drag
- [ ] `useCollisionDetection` hook — AABB overlap detection
- [ ] Add / remove bay from left panel (placeholder UI)
- [ ] Rotation constrained to Y-axis, snapped to 90°

**Exit criterion:** Bays can be placed, selected, dragged, snapped, and
blocked by collision in the 3D view.

### Week 3 — 2D Mode + Dimension Overlays

**Goal:** Seamless 2D/3D toggle; all dimension labels live.

- [ ] `CameraController` — perspective vs orthographic configurations
- [ ] GSAP camera tween on mode toggle (600 ms)
- [ ] Toolbar 2D/3D toggle button
- [ ] `CSS2DRenderer` setup alongside WebGL renderer
- [ ] `DimensionLabel` component (CSS2DObject)
- [ ] `DimensionOverlays` — per-bay, aisle, and room footprint labels
- [ ] Labels update reactively on `moveBay`, `rotateBay`, `setRoom`
- [ ] Wall planes hidden in 2D mode, visible in 3D

**Exit criterion:** Toggle between 2D and 3D; dimension labels are visible
and accurate in both modes.

### Week 4 — Shopify Integration

**Goal:** Live product catalogue and working Add to Cart.

- [ ] `graphql-request` client configured with Storefront token
- [ ] `GetPlannerProducts` query with `@inContext(country: $country)`
- [ ] Market detection from hostname; `cartSlice.market` initialised
- [ ] `catalogueSlice` — fetch, normalise, store products/variants
- [ ] Left panel product catalogue with variant picker
- [ ] `StockBadge` — availableForSale + quantityAvailable
- [ ] `useBOM` hook — derive line items from store.bays
- [ ] `CartCreate` mutation → `checkoutUrl`
- [ ] "Add all to cart" button → redirect to Shopify checkout
- [ ] Verified on IE market (EUR) and UK market (GBP)

**Exit criterion:** Full product → place in scene → Add to Cart → Shopify
checkout flow works end-to-end for both markets.

### Week 5 — Entry Modes + Presets

**Goal:** Both mode flows working; presets load correctly.

- [ ] Supabase `presets` table created, migration run, seed data loaded
- [ ] `ModeSelector` landing screen
- [ ] `B2BFlow` — room dimension step → planner
- [ ] `ProsumerFlow` — space type → preset picker → configured planner
- [ ] `PresetPicker` modal — thumbnails, descriptions, price range preview
- [ ] `store.loadLayout` clears and replaces scene from preset data

**Exit criterion:** Both entry modes navigable end-to-end; preset layouts
load and are immediately editable.

### Week 6 — Save / Share

**Goal:** B2B layouts persist and are shareable.

- [ ] Supabase `layouts` table created, migration run, RLS verified
- [ ] `sessionSlice` — saveLayout, loadLayout, isDirty tracking
- [ ] "Save layout" toolbar action with name prompt
- [ ] "Unsaved changes" indicator
- [ ] Share modal — copyable URL (`?layout=<token>`)
- [ ] App mount: read `?layout=<token>` → fetch → restore scene
- [ ] 404/expired layout error screen
- [ ] Optional email capture in save modal (mailto: link)

**Exit criterion:** Save a layout, copy the share link, open in a new tab,
confirm the layout is identical.

### Week 7 — UI Polish + Integration QA

**Goal:** Production-quality UI and end-to-end QA pass.

- [ ] Loading states on all async operations (catalogue fetch, cart, save)
- [ ] Error handling — Shopify errors, Supabase errors, network errors
- [ ] Responsive layout (minimum: 1280px wide desktop — mobile is out of scope)
- [ ] Keyboard shortcuts: Delete to remove bay, Escape to deselect
- [ ] GSAP transitions on panel tabs and modals
- [ ] Full E2E test pass: B2B flow, Prosumer flow, Share flow, Add to Cart (IE + UK)
- [ ] Cross-browser: Chrome, Firefox, Safari (latest)
- [ ] Performance audit: Three.js render budget, catalogue load time

**Exit criterion:** All flows pass QA.  No console errors in production build.

### Week 8 — Launch Preparation

**Goal:** Production environment live and signed off.

- [ ] Production environment variables set in Vercel
- [ ] Custom domain configured (`planner.rackzone.ie`)
- [ ] Shopify Storefront token scoped to production domain
- [ ] Final stakeholder review session
- [ ] Advisory board sign-off
- [ ] Launch

---

## 13. Open Questions — Decisions Required Before Build Starts

The following questions must be resolved before the Senior Developer begins
implementation.  Items marked **(blocking)** prevent build from starting or will
require rework if decided after build begins.

| ID | Status | Question |
|---|---|---|
| OQ-1 | **Blocking** | Single Shopify store with Shopify Markets, or two separate stores (rackzone.ie and rackzone.co.uk)?  If two stores, the Storefront API client needs two endpoint/token pairs and market-based routing. |
| OQ-2 | **Blocking** | How is the planner linked from rackzone.ie and rackzone.co.uk?  Linked as external tool (`planner.rackzone.ie`), embedded via iframe, or integrated into Shopify theme?  This affects market detection and CORS configuration. |
| OQ-3 | Deferred | Should B2B layouts require account creation, or are they saved anonymously (UUID + share token)?  Anonymous is simpler for V1 but prevents "my saved layouts" history. |
| OQ-4 | **Blocking** | What Shopify tag or collection identifies products included in the 3D planner?  `3d-planner` tag is the recommended convention. |
| OQ-5 | **Blocking** | What metafields exist (or need to be created) on Shopify products for planner-specific data?  Recommended schema is in §4.4.  Metafields must be created in Shopify admin before the catalogue query works. |
| OQ-6 | Deferred | Are all product variants covered by a GLB model, or are some variants represented by the same GLB with different materials/colours?  This affects the asset pipeline. |
| OQ-7 | **Blocking** | What is the physical snap grid resolution?  Recommendation: configurable via `VITE_GRID_SIZE_MM`; default 100 mm.  Confirm with RackZone product team — pallet racking may need 600 mm pitch. |
| OQ-8 | Deferred | Are minimum aisle width rules enforced in the planner (e.g. 2400 mm forklift clearance)?  If yes, these are named constraints in the collision detection hook and require a separate visual warning. |
| OQ-9 | Deferred | Should saved layouts expire?  If yes, how long?  `expires_at` column is present in the schema.  No expiry is the V1 default. |
| OQ-10 | Deferred | Where are GLB model files hosted?  Options: (a) bundled in the repo and served from Vercel, (b) Supabase Storage, (c) Shopify CDN.  Repo is currently the approach; this is fine for V1 but may not scale if the catalogue grows to 50+ models. |
| OQ-11 | Deferred | Should the prosumer mode have a simplified left panel (hiding advanced options), or the full B2B panel?  Current design: simplified panel, individual bay editing still available by clicking in scene. |

---

## 14. Reference Products — Interaction Standards

The following products were studied as part of this architecture process.
Key learnings that directly shaped architectural decisions are noted.

| Tool | URL | Key Learning Applied |
|---|---|---|
| TOPREGAL Configurator | topregal.com/en/pallet-racks/configurator | Left-panel configuration UX pattern; real-time price updates; limitation identified: their 3D is viewer-only — ours is fully editable |
| Shelving Inc. 3D Builder | shelving.com/pages/pallet-rack-builder | SKU/variant → cart flow; BOM-first add-to-cart approach |
| Roomle Shopify Configurator | roomle.com/en/shopify-configurator | Click-to-select-and-edit in 3D; Shopify cart integration; `CSS2DObject` label approach |
| Floorplanner | floorplanner.com | Orthographic camera for 2D mode; seamless toggle; both modes remain fully editable (confirmed Option B in §5.1) |
| IKEA Kitchen Planner | ikea.com/ie/en/planner/kitchen-planner | Snap behaviour; panel updates in sync with scene; non-technical user polish benchmark |
| Planner 5D | planner5d.com/app | Grid-snap in 2D reflected in 3D; object placement and collision UX |
| react-planner | cvdlab.github.io/react-planner | Plugin architecture studied; assessed as reference-only (§1.3) |

---

*End of document.*

*This architecture document was produced for the RackZone 3D Planner Version 1.*
*Advisory board review and sign-off required before build begins.*





