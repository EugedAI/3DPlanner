import { create } from 'zustand'
import { createSceneSlice, type SceneSlice } from './sceneSlice'
import { createConfigSlice, type ConfigSlice } from './configSlice'
import { createCartSlice, type CartSlice } from './cartSlice'
import { createUISlice, type UISlice } from './uiSlice'
import { createMarketSlice, type MarketSlice } from './marketSlice'

// ─── BOM (Bill of Materials) — derived state ──────────────────────────────────
//
// BOM is NOT stored in Zustand. It is computed on demand from scene.bays.
// Import computeBOM from @/lib/bom when needed.

export type RootStore = SceneSlice & ConfigSlice & CartSlice & UISlice & MarketSlice

export const useStore = create<RootStore>()((...a) => ({
  ...createSceneSlice(...a),
  ...createConfigSlice(...a),
  ...createCartSlice(...a),
  ...createUISlice(...a),
  ...createMarketSlice(...a),
}))

// Convenience selector hooks — avoid re-renders by selecting minimal state
export const useScene = () => useStore((s) => s.scene)
export const useConfig = () => useStore((s) => s.config)
export const useCart = () => useStore((s) => s.cart)
export const useUI = () => useStore((s) => s.ui)
export const useMarket = () => useStore((s) => s.market)
