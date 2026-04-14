/**
 * RightPanel — Cart summary.
 * Phase 1: placeholder shell.
 * Phase 2+: live pricing, SKU list, add-to-cart, TrustPilot signal.
 */

export function RightPanel() {
  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        background: '#1a1a2e',
        color: '#e0e0e0',
        padding: '20px 16px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div>
        <h2
          style={{
            margin: '0 0 4px',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: '#888',
          }}
        >
          Cart Summary
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.5 }}>
          Live pricing, SKU list, and add-to-cart will appear here.
        </p>
      </div>

      <div
        style={{
          borderTop: '1px solid #2a2a4a',
          paddingTop: 12,
        }}
      >
        <div
          style={{
            background: '#12122a',
            padding: '12px',
            borderRadius: 4,
            fontSize: 13,
            color: '#444',
            textAlign: 'center',
          }}
        >
          No items in cart
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid #2a2a4a',
          paddingTop: 12,
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 12,
            fontSize: 14,
            color: '#888',
          }}
        >
          <span>Total</span>
          <span style={{ color: '#c0c0c0', fontWeight: 700 }}>€0.00</span>
        </div>
        <button
          disabled
          style={{
            width: '100%',
            padding: '12px',
            background: '#2a2a5a',
            color: '#555',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'not-allowed',
          }}
        >
          Add to Cart
        </button>
      </div>
    </aside>
  )
}
