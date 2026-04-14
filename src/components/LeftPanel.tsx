import { useEffect } from 'react'
import { useSceneStore } from '../store/useSceneStore'
import { DEV_CATALOGUE } from '../lib/devCatalogue'
import type { Product, ObjectType, CartItem } from '../types'

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

function ShelfControls({ item }: { item: CartItem }) {
  const updateShelfCount = useSceneStore((s) => s.updateShelfCount)

  const defaultCount = item.numberOfShelves ?? 3
  const maxCount = item.numberOfLevels ?? 5
  const liveCount = (item as CartItem & { currentShelves?: number }).currentShelves ?? defaultCount
  const extra = liveCount - defaultCount

  const atMin = liveCount <= defaultCount
  const atMax = liveCount >= maxCount

  function shelfLabel() {
    if (extra > 0) return `${liveCount} shelves (+${extra})`
    return `${liveCount} shelves (default)`
  }

  return (
    <div
      style={{
        margin: '0 8px 8px',
        padding: '10px 12px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          color: 'var(--text-muted)',
          marginBottom: 8,
        }}
      >
        Selected Bay
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-primary)',
          marginBottom: 8,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={item.title}
      >
        {item.title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 10,
        }}
      >
        {shelfLabel()}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          disabled={atMin}
          onClick={() => updateShelfCount(item.instanceId, -1)}
          style={{
            flex: 1,
            padding: '5px 0',
            fontSize: 11,
            background: atMin ? 'var(--bg-primary)' : 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: atMin ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: atMin ? 'not-allowed' : 'pointer',
          }}
        >
          − Remove shelf
        </button>
        <button
          disabled={atMax}
          onClick={() => updateShelfCount(item.instanceId, +1)}
          style={{
            flex: 1,
            padding: '5px 0',
            fontSize: 11,
            background: atMax ? 'var(--bg-primary)' : 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: atMax ? 'var(--text-muted)' : 'var(--text-primary)',
            cursor: atMax ? 'not-allowed' : 'pointer',
          }}
        >
          + Add shelf
        </button>
      </div>
    </div>
  )
}

export default function LeftPanel() {
  const loading = useSceneStore((s) => s.loading)
  const error = useSceneStore((s) => s.error)
  const products = useSceneStore((s) => s.products)
  const setProducts = useSceneStore((s) => s.setProducts)
  const setLoading = useSceneStore((s) => s.setLoading)
  const selectedId = useSceneStore((s) => s.selectedId)
  const cartItems = useSceneStore((s) => s.cartItems)

  // Load dev catalogue on mount
  useEffect(() => {
    setLoading(true)
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

  // Find selected bay item for shelf controls
  const selectedItem = selectedId
    ? cartItems.find(
        (i) =>
          i.instanceId === selectedId &&
          (i.objectType === 'starter' || i.objectType === 'extender')
      )
    : null

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

      {/* Shelf controls when a bay is selected */}
      {selectedItem && <ShelfControls item={selectedItem} />}

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
