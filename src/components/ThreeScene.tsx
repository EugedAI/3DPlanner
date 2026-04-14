import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { useStore } from '../store'

// ============================================================
// ThreeScene — React wrapper for the Three.js SceneManager.
// Refs hold all mutable Three.js state; Zustand drives
// cameraMode and room dimensions.
// ============================================================

export function ThreeScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const perspCameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const animFrameRef = useRef<number>(0)
  const roomGroupRef = useRef<THREE.Group | null>(null)
  const itemsGroupRef = useRef<THREE.Group | null>(null)
  const gltfLoaderRef = useRef<GLTFLoader | null>(null)

  // Sync cameraMode into a mutable ref so the RAF loop always sees the
  // current value without a stale closure.
  const is2DRef = useRef<boolean>(true)
  const cameraMode = useStore((s) => s.cameraMode)

  // ── Camera-mode effect ─────────────────────────────────────────
  useEffect(() => {
    const is2D = cameraMode === '2d'
    is2DRef.current = is2D

    const controls = controlsRef.current
    const orthoCamera = orthoCameraRef.current
    const perspCamera = perspCameraRef.current
    if (!controls || !orthoCamera || !perspCamera) return

    controls.object = is2D ? orthoCamera : perspCamera
    applyControlsForView(controls, is2D)
    controls.update()
  }, [cameraMode])

  // ── Initialisation effect — runs once on mount ─────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const w = container.clientWidth
    const h = container.clientHeight

    // ── Scene ────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)
    sceneRef.current = scene

    // ── Renderer ─────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // ── GLTF + Draco loader ───────────────────────────────────────
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')
    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(dracoLoader)
    gltfLoaderRef.current = gltfLoader

    // ── Perspective camera ────────────────────────────────────────
    const perspCamera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500)
    perspCamera.position.set(10, 12, 10)
    perspCamera.lookAt(0, 0, 0)
    perspCameraRef.current = perspCamera

    // ── Orthographic camera (2D top-down) ─────────────────────────
    const aspect = w / h
    const frustum = 12
    const orthoCamera = new THREE.OrthographicCamera(
      -frustum * aspect,
      frustum * aspect,
      frustum,
      -frustum,
      0.1,
      200,
    )
    orthoCamera.position.set(0, 50, 0)
    orthoCamera.lookAt(0, 0, 0)
    orthoCamera.zoom = 1
    orthoCameraRef.current = orthoCamera

    // ── OrbitControls — starts in 2D mode ─────────────────────────
    const controls = new OrbitControls(orthoCamera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    applyControlsForView(controls, true)
    controlsRef.current = controls

    // ── Lighting ──────────────────────────────────────────────────
    setupLighting(scene)

    // ── Scene groups ──────────────────────────────────────────────
    const roomGroup = new THREE.Group()
    const itemsGroup = new THREE.Group()
    scene.add(roomGroup)
    scene.add(itemsGroup)
    roomGroupRef.current = roomGroup
    itemsGroupRef.current = itemsGroup

    // ── Resize handler ────────────────────────────────────────────
    function onResize() {
      const el = containerRef.current
      if (!el) return
      const rw = el.clientWidth
      const rh = el.clientHeight
      if (rw === 0 || rh === 0) return
      renderer.setSize(rw, rh)
      perspCamera.aspect = rw / rh
      perspCamera.updateProjectionMatrix()
      const asp = rw / rh
      const frus = 12
      orthoCamera.left = -frus * asp
      orthoCamera.right = frus * asp
      orthoCamera.top = frus
      orthoCamera.bottom = -frus
      orthoCamera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    // ── Animation loop ────────────────────────────────────────────
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate)
      controls.update()
      const cam = is2DRef.current ? orthoCamera : perspCamera
      renderer.render(scene, cam)
    }
    animate()

    // ── Cleanup on unmount ────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
      sceneRef.current = null
      rendererRef.current = null
      perspCameraRef.current = null
      orthoCameraRef.current = null
      controlsRef.current = null
      roomGroupRef.current = null
      itemsGroupRef.current = null
      gltfLoaderRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ── Exported refs for cross-component access in Tasks 3 & 4 ───────
// Exported as module-level singletons so LeftPanel and RightPanel
// can call buildRoom / addItemToScene without prop-drilling.
// These are populated by the useEffect above.
export { type OrbitControls }

// ============================================================
// HELPERS (pure — no React hooks)
// ============================================================

/**
 * Configure OrbitControls for 2D (top-down pan/zoom only)
 * or 3D (full rotate/pan/zoom). Mirrors SceneManager._updateControlsForView().
 */
function applyControlsForView(controls: OrbitControls, is2D: boolean) {
  if (is2D) {
    controls.enableRotate = false
    controls.enableZoom = true
    controls.enablePan = true
    // Disable left-click rotate; keep middle-click dolly + right-click pan
    controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    }
    controls.touches = {
      ONE: null as unknown as THREE.TOUCH,
      TWO: THREE.TOUCH.DOLLY_PAN,
    }
  } else {
    controls.enableRotate = true
    controls.enableZoom = true
    controls.enablePan = true
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    }
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    }
  }
}

/**
 * Add all lights to the scene.
 * Mirrors SceneManager._setupLighting() exactly.
 */
function setupLighting(scene: THREE.Scene) {
  // Ambient
  const ambient = new THREE.AmbientLight(0xfff5e6, 0.5)
  scene.add(ambient)

  // Hemisphere
  const hemi = new THREE.HemisphereLight(0xf0f0f0, 0x303030, 0.3)
  scene.add(hemi)

  // Directional (shadow caster)
  const dir = new THREE.DirectionalLight(0xffffff, 0.7)
  dir.position.set(15, 20, 10)
  dir.castShadow = true
  dir.shadow.mapSize.width = 2048
  dir.shadow.mapSize.height = 2048
  dir.shadow.camera.near = 0.5
  dir.shadow.camera.far = 100
  dir.shadow.camera.left = -30
  dir.shadow.camera.right = 30
  dir.shadow.camera.top = 30
  dir.shadow.camera.bottom = -30
  scene.add(dir)
}
