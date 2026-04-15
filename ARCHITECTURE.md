# RackZone 3D Planner — Architecture

> **Migration complete.** Vanilla JS monolith (index.html / rackzone-planner.html)
> migrated to Vite + React + TypeScript + Zustand. Completed April 2026.
> index.html and rackzone-planner.html are retired legacy files pending deletion.

---

## 1. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Build tool | Vite | 6.x |
| UI | React | 18.x |
| Language | TypeScript | 5.x |
| State | Zustand | 5.x |
| 3D | Three.js | 0.170.x |
| Entry point | app.html | — |

**Entry point:** `app.html` (Vite) → `src/main.tsx` → `<App />`

---

## 2. Directory Structure

```
3DPlanner/
├── app.html                   # Vite entry — replaces legacy index.html
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── src/
│   ├── main.tsx               # React root mount
│   ├── App.tsx                # Three-panel layout, toolbar, 2D/3D toggle
│   ├── index.css              # CSS custom properties, global styles
│   ├── vite-env.d.ts
│   ├── types/
│   │   └── index.ts           # Product, ProductVariant, CartItem, CameraMode, ObjectType
│   ├── store/
│   │   └── useSceneStore.ts   # Zustand store — all app state + actions
│   ├── lib/
│   │   ├── devCatalogue.ts    # 4 hardcoded dev products (real SKUs)
│   │   └── roomUtils.ts       # Pure typed utility functions (no side effects)
│   └── components/
│       ├── ThreeScene.tsx     # Three.js scene, cameras, controls, bay meshes
│       ├── LeftPanel.tsx      # Product catalogue, shelf controls
│       └── RightPanel.tsx     # Cart, subtotal, validation UI, Add to Cart
├── models/                    # GLB assets (Phase 2)
├── index.html                 # RETIRED — legacy vanilla JS entry
└── rackzone-planner.html      # RETIRED — legacy vanilla JS monolith
```

---

## 3. State Management (Zustand)

All application state lives in `src/store/useSceneStore.ts`.

### State shape

| Field | Type | Description |
|---|---|---|
| `cameraMode` | `'2d' \| '3d'` | Current camera view |
| `roomWidth` | `number` | Room width in metres |
| `roomDepth` | `number` | Room depth in metres |
| `selectedId` | `string \| null` | Currently selected bay instance ID |
| `products` | `Product[]` | Loaded product catalogue |
| `loading` | `boolean` | Catalogue loading state |
| `error` | `string \| null` | Catalogue error |
| `pendingPlacement` | `Product \| null` | Set by LeftPanel, consumed by ThreeScene |
| `cartItems` | `CartItem[]` | All placed items (bays + shelf line items) |
| `validationError` | `string \| null` | Layout validation error message |

### High-level actions

| Action | Description |
|---|---|
| `placeItem(product, variant, x, z, instanceId)` | Bounds + collision check, determines starter/extender, appends CartItem, validates |
| `removeItem(instanceId)` | Removes item, auto-promotes leftmost extender to starter if needed, validates |
| `updateShelfCount(instanceId, delta)` | +1 / -1 shelf, enforces min/max, manages compatible shelf CartItem line |

### Derived

- `getSubtotal()` — computed from `cartItems`, not stored

---

## 4. Types (`src/types/index.ts`)

```ts
ProductVariant  // Shopify variant shape + custom metafields
Product         // Shopify product + objectType
CartItem        // Placed instance with position, dimensions, live shelf count
CameraMode      // '2d' | '3d'
ObjectType      // 'starter' | 'extender' | 'shelf' | 'accessory'
```

`CartItem` carries position (`x`, `z`), dimensions (`variantWidth`, `variantDepth`,
`variantHeight`), and live state (`currentShelves`) needed for collision detection,
row grouping, and mesh rebuilding.

---

## 5. Room Utilities (`src/lib/roomUtils.ts`)

Pure functions — no side effects, no Three.js imports:

| Function | Description |
|---|---|
| `isWithinBounds(x, z, variant, roomWidth, roomDepth)` | Boundary check (returns boolean) |
| `hasCollision(x, z, variant, items, excludeId?)` | AABB collision check (returns boolean) |
| `getEquidistantSpacing(height, shelfCount)` | height ÷ (shelfCount + 1) in metres |
| `validateLayout(items)` | Returns null (valid) or error string (row missing Starter) |

Row grouping uses a 50mm snap threshold on Z position.

