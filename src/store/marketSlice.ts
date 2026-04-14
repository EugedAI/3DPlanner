import type { StateCreator } from 'zustand'
import type { MarketState } from '@/types'
import type { RootStore } from './index'

export interface MarketSlice {
  market: MarketState
  // Market is fixed to IE/EUR for V1.
  // This slice exists to support future Markets/multi-currency without rebuild.
  // Do not expose a setter — market context is read-only in V1.
}

// IE / EUR fixed for V1. @inContext pattern applied in shopifyClient.
const initialMarketState: MarketState = {
  market: 'IE',
  currency: 'EUR',
  locale: 'en-IE',
}

export const createMarketSlice: StateCreator<
  RootStore,
  [],
  [],
  MarketSlice
> = () => ({
  market: initialMarketState,
})
