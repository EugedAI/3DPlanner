import { useSceneStore } from './store/useSceneStore'
import ThreeScene from './components/ThreeScene'
import LeftPanel from './components/LeftPanel'
import RightPanel from './components/RightPanel'

export default function App() {
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const setCameraMode = useSceneStore((s) => s.setCameraMode)

  return (
    <>
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div id="toolbar">
        <div className="brand">
          <span>3D</span>|Planner
        </div>

        <div className="tools" id="centre-tools">
          {/* 2D / 3D toggle */}
          <button
            className={`tool-btn${cameraMode === '2d' ? ' active' : ''}`}
            title="Switch to 2D top-down view"
            onClick={() => setCameraMode('2d')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
            <span className="btn-label">2D</span>
          </button>

          <button
            className={`tool-btn${cameraMode === '3d' ? ' active' : ''}`}
            title="Switch to 3D perspective view"
            onClick={() => setCameraMode('3d')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="btn-label">3D</span>
          </button>

          {/* Stub buttons — Phase 2 */}
          <button className="tool-btn" title="Rotate selected 90°" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span className="btn-label">Rotate</span>
          </button>

          <button className="tool-btn" title="Delete selected" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
            <span className="btn-label">Delete</span>
          </button>
        </div>

        <div className="tools">
          {/* Stub icon buttons — Phase 2 */}
          <button className="tool-btn icon-only" title="Toggle product catalogue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button className="tool-btn icon-only" title="Room items panel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Left Panel ───────────────────────────────────────────── */}
      <LeftPanel />

      {/* ── Three.js Canvas ──────────────────────────────────────── */}
      <div id="canvas-container">
        <ThreeScene />
      </div>

      {/* ── Right Panel ──────────────────────────────────────────── */}
      <RightPanel />
    </>
  )
}
