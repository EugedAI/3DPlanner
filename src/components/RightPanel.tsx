import { useState } from 'react'
import { useSceneStore } from '../store/useSceneStore'
import { DEV_CATALOGUE } from '../lib/devCatalogue'

function formatPrice(price: number) {
  return `€${price.toFixed(2)}`
}

const AUTO_RESOLVE_PREFIX = 'auto-resolve:'

export default function RightPanel() {
  const cartItems = useSceneStore((s) => s.cartItems)
  const validationError = useSceneStore((s) => s.validationError)
  const setValidationError = useSceneStore((s) => s.setValidationError)
  const getSubtotal = useSceneStore((s) => s.getSubtotal)
  const removeItem = useSceneStore((s) => s.removeItem)
  const placeItem = useSceneStore((s) => s.placeItem)

  const [dismissedAutoResolve, setDismissedAutoResolve] = useState(false)

  const subtotal = getSubtotal()
  const isEmpty = cartItems.length === 0
  const isAutoResolve = validationError?.startsWith(AUTO_RESOLVE_PREFIX) ?? false
  const isStructuralError =
    validationError !== null && !isAutoResolve
  const isDisabled = isEmpty || isStructuralError

  function handleAddToCart() {
    console.log('[3DPlanner] Add to Shopify Cart:', cartItems)
  }

  function handleAddStarter() {
    // Find the affected row (extenders without a starter)
    const bays = cartItems.filter(
      (i) => i.objectType === 'starter' || i.objectType === 'extender'
    )
    const rows: Array<{ z: number; items: typeof bays }> = []
    for (const bay of bays) {
      const bz = bay.z ?? 0
      const row = rows.find((r) => Math.abs(r.z - bz) <= 0.05)
      if (row) row.items.push(bay)
      else rows.push({ z: bz, items: [bay] })
    }

    const invalidRow = rows.find((r) => !r.items.some((i) => i.objectType === 'starter'))
    if (!invalidRow) return

    // Find leftmost extender X in that row
    const leftmost = invalidRow.items.reduce((a, b) => (a.x ?? 0) < (b.x ?? 0) ? a : b)
    const starterProduct = DEV_CATALOGUE.find((p) => p.objectType === 'starter')
    if (!starterProduct) return
    const variant = starterProduct.variants[0]
    const instanceId = `inst-fix-${Date.now()}`

    // Place starter at the left of the invalid row
    const starterX =
      (leftmost.x ?? 0) - (leftmost.variantWidth ?? 1200) / 1000 / 2 - variant.width / 1000 / 2
    placeItem(starterProduct, variant, starterX, invalidRow.z, instanceId)
  }

  return (
    <div id="items-panel" style={{ transform: 'translateX(0)' }}>
      <div className="panel-header">
        <h3>Room Items</h3>
      </div>

      <div className="items-list">
        {isEmpty ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
            }}
          >
            No items placed yet
          </div>
        ) : (
          <table className="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cartItems
                .filter((i) => !i.instanceId.startsWith('shelf-line-'))
                .map((item) => (
                  <tr key={item.instanceId} className="item-row">
                    <td>
                      <div className="row-name">{item.title}</div>
                      <div className="row-sku">{item.sku}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 12 }}>{item.quantity}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div>{formatPrice(item.price)}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                        {formatPrice(item.price * item.quantity)}
                      </div>
                    </td>
                    <td>
                      {(item.objectType === 'starter' || item.objectType === 'extender') && (
                        <button
                          onClick={() => removeItem(item.instanceId)}
                          title="Remove from room"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: 14,
                            padding: '2px 4px',
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              {/* Shelf line items */}
              {cartItems
                .filter((i) => i.instanceId.startsWith('shelf-line-'))
                .map((item) => (
                  <tr key={item.instanceId} className="item-row" style={{ opacity: 0.75 }}>
                    <td>
                      <div className="row-name" style={{ fontSize: 11 }}>{item.title}</div>
                      <div className="row-sku">{item.sku}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 12 }}>{item.quantity}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      <div>{formatPrice(item.price)}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                        {formatPrice(item.price * item.quantity)}
                      </div>
                    </td>
                    <td></td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel-footer">
        <div className="total" style={{ marginBottom: 8 }}>
          {isEmpty
            ? '0 items placed'
            : `${cartItems.filter((i) => !i.instanceId.startsWith('shelf-line-')).length} item${cartItems.length !== 1 ? 's' : ''} placed`}
        </div>

        {!isEmpty && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 10,
            }}
          >
            Subtotal: {formatPrice(subtotal)} EUR
          </div>
        )}

        {/* Auto-resolve notice — dismissible, blue/neutral */}
        {isAutoResolve && !dismissedAutoResolve && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '8px 10px',
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid #3b82f6',
              color: '#93c5fd',
              fontSize: 11,
              marginBottom: 8,
            }}
          >
            <span style={{ flexShrink: 0, fontSize: 14 }}>ℹ</span>
            <span style={{ flex: 1 }}>
              We've updated your layout automatically. The first bay in each row must be a Starter unit.
            </span>
            <button
              onClick={() => {
                setDismissedAutoResolve(true)
                setValidationError(null)
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#93c5fd',
                cursor: 'pointer',
                fontSize: 14,
                padding: 0,
                lineHeight: 1,
                flexShrink: 0,
              }}
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Structural error — persistent, red/amber */}
        {isStructuralError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '8px 10px',
              background: 'rgba(224,64,64,0.12)',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              fontSize: 11,
              marginBottom: 8,
            }}
          >
            <span style={{ flexShrink: 0, fontSize: 14 }}>⚠</span>
            <span>
              Your layout has an invalid configuration. Please fix the highlighted bays to continue.
            </span>
          </div>
        )}

        {/* Add Starter fix button */}
        {isStructuralError && (
          <button
            onClick={handleAddStarter}
            style={{
              width: '100%',
              padding: '7px 0',
              marginBottom: 8,
              fontSize: 12,
              fontWeight: 600,
              background: 'rgba(255,165,0,0.15)',
              border: '1px solid #ffa500',
              color: '#ffa500',
              cursor: 'pointer',
            }}
          >
            + Add Starter to fix layout
          </button>
        )}

        <div className="action-btns">
          <div className="tooltip-wrap">
            <button
              className="footer-btn orange"
              disabled={isDisabled}
              onClick={handleAddToCart}
            >
              Add to Shopify Cart
            </button>
            {isEmpty && (
              <div className="tooltip">Place items in the room first</div>
            )}
            {isStructuralError && (
              <div className="tooltip">Fix layout errors before adding to cart</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