---

## 6. Three.js Scene (`src/components/ThreeScene.tsx`)

- `buildBayMesh(variant, objectType, instanceId, currentShelves?)` — procedural geometry:
  - Frame colour from `frameCoating` (powder-coated → #C0C0C0, timber → #C4A265)
  - Uprights: 40mm BoxGeometry; left upright omitted on extenders
  - Shelves: 20mm thick, equidistant spacing via `getEquidistantSpacing()`
  - `userData`: carries `instanceId`, `objectType`, dimensions, shelf limits
- Cameras: PerspectiveCamera (3D) + OrthographicCamera (2D top-down)
- Controls: OrbitControls — rotate disabled in 2D mode
- Click-to-select: Raycaster → walks parent chain to find `instanceId`
- Placement: consumed from `pendingPlacement`, calls `placeItem()` Zustand action
- Removal: `useEffect` watches `cartItems`, disposes meshes for removed items
- Validation highlight: amber emissive on invalid bays when `validationError !== null`

---

## 7. Left Panel (`src/components/LeftPanel.tsx`)

- Loads `DEV_CATALOGUE` on mount, writes to Zustand `products`
- Product cards grouped by `objectType` in fixed order: Starter → Extender → Shelf → Accessory
- Place button sets `pendingPlacement` in Zustand
- When `selectedId` matches a bay: shows `ShelfControls` with + / − buttons
  - Disabled at `numberOfShelves` (min) and `numberOfLevels` (max)
  - Calls `updateShelfCount(selectedId, delta)`

---

## 8. Right Panel (`src/components/RightPanel.tsx`)

- Cart table shows placed bays and extra shelf line items separately
- Per-row × remove button calls `removeItem(instanceId)` Zustand action
- Two validation notice types:
  - **Auto-resolve** (blue/neutral, dismissible): shown when starter was auto-promoted
  - **Structural error** (red/amber, persistent): shown when row has no starter
- "Add Starter to fix layout" button: computes affected row, calls `placeItem()`
- "Add to Shopify Cart" disabled when cart is empty or structural error present

---

## 9. Product Catalogue (`src/lib/devCatalogue.ts`)

Four hardcoded dev products with real SKUs:

| SKU | Type | Price |
|---|---|---|
| LSS2012803S | Starter Bay 1200×2000×800mm | €325 |
| LSS2012803X | Extender Bay 1200×2000×800mm | €280 |
| LSSL12801L | Extra Level Shelf 1200×800mm | €105 |
| LSPS1230 | Picking Station Accessory | €0 |

Phase 2 will replace this with a live Shopify Storefront API fetch.

---

## 10. Placement & Validation Logic

### Placement flow
1. User clicks "Place in Room" → sets `pendingPlacement` in Zustand
2. `ThreeScene` `useEffect` consumes `pendingPlacement`:
   - Calculates position (adjacent to rightmost item in last row, or room centre)
   - Calls `placeItem()` — runs bounds and collision checks, aborts if invalid
   - Determines `objectType` (starter if row empty, extender if row occupied)
   - Builds procedural mesh, adds to `itemsGroup`
3. `setPendingPlacement(null)` clears the trigger

### Row model
- A "row" is a group of bays sharing the same Z position within 50mm
- Each row must have exactly one starter (leftmost bay)
- Extender bays share the right upright of their left neighbour (no left upright rendered)

### Validation
- `validateLayout()` checks all rows for a starter
- Result written to `validationError` by `placeItem()`, `removeItem()`, `updateShelfCount()`
- Auto-resolve: when a starter is removed and extenders remain, leftmost extender is promoted to starter
- Structural error: when no auto-resolve is possible, `validationError` is set and UI highlights affected bays in amber

### Shelf management
- Default shelf count = `variant.numberOfShelves` (floor)
- Maximum = `variant.numberOfLevels`
- Extra shelves above default add compatible SKU (`LSSL12801L`) as a separate CartItem line
- Removing extra shelves back to default removes the shelf line item

---

## 11. Phase 2 Roadmap (not implemented)

- Shopify Storefront API fetch replacing `devCatalogue.ts`
- GLB model loading (DRACO-compressed) replacing procedural geometry
- Real Shopify cart mutation in RightPanel
- Drag-to-position and rotation (90° snapping)
- Room dimension controls wired to UI
- Save/restore layout (localStorage or Shopify metafields)
