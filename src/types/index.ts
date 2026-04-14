// ─── Product / Catalogue Types ───────────────────────────────────────────────

export type ObjectType = 'starter' | 'extender' | 'shelf' | 'accessory'

export interface ProductMetafields {
  width: number           // mm
  height: number          // mm
  depth: number           // mm
  number_of_shelves: number
  number_of_levels: number
  kg_per_shelf: number
  frame_material: string
  frame_coating: string
  shelf_type: string
  object_type: ObjectType
  compatible_shelf_sku: string
}

export interface ProductVariant {
  id: string
  sku: string
  price: string
  availableForSale: boolean
  metafields: ProductMetafields
}

export interface Product {
  id: string
  title: string
  handle: string
  images: Array<{ url: string; altText: string | null }>
  variants: ProductVariant[]
}

// ─── Scene / Layout Types ────────────────────────────────────────────────────

export interface BayDimensions {
  width: number   // mm
  height: number  // mm
  depth: number   // mm
}

export interface PlacedBay {
  id: string
  objectType: ObjectType
  variantId: string
  sku: string
  dimensions: BayDimensions
  position: { x: number; y: number; z: number }
  rowIndex: number
  colIndex: number
  shelfCount: number
  frameMaterial: string
  frameCoating: string
}

export interface PlacedAccessory {
  id: string
  variantId: string
  sku: string
  position: { x: number; y: number; z: number }
}

export interface SceneState {
  bays: PlacedBay[]
  accessories: PlacedAccessory[]
  selectedId: string | null
  validationErrors: ValidationError[]
}

export interface ValidationError {
  rowIndex: number
  message: string
  type: 'missing_starter' | 'orphan_extender'
}

// ─── Config Types ─────────────────────────────────────────────────────────────

export interface ConfigState {
  activeProductId: string | null
  activeVariantId: string | null
  pendingShelfCount: number
}

// ─── Cart Types ───────────────────────────────────────────────────────────────

export interface CartLineItem {
  id: string
  variantId: string
  sku: string
  title: string
  quantity: number
  price: string
}

export interface CartState {
  shopifyCartId: string | null
  lines: CartLineItem[]
  checkoutUrl: string | null
  isLoading: boolean
  blockedByValidation: boolean
}

// ─── UI Types ─────────────────────────────────────────────────────────────────

export type CameraMode = '2d' | '3d'

export interface UIState {
  cameraMode: CameraMode
  leftPanelVisible: boolean
  rightPanelVisible: boolean
  activeModal: string | null
}

// ─── Market Types ─────────────────────────────────────────────────────────────

export type MarketCode = 'IE'
export type CurrencyCode = 'EUR'

export interface MarketState {
  market: MarketCode
  currency: CurrencyCode
  locale: string
}

// ─── Supabase Table Mirrors ───────────────────────────────────────────────────

export interface LayoutRow {
  id: string
  user_id: string
  market: MarketCode
  name: string
  scene_json: unknown
  created_at: string
  updated_at: string
}

export interface PresetRow {
  id: string
  market: MarketCode
  name: string
  description: string
  scene_json: unknown
  created_at: string
}
