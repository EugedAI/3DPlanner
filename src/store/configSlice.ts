import type { StateCreator } from 'zustand'
import type { ConfigState } from '@/types'
import type { RootStore } from './index'

export interface ConfigSlice {
  config: ConfigState
  setActiveProduct: (productId: string | null, variantId: string | null) => void
  setPendingShelfCount: (count: number) => void
}

const initialConfigState: ConfigState = {
  activeProductId: null,
  activeVariantId: null,
  pendingShelfCount: 3,
}

export const createConfigSlice: StateCreator<
  RootStore,
  [],
  [],
  ConfigSlice
> = (set) => ({
  config: initialConfigState,

  setActiveProduct: (productId, variantId) =>
    set((s) => ({
      config: { ...s.config, activeProductId: productId, activeVariantId: variantId },
    })),

  setPendingShelfCount: (count) =>
    set((s) => ({ config: { ...s.config, pendingShelfCount: count } })),
})
