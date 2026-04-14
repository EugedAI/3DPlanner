import { useStore } from './store'
import { LeftPanel } from './components/LeftPanel'
import { RightPanel } from './components/RightPanel'
import { ThreeScene } from './components/ThreeScene'

// ============================================================
// APP — three-panel shell
// Layout mirrors rackzone-planner.html exactly:
//   Toolbar (top) | LeftPanel | ThreeScene | RightPanel
// ============================================================

export function App() {
  const cameraMode = useStore((s) => s.cameraMode)
  const setCameraMode = useStore((s) => s.setCameraMode)
  const catalogueOpen = useStore((s) => s.catalogueOpen)
  const toggleCataloguePanel = useStore((s) => s.toggleCataloguePanel)
  const setCatalogueOpen = useStore((s) => s.setCatalogueOpen)
  const itemsPanelOpen = useStore((s) => s.itemsPanelOpen)
  const toggleItemsPanel = useStore((s) => s.toggleItemsPanel)
  const setItemsPanelOpen = useStore((s) => s.setItemsPanelOpen)
  const helpOpen = useStore((s) => s.helpOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
  const selectedId = useStore((s) => s.selectedId)
  const setupDone = useStore((s) => s.setupDone)
  const setSetupDone = useStore((s) => s.setSetupDone)
  const setRoomConfig = useStore((s) => s.setRoomConfig)
  const roomWidth = useStore((s) => s.roomWidth)
  const roomDepth = useStore((s) => s.roomDepth)

  const canvasClasses = [
    'canvas-area',
    !catalogueOpen ? 'catalogue-collapsed' : '',
    !itemsPanelOpen ? 'items-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  function handleStart() {
    setSetupDone(true)
    setCatalogueOpen(true)
    setItemsPanelOpen(true)
  }

  return (
    <>
      {/* ── TOOLBAR ──────────────────────────────────────────── */}
      <div id="toolbar">
        <div className="brand">
          <span>3D</span>|Planner
        </div>

        <div className="tools" id="centre-tools">
          <button
            className={`tool-btn${cameraMode === '2d' ? ' active' : ''}`}
            id="btn-view-toggle"
            title="Toggle 2D / 3D view"
            onClick={() => setCameraMode(cameraMode === '2d' ? '3d' : '2d')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x={3} y={3} width={18} height={18} />
              <line x1={3} y1={12} x2={21} y2={12} />
              <line x1={12} y1={3} x2={12} y2={21} />
            </svg>
            <span className="btn-label">{cameraMode === '2d' ? '2D' : '3D'}</span>
          </button>

          <button className="tool-btn" id="btn-rotate" title="Rotate selected 90°" disabled={selectedId === null}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span className="btn-label">Rotate</span>
          </button>

          <button className="tool-btn" id="btn-delete" title="Delete selected" disabled={selectedId === null}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            <span className="btn-label">Delete</span>
          </button>

          <button className="tool-btn" id="btn-clear" title="Clear all items">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1={18} y1={6} x2={6} y2={18} />
              <line x1={6} y1={6} x2={18} y2={18} />
            </svg>
            <span className="btn-label">Clear</span>
          </button>
        </div>

        <div className="tools">
          <button
            className="tool-btn"
            id="btn-catalogue-toggle"
            title="Toggle product catalogue"
            onClick={toggleCataloguePanel}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x={3} y={3} width={7} height={7} />
              <rect x={14} y={3} width={7} height={7} />
              <rect x={3} y={14} width={7} height={7} />
              <rect x={14} y={14} width={7} height={7} />
            </svg>
          </button>

          <button
            className="tool-btn"
            id="btn-items-toggle"
            title="Room items panel"
            onClick={toggleItemsPanel}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <line x1={8} y1={6} x2={21} y2={6} />
              <line x1={8} y1={12} x2={21} y2={12} />
              <line x1={8} y1={18} x2={21} y2={18} />
              <line x1={3} y1={6} x2={3.01} y2={6} />
              <line x1={3} y1={12} x2={3.01} y2={12} />
              <line x1={3} y1={18} x2={3.01} y2={18} />
            </svg>
          </button>

          <button className="tool-btn" id="btn-help" title="Help" onClick={() => setHelpOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx={12} cy={12} r={10} />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1={12} y1={17} x2={12.01} y2={17} />
            </svg>
          </button>
        </div>
      </div>

      {/* ── SETUP MODAL ──────────────────────────────────────── */}
      {!setupDone && (
        <SetupModal
          initialWidth={roomWidth}
          initialDepth={roomDepth}
          onStart={(type, w, d) => {
            setRoomConfig(type, w, d)
            handleStart()
          }}
        />
      )}

      {/* ── PANELS + SCENE ───────────────────────────────────── */}
      {setupDone && (
        <>
          <LeftPanel />

          <div id="canvas-container" className={canvasClasses}>
            <div id="labels-overlay">
              <div id="rotation-handle" title="Drag to rotate freely">↻</div>
            </div>
            <ThreeScene />
          </div>

          <RightPanel />
        </>
      )}

      {/* ── HELP MODAL ───────────────────────────────────────── */}
      <div id="help-modal" className={helpOpen ? 'visible' : ''} onClick={(e) => { if (e.target === e.currentTarget) setHelpOpen(false) }}>
        <div className="help-card">
          <h2><span>3D</span>Planner Help</h2>
          <div className="help-section">
            <h4>Getting Started</h4>
            <p>Choose your room type, set dimensions, then add products from the catalogue on the left.</p>
          </div>
          <div className="help-section">
            <h4>3D View</h4>
            <p>Drag to rotate · Scroll/pinch to zoom · Right-drag or two-finger drag to pan</p>
          </div>
          <div className="help-section">
            <h4>2D View</h4>
            <p>Top-down floorplan with grid overlay. Drag items to reposition. Scroll to zoom.</p>
          </div>
          <div className="help-section">
            <h4>Items</h4>
            <p>Click/tap to select · Drag to move · Use toolbar to rotate or delete · Items snap to 0.1m grid</p>
          </div>
          <div className="help-section">
            <h4>Save &amp; Export</h4>
            <p>Save your layout to return later. Export a PNG screenshot of your plan.</p>
          </div>
          <button className="help-close" onClick={() => setHelpOpen(false)}>Got It</button>
        </div>
      </div>

      {/* ── LOADING TOAST ────────────────────────────────────── */}
      <div id="loading-toast">
        <div className="spinner"></div>
        <span id="loading-toast-msg">Loading 3D model…</span>
      </div>
    </>
  )
}

// ============================================================
// SETUP MODAL — room type + dimensions
// ============================================================

import { useState } from 'react'
import type { RoomType } from './types'

interface SetupModalProps {
  initialWidth: number
  initialDepth: number
  onStart: (type: RoomType, width: number, depth: number) => void
}

const ROOM_DEFAULTS: Record<RoomType, { w: number; d: number }> = {
  warehouse: { w: 20, d: 15 },
  garage: { w: 6, d: 5 },
  office: { w: 8, d: 6 },
  home: { w: 4, d: 3 },
}

const ROOM_LABELS: Record<RoomType, { icon: string; label: string; dims: string }> = {
  warehouse: { icon: '🏭', label: 'Warehouse', dims: '20m × 15m' },
  garage: { icon: '🚗', label: 'Garage', dims: '6m × 5m' },
  office: { icon: '🏢', label: 'Office', dims: '8m × 6m' },
  home: { icon: '🏠', label: 'Home Storage', dims: '4m × 3m' },
}

function SetupModal({ initialWidth, initialDepth, onStart }: SetupModalProps) {
  const [roomType, setRoomTypeLocal] = useState<RoomType>('warehouse')
  const [width, setWidth] = useState(initialWidth)
  const [depth, setDepth] = useState(initialDepth)

  function pickRoomType(type: RoomType) {
    setRoomTypeLocal(type)
    setWidth(ROOM_DEFAULTS[type].w)
    setDepth(ROOM_DEFAULTS[type].d)
  }

  return (
    <div id="setup-modal">
      <div className="setup-card">
        <h1><span>3D</span>Planner</h1>
        <p className="subtitle">Plan your space in 3D</p>

        <h2>Step 1 — Room Type</h2>
        <div className="room-types">
          {(Object.keys(ROOM_LABELS) as RoomType[]).map((type) => (
            <div
              key={type}
              className={`room-type-card${roomType === type ? ' selected' : ''}`}
              onClick={() => pickRoomType(type)}
            >
              <div className="icon">{ROOM_LABELS[type].icon}</div>
              <div className="label">{ROOM_LABELS[type].label}</div>
              <div className="dims">{ROOM_LABELS[type].dims}</div>
            </div>
          ))}
        </div>

        <h2>Step 2 — Dimensions</h2>
        <div className="dim-row">
          <div className="dim-field">
            <label>Width (m)</label>
            <div className="dim-input-wrap">
              <button onClick={() => setWidth((v) => Math.max(2, Math.round((v - 0.5) * 10) / 10))}>−</button>
              <input
                type="number"
                value={width}
                min={2}
                max={100}
                step={0.5}
                onChange={(e) => setWidth(parseFloat(e.target.value) || width)}
              />
              <button onClick={() => setWidth((v) => Math.min(100, Math.round((v + 0.5) * 10) / 10))}>+</button>
            </div>
          </div>
          <div className="dim-field">
            <label>Depth (m)</label>
            <div className="dim-input-wrap">
              <button onClick={() => setDepth((v) => Math.max(2, Math.round((v - 0.5) * 10) / 10))}>−</button>
              <input
                type="number"
                value={depth}
                min={2}
                max={100}
                step={0.5}
                onChange={(e) => setDepth(parseFloat(e.target.value) || depth)}
              />
              <button onClick={() => setDepth((v) => Math.min(100, Math.round((v + 0.5) * 10) / 10))}>+</button>
            </div>
          </div>
        </div>

        <h2>Step 3</h2>
        <button className="btn-primary" onClick={() => onStart(roomType, width, depth)}>
          Start Planning
        </button>
      </div>
    </div>
  )
}
