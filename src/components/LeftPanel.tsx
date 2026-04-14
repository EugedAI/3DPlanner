import { useEffect } from 'react'
import { useSceneStore } from '../store/useSceneStore'
import { DEV_CATALOGUE } from '../lib/devCatalogue'
import type { Product, ObjectType } from '../types'

const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  starter: 'Starter',
  extender: 'Extender',
  shelf: 'Shelf',
  accessory: 'Accessory',
}

const OBJECT_TYPE_ORDER: ObjectType[] = ['starter', 'extender', 'shelf', 'accessory']

function formatPrice(price: number) {
  return `€${price.toFixed(2)} EUR`
}

function ProductCard({ product }: { product: Product }) {
  const setPendingPlacement = useSceneStore((s) => s.setPendingPlacement)
  const variant = product.variants[0]
  const available = variant?.availableForSale !== false

  function handlePlace() {
    if (!available) return
    setPendingPlacement(product)
  }

  return (
    <div
      className={`product-card${!available ? ' out-of-stock' : ''}`}
      style={{ opacity: available ? 1 : 0.45, cursor: available ? 'pointer' : 'default' }}
    >
      {/* Image placeholder */}
      <div
        style={{
          width: '100%',
          height: 100,
          background: 'var(--bg-primary)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: 11,
        }}
      >
        No image
      </div>

      {/* Badge */}
      <div style={{ marginBottom: 4 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            padding: '2px 6px',
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            border: '1px solid var(--accent)',
          }}
        >
          {OBJECT_TYPE_LABELS[product.objectType]}
        </span>
      </div>

      <div className="p-name">{product.title}</div>

      {variant && (
        <>
          <div className="p-dims">
            {variant.width}×{variant.height > 0 ? variant.height : '—'}×{variant.depth}mm
          </div>
          <div className="p-dims" style={{ marginBottom: 2 }}>
            Load: {variant.kgPerShelf > 0 ? `${variant.kgPerShelf}kg / shelf` : '—'}
          </div>
          <div className="p-sku">SKU: {variant.sku}</div>
        </>
      )}

      <div
        style={{
          fontWeight: 600,
          fontSize: 13,
          color: 'var(--text-primary)',
          marginBottom: 8,
        }}
      >
        {variant ? formatPrice(variant.price) : '—'}
      </div>

      <button
        className="btn-place"
        onClick={handlePlace}
        disabled={!available}
        style={{ pointerEvents: available ? 'auto' : 'none' }}
      >
        {available ? '+ Place in Room' : 'Out of Stock'}
      </button>
    </div>
  )
}

export default function LeftPanel() {
  const loading = useSceneStore((s) => s.loading)
  const error = useSceneStore((s) => s.error)
  const products = useSceneStore((s) => s.products)
  const setProducts = useSceneStore((s) => s.setProducts)
  const setLoading = useSceneStore((s) => s.setLoading)

  // Load dev catalogue on mount
  useEffect(() => {
    setLoading(true)
    // Simulate async — real Shopify fetch in Phase 2
    const t = setTimeout(() => {
      setProducts(DEV_CATALOGUE)
      setLoading(false)
    }, 0)
    return () => clearTimeout(t)
  }, [setProducts, setLoading])

  // Group products by objectType
  const grouped = OBJECT_TYPE_ORDER.reduce<Record<ObjectType, Product[]>>(
    (acc, type) => {
      acc[type] = products.filter((p) => p.objectType === type)
      return acc
    },
    { starter: [], extender: [], shelf: [], accessory: [] }
  )

  return (
    <div id="catalogue-panel" style={{ transform: 'translateX(0)' }}>
      <div className="panel-header">
        <h3>Products</h3>
        <div className="cat-filters">
          {OBJECT_TYPE_ORDER.map((type) => (
            <span key={type} className="cat-filter">
              {OBJECT_TYPE_LABELS[type]}
            </span>
          ))}
        </div>
      </div>

      <div className="product-list">
        {loading && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            Loading products…
          </div>
        )}

        {error && (
          <div
            style={{
              margin: 12,
              padding: 12,
              background: 'rgba(224,64,64,0.12)',
              border: '1px solid var(--danger)',
              color: 'var(--danger)',
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {OBJECT_TYPE_ORDER.map((type) => {
              const group = grouped[type]
              if (group.length === 0) return null
              return (
                <div key={type}>
                  <div
                    style={{
                      padding: '10px 8px 4px',
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                      color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border)',
                      marginBottom: 4,
                    }}
                  >
                    {OBJECT_TYPE_LABELS[type]}s
                  </div>
                  {group.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
