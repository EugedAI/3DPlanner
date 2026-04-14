export type Market = 'IE'
export type Currency = 'EUR'

export interface MarketSlice {
  market: Market
  currency: Currency
}

export const createMarketSlice = (): MarketSlice => ({
  market: 'IE',
  currency: 'EUR',
})
