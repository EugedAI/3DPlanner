// ============================================================
// SHARED TYPESCRIPT INTERFACES — mirrors index.html data structures
// ============================================================

/** Camera view mode */
export type CameraMode = '2d' | '3d'

/** Product object type classification */
export type ObjectType = 'starter' | 'extender' | 'shelf' | 'accessory'

/** Room type preset */
export type RoomType = 'warehouse' | 'garage' | 'office' | 'home'

/**
 * Product — mirrors ProductCatalogue product shape in rackzone-planner.html.
 * shopifyVariantId is populated when Shopify integration is wired up.
 */
export interface Product {
  id: string
  name: string
  sku: string
  category: string
  roomTypes: RoomType[]
  width: number
  depth: number
  height: number
  price: number
  imageUrl: string | null
  modelUrl: string | null
  shopifyVariantId: string | null
}

/**
 * RoomItem — a placed product instance in the scene.
 * mesh field holds the Three.js Group reference (not serialised).
 */
export interface RoomItem {
  instanceId: number
  productId: string
  name: string
  sku: string
  category: string
  width: number
  depth: number
  height: number
  shopifyVariantId: string | null
  x: number
  z: number
  rotation: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mesh: any | null  // THREE.Group — typed loosely to avoid circular Three.js import
}

/** CartItem — a line item ready for Shopify */
export interface CartItem {
  shopifyVariantId: string
  quantity: number
  productId: string
  name: string
  unitPrice: number
}
