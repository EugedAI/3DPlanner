import { useSceneStore } from './store/useSceneStore'
import ThreeScene from './components/ThreeScene'

export default function App() {
  const { cameraMode, setCameraMode } = useSceneStore()

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ThreeScene />

      <div className="camera-toggle">
        <button
          className={cameraMode === '3d' ? 'active' : ''}
          onClick={() => setCameraMode('3d')}
        >
          3D
        </button>
        <button
          className={cameraMode === '2d' ? 'active' : ''}
          onClick={() => setCameraMode('2d')}
        >
          2D
        </button>
      </div>
    </div>
  )
}
