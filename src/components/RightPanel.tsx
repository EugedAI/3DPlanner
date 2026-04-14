import { useSceneStore } from '../store/useSceneStore'

function formatPrice(price: number) {
  return `€${price.toFixed(2)}`
}

export default function RightPanel() {
  const cartItems = useSceneStore((s) => s.cartItems)
  const validationError = useSceneStore((s) => s.validationError)
  const getSubtotal = useSceneStore((s) => s.getSubtotal)

  const subtotal = getSubtotal()
  const isEmpty = cartItems.length === 0
  const isDisabled = isEmpty || validationError !== null

  function handleAddToCart() {
    // Phase 2 — real Shopify cart mutation
    console.log('[3DPlanner] Add to Shopify Cart:', cartItems)
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
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item) => (
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
            : `${cartItems.length} item${cartItems.length !== 1 ? 's' : ''} placed`}
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

        {validationError && (
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
            <span>{validationError}</span>
          </div>
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
            {validationError && (
              <div className="tooltip">{validationError}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
