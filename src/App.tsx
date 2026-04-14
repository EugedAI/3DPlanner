/**
 * App — Root component.
 *
 * Three-panel layout:
 *  Left:   Configuration controls (LeftPanel)
 *  Centre: Three.js scene (ThreeScene + CameraToggle)
 *  Right:  Cart summary (RightPanel)
 */

import { LeftPanel } from '@/components/panels/LeftPanel'
import { RightPanel } from '@/components/panels/RightPanel'
import { ThreeScene } from '@/components/scene/ThreeScene'
import { CameraToggle } from '@/components/scene/CameraToggle'

export function App() {
  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Left panel — configuration controls */}
      <LeftPanel />

      {/* Centre panel — Three.js scene */}
      <main style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <CameraToggle />
        <ThreeScene />
      </main>

      {/* Right panel — cart summary */}
      <RightPanel />
    </div>
  )
}
