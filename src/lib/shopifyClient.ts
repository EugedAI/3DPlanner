// ============================================================
// SHOPIFY CLIENT — stub
// No real API calls in this migration phase.
// All functions mirror ShopifyBridge in rackzone-planner.html.
// ============================================================

import type { CartItem } from '../types'

/** Initialise the Storefront API client (stub) */
export function initShopify(): void {
  // TODO: SHOPIFY — setup Storefront API client
  // Use @shopify/hydrogen-react StorefrontClient
  // Endpoint: https://{store}.myshopify.com/api/2024-01/graphql.json
}

/** Fetch products and prices from Storefront API (stub) */
export async function fetchShopifyProducts(): Promise<void> {
  // TODO: SHOPIFY — GraphQL query for products by SKU
  return Promise.resolve()
}

/** Add items to Shopify cart (stub) */
export async function addToCart(_lineItems: CartItem[]): Promise<void> {
  // TODO: SHOPIFY — cartCreate / cartLinesAdd mutations
  return Promise.resolve()
}

/** Save layout to user account (stub) */
export async function saveLayoutToAccount(_layoutData: unknown): Promise<void> {
  // TODO: SHOPIFY — POST layout JSON to backend
  return Promise.resolve()
}
