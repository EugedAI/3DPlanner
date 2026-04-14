import { create } from 'zustand'
import { createSceneSlice, type SceneSlice } from './sceneSlice'
import { createConfigSlice, type ConfigSlice } from './configSlice'
import { createCartSlice, type CartSlice } from './cartSlice'
import { createUiSlice, type UiSlice } from './uiSlice'
import { createMarketSlice, type MarketSlice } from './marketSlice'

// ============================================================
// COMBINED STORE
// BOM / totals are derived from scene items — not stored.
// ============================================================

export type AppStore = SceneSlice & ConfigSlice & CartSlice & UiSlice & MarketSlice

export const useStore = create<AppStore>()((set, get) => ({
  ...createSceneSlice(
    set as (fn: (state: SceneSlice) => Partial<SceneSlice>) => void,
    get as () => SceneSlice,
  ),
  ...createConfigSlice(
    set as (fn: (state: ConfigSlice) => Partial<ConfigSlice>) => void,
  ),
  ...createCartSlice(
    set as (fn: (state: CartSlice) => Partial<CartSlice>) => void,
  ),
  ...createUiSlice(
    set as (fn: (state: UiSlice) => Partial<UiSlice>) => void,
  ),
  ...createMarketSlice(),
}))

// Re-export slice types
export type { SceneSlice, ConfigSlice, CartSlice, UiSlice, MarketSlice }
