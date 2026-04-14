import type { Product } from '../types'

export interface ConfigSlice {
  products: Product[]
  loading: boolean
  error: string | null

  setProducts: (products: Product[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const createConfigSlice = (
  set: (fn: (state: ConfigSlice) => Partial<ConfigSlice>) => void,
): ConfigSlice => ({
  products: [],
  loading: false,
  error: null,

  setProducts(products) {
    set(() => ({ products }))
  },

  setLoading(loading) {
    set(() => ({ loading }))
  },

  setError(error) {
    set(() => ({ error }))
  },
})
