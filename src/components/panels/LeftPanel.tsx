/**
 * LeftPanel — Configuration controls.
 * Phase 1: placeholder shell.
 * Phase 2+: dimensions, rack type, accessories, shelf count controls, quantity.
 */

export function LeftPanel() {
  return (
    <aside
      style={{
        width: 280,
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
          Configuration
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.5 }}>
          Dimensions, rack type, shelf count, and accessories will appear here.
        </p>
      </div>

      <Section label="Bay Dimensions">
        <PlaceholderField label="Width" value="1200 mm" />
        <PlaceholderField label="Height" value="2000 mm" />
        <PlaceholderField label="Depth" value="800 mm" />
      </Section>

      <Section label="Shelves">
        <PlaceholderField label="Default" value="3" />
        <PlaceholderField label="Maximum" value="5" />
      </Section>

      <Section label="Material">
        <PlaceholderField label="Frame" value="Steel / Powder Coated" />
      </Section>
    </aside>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        borderTop: '1px solid #2a2a4a',
        paddingTop: 12,
      }}
    >
      <h3
        style={{
          margin: '0 0 8px',
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          color: '#666',
        }}
      >
        {label}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {children}
      </div>
    </div>
  )
}

function PlaceholderField({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#12122a',
        padding: '6px 10px',
        borderRadius: 4,
      }}
    >
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 12, color: '#c0c0c0', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
