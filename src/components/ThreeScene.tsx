import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { useSceneStore } from '../store/useSceneStore'
import type { Product } from '../types'

// ── helpers ─────────────────────────────────────────────────────────────────

function mmToM(mm: number) {
  return mm / 1000
}

// Build a procedural bay mesh from a Product's first variant
function buildProceduralBay(product: Product): THREE.Group {
  const variant = product.variants[0]
  const w = mmToM(variant.width)
  const h = variant.height > 0 ? mmToM(variant.height) : 0.05
  const d = mmToM(variant.depth)

  const group = new THREE.Group()

  // Frame colour by objectType
  const frameColours: Record<string, number> = {
    starter: 0x4a90b8,
    extender: 0x6aab6a,
    shelf: 0xb8a04a,
    accessory: 0x9a6ab8,
  }
  const colour = frameColours[product.objectType] ?? 0x888888

  const frameGeo = new THREE.BoxGeometry(w, h, d)
  const frameMat = new THREE.MeshStandardMaterial({
    color: colour,
    transparent: true,
    opacity: 0.75,
    wireframe: false,
  })
  const box = new THREE.Mesh(frameGeo, frameMat)
  box.position.y = h / 2
  box.castShadow = true
  box.receiveShadow = true
  group.add(box)

  // Shelf lines
  if (variant.numberOfShelves > 0 && h > 0) {
    const shelfMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.4, transparent: true })
    const spacing = h / (variant.numberOfShelves + 1)
    for (let i = 1; i <= variant.numberOfShelves; i++) {
      const y = i * spacing
      const pts = [
        new THREE.Vector3(-w / 2, y, -d / 2),
        new THREE.Vector3(w / 2, y, -d / 2),
        new THREE.Vector3(w / 2, y, d / 2),
        new THREE.Vector3(-w / 2, y, d / 2),
        new THREE.Vector3(-w / 2, y, -d / 2),
      ]
      const geo = new THREE.BufferGeometry().setFromPoints(pts)
      group.add(new THREE.Line(geo, shelfMat))
    }
  }

  return group
}

// ── component ────────────────────────────────────────────────────────────────

