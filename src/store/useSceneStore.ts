import { create } from 'zustand'
import type { CameraMode, Product, ProductVariant, CartItem } from '../types'
import {
  isWithinBounds,
  hasCollision,
  validateLayout,
} from '../lib/roomUtils'

// How close (metres) two items must be on Z to share a row
const ROW_SNAP_THRESHOLD = 0.05

interface SceneState {
  // Camera
  cameraMode: CameraMode
  setCameraMode: (mode: CameraMode) => void

  // Room dimensions (metres)
  roomWidth: number
  roomDepth: number
  setRoomWidth: (w: number) => void
  setRoomDepth: (d: number) => void

  // Selection
  selectedId: string | null
  setSelectedId: (id: string | null) => void

  // Product catalogue
  products: Product[]
  loading: boolean
  error: string | null
  setProducts: (products: Product[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Pending placement — set by LeftPanel click, consumed by ThreeScene
  pendingPlacement: Product | null
  setPendingPlacement: (product: Product | null) => void

  // Cart
  cartItems: CartItem[]
  addCartItem: (item: CartItem) => void
  removeCartItem: (instanceId: string) => void
  clearCart: () => void
  updateCartItem: (instanceId: string, patch: Partial<CartItem>) => void

  // Derived subtotal (not stored, computed from cartItems)
  getSubtotal: () => number

  // Validation
  validationError: string | null
  setValidationError: (error: string | null) => void

  // High-level Zustand actions

  /**
   * Place a product into the room.
   * Runs bounds + collision checks; aborts if either fails.
   * Determines starter vs extender from row occupancy.
   * Appends CartItem and re-validates.
   */
  placeItem: (
    product: Product,
    variant: ProductVariant,
    x: number,
    z: number,
    instanceId: string
  ) => boolean

  /**
   * Remove an item from the cart.
   * Auto-promotes leftmost extender to starter when a starter is deleted.
   * Re-validates after removal.
   */
  removeItem: (instanceId: string) => void

  /**
   * Add or remove one shelf from an item (+1/-1 delta).
   * Enforces min (numberOfShelves) and max (numberOfLevels).
   * Adds/removes compatible shelf CartItem line when crossing default.
   */
  updateShelfCount: (instanceId: string, delta: number) => void
}

export const useSceneStore = create<SceneState>((set, get) => ({
  cameraMode: '3d',
  setCameraMode: (mode) => set({ cameraMode: mode }),

  roomWidth: 20,
  roomDepth: 15,
  setRoomWidth: (w) => set({ roomWidth: w }),
  setRoomDepth: (d) => set({ roomDepth: d }),

  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),

  products: [],
  loading: false,
  error: null,
  setProducts: (products) => set({ products }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  pendingPlacement: null,
  setPendingPlacement: (product) => set({ pendingPlacement: product }),

  cartItems: [],
  addCartItem: (item) =>
    set((state) => {
      const existing = state.cartItems.find(
        (c) => c.sku === item.sku && c.instanceId === item.instanceId
      )
      if (existing) return state
      return { cartItems: [...state.cartItems, item] }
    }),
  removeCartItem: (instanceId) =>
    set((state) => ({
      cartItems: state.cartItems.filter((c) => c.instanceId !== instanceId),
    })),
  clearCart: () => set({ cartItems: [] }),
  updateCartItem: (instanceId, patch) =>
    set((state) => ({
      cartItems: state.cartItems.map((c) =>
        c.instanceId === instanceId ? { ...c, ...patch } : c
      ),
    })),

  getSubtotal: () => {
    const { cartItems } = get()
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  },

  validationError: null,
  setValidationError: (error) => set({ validationError: error }),

  // ── high-level actions ─────────────────────────────────────────────────────

  placeItem: (product, variant, x, z, instanceId) => {
    const { cartItems, roomWidth, roomDepth } = get()

    // Bounds check
    if (!isWithinBounds(x, z, variant, roomWidth, roomDepth)) return false

    // Collision check
    if (hasCollision(x, z, variant, cartItems)) return false

    // Determine objectType: starter if row is empty, extender if items exist in same row
    const rowItems = cartItems.filter(
      (i) =>
        (i.objectType === 'starter' || i.objectType === 'extender') &&
        Math.abs((i.z ?? 0) - z) <= ROW_SNAP_THRESHOLD
    )
    const objectType = rowItems.length === 0 ? 'starter' : 'extender'

    const newItem: CartItem = {
      instanceId,
      sku: variant.sku,
      title: product.title,
      price: variant.price,
      quantity: 1,
      objectType,
      x,
      z,
      variantWidth: variant.width,
      variantDepth: variant.depth,
      variantHeight: variant.height,
      numberOfShelves: variant.numberOfShelves,
      numberOfLevels: variant.numberOfLevels,
      compatibleShelfSku: variant.compatibleShelfSku,
    }

    const nextItems = [...cartItems, newItem]
    const validationError = validateLayout(nextItems)
    set({ cartItems: nextItems, validationError })
    return true
  },

  removeItem: (instanceId) => {
    const { cartItems } = get()
    const target = cartItems.find((i) => i.instanceId === instanceId)
    if (!target) return

    let nextItems = cartItems.filter((i) => i.instanceId !== instanceId)

    // Auto-promote: if the removed item was a starter, find same-row extenders
    if (target.objectType === 'starter') {
      const rowZ = target.z ?? 0
      const rowExtenders = nextItems
        .filter(
          (i) =>
            i.objectType === 'extender' &&
            Math.abs((i.z ?? 0) - rowZ) <= ROW_SNAP_THRESHOLD
        )
        .sort((a, b) => (a.x ?? 0) - (b.x ?? 0))

      if (rowExtenders.length > 0) {
        const leftmost = rowExtenders[0]
        nextItems = nextItems.map((i) =>
          i.instanceId === leftmost.instanceId
            ? { ...i, objectType: 'starter' }
            : i
        )
      }
    }

    const validationError = validateLayout(nextItems)
    set({
      cartItems: nextItems,
      validationError,
      // Deselect if removed item was selected
      selectedId: get().selectedId === instanceId ? null : get().selectedId,
    })
  },

  updateShelfCount: (instanceId, delta) => {
    const { cartItems } = get()
    const item = cartItems.find((i) => i.instanceId === instanceId)
    if (!item) return

    const current = item.numberOfShelves ?? 3
    const min = item.numberOfShelves ?? 3       // default from variant = hard floor
    const max = item.numberOfLevels ?? 5

    // The "default" count is stored as the original numberOfShelves on the CartItem.
    // We track the live shelf count in a separate field to avoid confusion.
    // Here we use a live count stored as `currentShelves` if present.
    const liveCount = (item as CartItem & { currentShelves?: number }).currentShelves ?? current
    const newCount = liveCount + delta

    if (newCount < min || newCount > max) return

    // Determine if we need to add/remove a compatible shelf line item
    const compatSku = item.compatibleShelfSku
    const extraCount = newCount - min  // shelves above default

    let nextItems = cartItems.map((i) =>
      i.instanceId === instanceId
        ? { ...i, currentShelves: newCount } as CartItem & { currentShelves: number }
        : i
    )

    if (compatSku) {
      const shelfLineId = `shelf-line-${instanceId}`
      const existingLine = nextItems.find((i) => i.instanceId === shelfLineId)

      if (extraCount > 0) {
        // Add or update shelf line item
        if (existingLine) {
          nextItems = nextItems.map((i) =>
            i.instanceId === shelfLineId ? { ...i, quantity: extraCount } : i
          )
        } else {
          // Find shelf product in products list for price
          const shelfProduct = get().products.find(
            (p) => p.variants[0]?.sku === compatSku
          )
          const shelfPrice = shelfProduct?.variants[0]?.price ?? 105
          nextItems = [
            ...nextItems,
            {
              instanceId: shelfLineId,
              sku: compatSku,
              title: `Extra Shelf — ${compatSku}`,
              price: shelfPrice,
              quantity: extraCount,
              objectType: 'shelf',
            },
          ]
        }
      } else {
        // Back to default — remove shelf line
        nextItems = nextItems.filter((i) => i.instanceId !== shelfLineId)
      }
    }

    set({ cartItems: nextItems })
  },
}))
