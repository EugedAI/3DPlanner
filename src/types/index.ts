export interface ProductVariant {
  id: string
  sku: string
  price: number
  availableForSale: boolean
  width: number        // mm, from custom.width
  height: number       // mm, from custom.height
  depth: number        // mm, from custom.depth
  numberOfShelves: number
  numberOfLevels: number
  kgPerShelf: number
  frameMaterial: string
  frameCoating: string
  shelfType: string
  compatibleShelfSku: string | null
}

export interface Product {
  id: string
  title: string
  handle: string
  imageUrl: string | null
  objectType: ObjectType
  variants: ProductVariant[]
}

export interface CartItem {
  instanceId: string
  sku: string
  title: string
  price: number
  quantity: number
  objectType: ObjectType
  // Position in metres (set when placed in scene)
  x?: number
  z?: number
  // Variant dimensions in mm (needed for collision detection)
  variantWidth?: number
  variantDepth?: number
  variantHeight?: number
  numberOfShelves?: number
  numberOfLevels?: number
  compatibleShelfSku?: string | null
}

export type CameraMode = '2d' | '3d'
export type ObjectType = 'starter' | 'extender' | 'shelf' | 'accessory'
