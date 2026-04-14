/**
 * shopifyClient — Single abstraction layer for all Shopify Storefront API calls.
 *
 * RULES (enforced by architecture):
 *  - ALL Storefront API calls go through this module only.
 *  - No component may call Shopify directly — ever.
 *  - Read-only: no write methods here, ever. Cart mutations use cartCreate/cartLinesAdd.
 *  - @inContext directive applied to every query (market fixed to IE/EUR for V1).
 *  - Abstracted for future Markets support — add market param here, nowhere else.
 *
 * V1: IE / EUR only.
 */

const STOREFRONT_API_URL = import.meta.env.VITE_SHOPIFY_STOREFRONT_URL as string
const STOREFRONT_ACCESS_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN as string

// Market fixed to IE for V1. Future: accept market param here.
const MARKET_CONTEXT = `@inContext(country: IE, language: EN)`

interface GraphQLResponse<T> {
  data: T
  errors?: Array<{ message: string }>
}

async function storefront<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(STOREFRONT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    throw new Error(`Shopify Storefront API error: ${res.status} ${res.statusText}`)
  }

  const json = (await res.json()) as GraphQLResponse<T>

  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${json.errors.map((e) => e.message).join(', ')}`)
  }

  return json.data
}

// ─── Product Queries ──────────────────────────────────────────────────────────

/**
 * Fetch all products tagged `planner-compatible`.
 * Returns variants with all custom.* metafields required by the planner.
 */
const GET_PLANNER_PRODUCTS = /* GraphQL */ `
  query GetPlannerProducts ${MARKET_CONTEXT} {
    products(first: 250, query: "tag:planner-compatible") {
      edges {
        node {
          id
          title
          handle
          images(first: 5) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 20) {
            edges {
              node {
                id
                sku
                availableForSale
                price {
                  amount
                  currencyCode
                }
                metafields(
                  identifiers: [
                    { namespace: "custom", key: "width" }
                    { namespace: "custom", key: "height" }
                    { namespace: "custom", key: "depth" }
                    { namespace: "custom", key: "number_of_shelves" }
                    { namespace: "custom", key: "number_of_levels" }
                    { namespace: "custom", key: "kg_per_shelf" }
                    { namespace: "custom", key: "frame_material" }
                    { namespace: "custom", key: "frame_coating" }
                    { namespace: "custom", key: "shelf_type" }
                    { namespace: "custom", key: "object_type" }
                    { namespace: "custom", key: "compatible_shelf_sku" }
                  ]
                ) {
                  key
                  value
                }
              }
            }
          }
        }
      }
    }
  }
`

export interface StorefrontProduct {
  id: string
  title: string
  handle: string
  images: { edges: Array<{ node: { url: string; altText: string | null } }> }
  variants: {
    edges: Array<{
      node: {
        id: string
        sku: string
        availableForSale: boolean
        price: { amount: string; currencyCode: string }
        metafields: Array<{ key: string; value: string } | null>
      }
    }>
  }
}

export async function getPlannerProducts(): Promise<StorefrontProduct[]> {
  const data = await storefront<{
    products: { edges: Array<{ node: StorefrontProduct }> }
  }>(GET_PLANNER_PRODUCTS)

  return data.products.edges.map((e) => e.node)
}

// ─── Cart Mutations ───────────────────────────────────────────────────────────

const CART_CREATE = /* GraphQL */ `
  mutation CartCreate($lines: [CartLineInput!]!) ${MARKET_CONTEXT} {
    cartCreate(input: { lines: $lines }) {
      cart {
        id
        checkoutUrl
        lines(first: 100) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  sku
                  title
                  price {
                    amount
                    currencyCode
                  }
                  product {
                    title
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`

export interface CartLineInput {
  merchandiseId: string
  quantity: number
}

export interface CartCreateResult {
  id: string
  checkoutUrl: string
  lines: Array<{
    id: string
    quantity: number
    variantId: string
    sku: string
    title: string
    price: string
  }>
}

export async function createCart(lines: CartLineInput[]): Promise<CartCreateResult> {
  const data = await storefront<{
    cartCreate: {
      cart: {
        id: string
        checkoutUrl: string
        lines: {
          edges: Array<{
            node: {
              id: string
              quantity: number
              merchandise: {
                id: string
                sku: string
                title: string
                price: { amount: string }
                product: { title: string }
              }
            }
          }>
        }
      }
      userErrors: Array<{ field: string; message: string }>
    }
  }>(CART_CREATE, { lines })

  const { cart, userErrors } = data.cartCreate

  if (userErrors.length > 0) {
    throw new Error(`Cart error: ${userErrors.map((e) => e.message).join(', ')}`)
  }

  return {
    id: cart.id,
    checkoutUrl: cart.checkoutUrl,
    lines: cart.lines.edges.map((e) => ({
      id: e.node.id,
      quantity: e.node.quantity,
      variantId: e.node.merchandise.id,
      sku: e.node.merchandise.sku,
      title: `${e.node.merchandise.product.title} — ${e.node.merchandise.title}`,
      price: e.node.merchandise.price.amount,
    })),
  }
}
