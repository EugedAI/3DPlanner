/**
 * CameraToggle — 2D / 3D view toggle button.
 * Reads/writes ui.cameraMode in the Zustand store.
 */

import { useStore, useUI } from '@/store'

export function CameraToggle() {
  const { cameraMode } = useUI()
  const toggleCameraMode = useStore((s) => s.toggleCameraMode)

  return (
    <button
      onClick={toggleCameraMode}
      title={cameraMode === '3d' ? 'Switch to 2D view' : 'Switch to 3D view'}
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        background: 'rgba(26,26,46,0.92)',
        color: '#e0e0e0',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        backdropFilter: 'blur(4px)',
        letterSpacing: 0.5,
      }}
    >
      <span style={{ fontSize: 16 }}>{cameraMode === '3d' ? '⬛' : '🔲'}</span>
      {cameraMode === '3d' ? '3D' : '2D'}
      <span style={{ color: '#555', fontWeight: 400 }}>→</span>
      {cameraMode === '3d' ? '2D' : '3D'}
    </button>
  )
}
