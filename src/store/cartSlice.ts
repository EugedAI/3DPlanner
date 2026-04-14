import type { StateCreator } from 'zustand'
import type { CartState, CartLineItem } from '@/types'
import type { RootStore } from './index'

export interface CartSlice {
  cart: CartState
  setCartId: (cartId: string, checkoutUrl: string) => void
  setCartLines: (lines: CartLineItem[]) => void
  setCartLoading: (isLoading: boolean) => void
  setCartBlocked: (blocked: boolean) => void
  clearCart: () => void
}

const initialCartState: CartState = {
  shopifyCartId: null,
  lines: [],
  checkoutUrl: null,
  isLoading: false,
  blockedByValidation: false,
}

export const createCartSlice: StateCreator<
  RootStore,
  [],
  [],
  CartSlice
> = (set) => ({
  cart: initialCartState,

  setCartId: (cartId, checkoutUrl) =>
    set((s) => ({ cart: { ...s.cart, shopifyCartId: cartId, checkoutUrl } })),

  setCartLines: (lines) =>
    set((s) => ({ cart: { ...s.cart, lines } })),

  setCartLoading: (isLoading) =>
    set((s) => ({ cart: { ...s.cart, isLoading } })),

  setCartBlocked: (blocked) =>
    set((s) => ({ cart: { ...s.cart, blockedByValidation: blocked } })),

  clearCart: () =>
    set(() => ({ cart: initialCartState })),
})
