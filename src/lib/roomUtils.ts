import type { ProductVariant, CartItem } from '../types'

// Snap threshold in metres — items within this distance on Z share a "row"
const ROW_SNAP_THRESHOLD = 0.05

/**
 * Returns true if the item would remain within room boundaries.
 * x and z are the centre position in metres.
 * Dimensions are in mm and converted here.
 */
export function isWithinBounds(
  x: number,
  z: number,
  item: ProductVariant,
  roomWidth: number,
  roomDepth: number
): boolean {
  const hw = item.width / 1000 / 2
  const hd = item.depth / 1000 / 2
  const rw = roomWidth / 2
  const rd = roomDepth / 2
  return (
    x - hw >= -rw &&
    x + hw <= rw &&
    z - hd >= -rd &&
    z + hd <= rd
  )
}

/**
 * Returns true if placing a variant at (x, z) would overlap any existing item.
 * Distances are rounded to nearest cm to avoid floating-point false positives.
 * excludeId: skip an item (for move operations).
 */
export function hasCollision(
  x: number,
  z: number,
  variant: ProductVariant,
  existingItems: CartItem[],
  excludeId?: string
): boolean {
  const hw = variant.width / 1000 / 2
  const hd = variant.depth / 1000 / 2

  for (const item of existingItems) {
    if (item.instanceId === excludeId) continue
    if (!item.x || !item.z || !item.variantWidth || !item.variantDepth) continue
    const ohw = item.variantWidth / 1000 / 2
    const ohd = item.variantDepth / 1000 / 2
    // Round to nearest cm
    const distX = Math.round(Math.abs(x - item.x) * 100) / 100
    const distZ = Math.round(Math.abs(z - item.z) * 100) / 100
    const overlapX = distX < hw + ohw
    const overlapZ = distZ < hd + ohd
    if (overlapX && overlapZ) return true
  }
  return false
}

/**
 * Returns the equidistant shelf spacing in metres.
 * height: total bay height in mm.
 * shelfCount: number of shelves to space.
 */
export function getEquidistantSpacing(height: number, shelfCount: number): number {
  if (shelfCount <= 0) return 0
  return height / 1000 / (shelfCount + 1)
}

/**
 * Validates the layout. Returns null if valid, or an error string.
 * A row is a group of items at the same Z position within ROW_SNAP_THRESHOLD.
 * Each row must contain at least one 'starter'.
 */
export function validateLayout(items: CartItem[]): string | null {
  // Only check bays (starter/extender) — ignore shelves and accessories
  const bays = items.filter(
    (i) => i.objectType === 'starter' || i.objectType === 'extender'
  )
  if (bays.length === 0) return null

  // Group bays by Z row
  const rows: CartItem[][] = []
  for (const bay of bays) {
    const z = bay.z ?? 0
    const existing = rows.find((row) => {
      const rowZ = row[0].z ?? 0
      return Math.abs(rowZ - z) <= ROW_SNAP_THRESHOLD
    })
    if (existing) {
      existing.push(bay)
    } else {
      rows.push([bay])
    }
  }

  for (const row of rows) {
    const hasStarter = row.some((i) => i.objectType === 'starter')
    if (!hasStarter) {
      return 'Layout error: one or more rows have no Starter unit. Each row must begin with a Starter.'
    }
  }
  return null
}