export default function ThreeScene() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const css2dRef = useRef<CSS2DRenderer | null>(null)
  const perspCamRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orthoCamRef = useRef<THREE.OrthographicCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const rafRef = useRef<number>(0)
  const placedMeshesRef = useRef<Map<string, THREE.Group>>(new Map())
  const labelObjectsRef = useRef<Map<string, CSS2DObject>>(new Map())
  const nextIdRef = useRef(0)

  // Zustand selectors
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const roomWidth = useSceneStore((s) => s.roomWidth)
  const roomDepth = useSceneStore((s) => s.roomDepth)
  const selectedId = useSceneStore((s) => s.selectedId)
  const setSelectedId = useSceneStore((s) => s.setSelectedId)
  const pendingPlacement = useSceneStore((s) => s.pendingPlacement)
  const setPendingPlacement = useSceneStore((s) => s.setPendingPlacement)
  const addCartItem = useSceneStore((s) => s.addCartItem)

  // ── camera helpers ──────────────────────────────────────────────────────

  const applyControlsForView = useCallback((mode: '2d' | '3d') => {
    const controls = controlsRef.current
    if (!controls) return
    if (mode === '2d') {
      controls.enableRotate = false
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }
    } else {
      controls.enableRotate = true
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }
    }
  }, [])

  // ── scene setup ─────────────────────────────────────────────────────────

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#1a1a1a')
    sceneRef.current = scene

    // Renderers
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const css2d = new CSS2DRenderer()
    css2d.setSize(mount.clientWidth, mount.clientHeight)
    css2d.domElement.style.position = 'absolute'
    css2d.domElement.style.top = '0'
    css2d.domElement.style.left = '0'
    css2d.domElement.style.pointerEvents = 'none'
    mount.appendChild(css2d.domElement)
    css2dRef.current = css2d

    // Cameras
    const aspect = mount.clientWidth / mount.clientHeight
    const persp = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000)
    persp.position.set(15, 20, 20)
    perspCamRef.current = persp

    const frustum = 20
    const ortho = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect,
      frustum, -frustum,
      0.1, 1000
    )
    ortho.position.set(0, 50, 0)
    ortho.lookAt(0, 0, 0)
    orthoCamRef.current = ortho

    // Controls (always on persp cam; we swap render cam)
    const controls = new OrbitControls(persp, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.update()
    controlsRef.current = controls
    applyControlsForView('3d')

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4)
    hemi.position.set(0, 20, 0)
    scene.add(hemi)

    const dir = new THREE.DirectionalLight(0xffffff, 0.8)
    dir.position.set(10, 20, 10)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.near = 0.1
    dir.shadow.camera.far = 100
    dir.shadow.camera.left = -30
    dir.shadow.camera.right = 30
    dir.shadow.camera.top = 30
    dir.shadow.camera.bottom = -30
    scene.add(dir)

    // Room
    setupRoom(scene, roomWidth, roomDepth)

    // Test starter bay (1200×2000×800, 3 shelves) ─ as per spec
    const testGeo = new THREE.BoxGeometry(1.2, 2.0, 0.8)
    const testMat = new THREE.MeshStandardMaterial({ color: 0x4a90b8, transparent: true, opacity: 0.75 })
    const testBox = new THREE.Mesh(testGeo, testMat)
    testBox.position.set(0, 1.0, 0)
    testBox.castShadow = true
    testBox.name = '__test-bay__'
    scene.add(testBox)

    // Animate
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      controls.update()
      const cam = useSceneStore.getState().cameraMode === '2d' ? orthoCamRef.current! : perspCamRef.current!
      renderer.render(scene, cam)
      css2d.render(scene, cam)
    }
    animate()

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (!mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      css2d.setSize(w, h)
      const a = w / h
      persp.aspect = a
      persp.updateProjectionMatrix()
      const f = 20
      ortho.left = -f * a
      ortho.right = f * a
      ortho.updateProjectionMatrix()
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement)
      if (css2d.domElement.parentNode) css2d.domElement.parentNode.removeChild(css2d.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── react to cameraMode changes ─────────────────────────────────────────

  useEffect(() => {
    applyControlsForView(cameraMode)
    if (cameraMode === '2d') {
      orthoCamRef.current?.position.set(0, 50, 0)
      orthoCamRef.current?.lookAt(0, 0, 0)
    } else {
      perspCamRef.current?.position.set(15, 20, 20)
      perspCamRef.current?.lookAt(0, 0, 0)
      controlsRef.current?.target.set(0, 0, 0)
      controlsRef.current?.update()
    }
  }, [cameraMode, applyControlsForView])

  // ── pending placement → place product in scene ──────────────────────────

  useEffect(() => {
    if (!pendingPlacement || !sceneRef.current) return

    const scene = sceneRef.current
    const instanceId = `inst-${nextIdRef.current++}`
    const group = buildProceduralBay(pendingPlacement)
    group.name = instanceId
    group.userData = { instanceId, product: pendingPlacement }

    // Offset each new item slightly so they don't pile up
    const offset = nextIdRef.current * 1.5
    group.position.set(offset % roomWidth - roomWidth / 2, 0, 0)

    scene.add(group)
    placedMeshesRef.current.set(instanceId, group)

    // Add to cart
    const variant = pendingPlacement.variants[0]
    addCartItem({
      instanceId,
      sku: variant.sku,
      title: pendingPlacement.title,
      price: variant.price,
      quantity: 1,
      objectType: pendingPlacement.objectType,
    })

    // Clear pending
    setPendingPlacement(null)
  }, [pendingPlacement, setPendingPlacement, addCartItem, roomWidth, roomDepth])

  // ── selection highlight ─────────────────────────────────────────────────

  useEffect(() => {
    placedMeshesRef.current.forEach((group, id) => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mat = obj.material as THREE.MeshStandardMaterial
          if (id === selectedId) {
            mat.emissive = new THREE.Color(0x0088ff)
            mat.emissiveIntensity = 0.4
          } else {
            mat.emissive = new THREE.Color(0x000000)
            mat.emissiveIntensity = 0
          }
        }
      })
    })
  }, [selectedId])

  // ── click-to-select ─────────────────────────────────────────────────────

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const mount = mountRef.current
      if (!mount || !sceneRef.current) return
      const rect = mount.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const cam = cameraMode === '2d' ? orthoCamRef.current! : perspCamRef.current!
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, cam)
      const targets: THREE.Object3D[] = []
      placedMeshesRef.current.forEach((g) => targets.push(g))
      const hits = raycaster.intersectObjects(targets, true)
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object
        while (obj && !obj.userData.instanceId) obj = obj.parent
        if (obj?.userData.instanceId) {
          setSelectedId(obj.userData.instanceId as string)
          return
        }
      }
      setSelectedId(null)
    },
    [cameraMode, setSelectedId]
  )

  return (
    <div
      ref={mountRef}
      onClick={handleClick}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    />
  )
}

// ── room geometry ─────────────────────────────────────────────────────────────

function setupRoom(scene: THREE.Scene, roomWidth: number, roomDepth: number) {
  // Floor
  const floorGeo = new THREE.PlaneGeometry(roomWidth, roomDepth)
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 })
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  floor.name = '__floor__'
  scene.add(floor)

  // Grid
  const grid = new THREE.GridHelper(
    Math.max(roomWidth, roomDepth) * 2,
    Math.max(roomWidth, roomDepth) * 2,
    0x444444,
    0x333333
  )
  grid.position.y = 0.001
  grid.name = '__grid__'
  scene.add(grid)

  // Boundary walls (wireframe lines)
  const hw = roomWidth / 2
  const hd = roomDepth / 2
  const wallH = 0.1
  const pts = [
    new THREE.Vector3(-hw, 0, -hd),
    new THREE.Vector3(hw, 0, -hd),
    new THREE.Vector3(hw, 0, hd),
    new THREE.Vector3(-hw, 0, hd),
    new THREE.Vector3(-hw, 0, -hd),
  ]
  const boundaryGeo = new THREE.BufferGeometry().setFromPoints(pts)
  const boundaryMat = new THREE.LineBasicMaterial({ color: 0xff6b00, opacity: 0.6, transparent: true })
  const boundary = new THREE.Line(boundaryGeo, boundaryMat)
  boundary.position.y = wallH
  boundary.name = '__boundary__'
  scene.add(boundary)
}
