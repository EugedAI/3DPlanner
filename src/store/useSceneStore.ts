import { create } from 'zustand'
import type { CameraMode, Product, CartItem } from '../types'

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

  // Derived subtotal (not stored, computed from cartItems)
  getSubtotal: () => number

  // Validation
  validationError: string | null
  setValidationError: (error: string | null) => void
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

  getSubtotal: () => {
    const { cartItems } = get()
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  },

  validationError: null,
  setValidationError: (error) => set({ validationError: error }),
}))
