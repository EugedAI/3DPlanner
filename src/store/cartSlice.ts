import type { CartItem } from '../types'

export interface CartSlice {
  cartId: string | null
  lineItems: CartItem[]
  subtotal: number
  checkoutUrl: string | null
  validationError: string | null

  setCartId: (cartId: string | null) => void
  setLineItems: (lineItems: CartItem[]) => void
  setSubtotal: (subtotal: number) => void
  setCheckoutUrl: (url: string | null) => void
  setValidationError: (error: string | null) => void
}

export const createCartSlice = (
  set: (fn: (state: CartSlice) => Partial<CartSlice>) => void,
): CartSlice => ({
  cartId: null,
  lineItems: [],
  subtotal: 0,
  checkoutUrl: null,
  validationError: null,

  setCartId(cartId) {
    set(() => ({ cartId }))
  },

  setLineItems(lineItems) {
    set(() => ({ lineItems }))
  },

  setSubtotal(subtotal) {
    set(() => ({ subtotal }))
  },

  setCheckoutUrl(url) {
    set(() => ({ checkoutUrl: url }))
  },

  setValidationError(error) {
    set(() => ({ validationError: error }))
  },
})
