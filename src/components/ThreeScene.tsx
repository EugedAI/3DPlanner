import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { useSceneStore } from '../store/useSceneStore'

// ─── Starter bay procedural mesh ─────────────────────────────────────────────
// All dimensions in mm → Three.js units: divide by 1000
const SCALE = 1 / 1000

function buildStarterBay(): THREE.Group {
  const W = 1200 * SCALE   // 1.2
  const H = 2000 * SCALE   // 2.0
  const D = 800 * SCALE    // 0.8
  const color = 0xc0c0c0
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.4 })

  const group = new THREE.Group()
  group.userData = {
    instanceId: 'test-1',
    width: 1200,
    height: 2000,
    depth: 800,
    objectType: 'starter',
  }

  // Two uprights — narrow, full height
  const uprightW = 0.04
  const uprightD = D
  const uprightGeo = new THREE.BoxGeometry(uprightW, H, uprightD)

  const leftUpright = new THREE.Mesh(uprightGeo, mat)
  leftUpright.position.set(-W / 2 + uprightW / 2, H / 2, 0)
  leftUpright.castShadow = true
  leftUpright.receiveShadow = true
  group.add(leftUpright)

  const rightUpright = new THREE.Mesh(uprightGeo, mat)
  rightUpright.position.set(W / 2 - uprightW / 2, H / 2, 0)
  rightUpright.castShadow = true
  rightUpright.receiveShadow = true
  group.add(rightUpright)

  // Three shelf panels — flat, 20 mm thick
  const shelfThickness = 20 * SCALE // 0.02
  const shelfW = W - uprightW * 2
  const shelfGeo = new THREE.BoxGeometry(shelfW, shelfThickness, D)

  // Equidistant spacing: 2000 ÷ (3 + 1) = 500 mm = 0.5 units
  const shelfCount = 3
  const spacing = H / (shelfCount + 1)
  for (let i = 1; i <= shelfCount; i++) {
    const shelf = new THREE.Mesh(shelfGeo, mat)
    shelf.position.set(0, spacing * i, 0)
    shelf.castShadow = true
    shelf.receiveShadow = true
    group.add(shelf)
  }

  return group
}

// ─── CSS2D dimension labels ───────────────────────────────────────────────────
function createLabel(text: string): CSS2DObject {
  const div = document.createElement('div')
  div.className = 'dimension-label'
  div.textContent = text
  return new CSS2DObject(div)
}

// ─── ThreeScene component ─────────────────────────────────────────────────────
export default function ThreeScene() {
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Three.js imperative refs ──────────────────────────────────────────────
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const labelRendererRef = useRef<CSS2DRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const perspCameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orthoCameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const roomGroupRef = useRef<THREE.Group | null>(null)
  const itemsGroupRef = useRef<THREE.Group | null>(null)
  const rafRef = useRef<number | null>(null)
  const gltfLoaderRef = useRef<GLTFLoader | null>(null)

  // ── Mutable ref so RAF loop never captures stale closure values ───────────
  const is2DRef = useRef<boolean>(false)

  // ── Dimension-label objects attached to selected mesh ─────────────────────
  const activeLabelRefs = useRef<CSS2DObject[]>([])
  // Track which mesh currently has the wireframe highlight child
  const selectedMeshRef = useRef<THREE.Mesh | null>(null)

  // ── Zustand state ─────────────────────────────────────────────────────────
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const roomWidth = useSceneStore((s) => s.roomWidth)
  const roomDepth = useSceneStore((s) => s.roomDepth)
  const selectedId = useSceneStore((s) => s.selectedId)
  const setSelectedId = useSceneStore((s) => s.setSelectedId)

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getActiveCamera(): THREE.Camera {
    return is2DRef.current ? orthoCameraRef.current! : perspCameraRef.current!
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2a — Lighting
  // ─────────────────────────────────────────────────────────────────────────
  function setupLighting(scene: THREE.Scene) {
    const ambient = new THREE.AmbientLight(0xfff5e6, 0.5)
    scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0xf0f0f0, 0x303030, 0.3)
    scene.add(hemi)

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

  // ─────────────────────────────────────────────────────────────────────────
  // 2a — Controls per view
  // ─────────────────────────────────────────────────────────────────────────
  function applyControlsForView(controls: OrbitControls, is2D: boolean) {
    if (is2D) {
      controls.enableRotate = false
      controls.enableZoom = true
      controls.enablePan = true
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }
      controls.touches = {
        ONE: THREE.TOUCH.PAN,
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

  // ─────────────────────────────────────────────────────────────────────────
  // 2b — Room setup
  // ─────────────────────────────────────────────────────────────────────────
  function setupRoom(
    roomGroup: THREE.Group,
    width: number,
    depth: number,
    is2D: boolean,
  ) {
    // Clear existing children
    while (roomGroup.children.length > 0) {
      const child = roomGroup.children[0]
      roomGroup.remove(child)
      if ((child as THREE.Mesh).geometry) {
        ;(child as THREE.Mesh).geometry.dispose()
      }
    }

    // Floor
    const floorGeo = new THREE.PlaneGeometry(width, depth)
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e1e1e,
      roughness: 0.9,
      metalness: 0.1,
    })
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    roomGroup.add(floor)

    // Grid — divisions = max(width, depth) in metres (1 division per unit)
    const gridSize = Math.max(width, depth)
    const gridDiv = Math.round(gridSize)
    const gridHelper = new THREE.GridHelper(gridSize, gridDiv, 0x2a2a2a, 0x2a2a2a)
    gridHelper.position.y = 0.005
    gridHelper.visible = is2D
    gridHelper.name = 'gridHelper'
    roomGroup.add(gridHelper)

    // Room boundary — orange #FF6B00
    const hw = width / 2
    const hd = depth / 2
    const boundaryPts = [
      new THREE.Vector3(-hw, 0.01, -hd),
      new THREE.Vector3(hw, 0.01, -hd),
      new THREE.Vector3(hw, 0.01, hd),
      new THREE.Vector3(-hw, 0.01, hd),
      new THREE.Vector3(-hw, 0.01, -hd),
    ]
    const boundaryGeo = new THREE.BufferGeometry().setFromPoints(boundaryPts)
    const boundaryMat = new THREE.LineBasicMaterial({ color: 0xff6b00 })
    roomGroup.add(new THREE.Line(boundaryGeo, boundaryMat))

    // Walls
    const wallHeight = 3
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
    })
    const wallEdgeMat = new THREE.LineBasicMaterial({ color: 0x333333 })

    const wallDefs: Array<{ w: number; pos: [number, number, number]; rot: [number, number, number] }> = [
      { w: width, pos: [0, wallHeight / 2, -hd], rot: [0, 0, 0] },
      { w: width, pos: [0, wallHeight / 2, hd], rot: [0, 0, 0] },
      { w: depth, pos: [-hw, wallHeight / 2, 0], rot: [0, Math.PI / 2, 0] },
      { w: depth, pos: [hw, wallHeight / 2, 0], rot: [0, Math.PI / 2, 0] },
    ]

    wallDefs.forEach((def) => {
      const geo = new THREE.PlaneGeometry(def.w, wallHeight)
      const wall = new THREE.Mesh(geo, wallMat)
      wall.position.set(...def.pos)
      wall.rotation.set(...def.rot)
      roomGroup.add(wall)

      const edgeGeo = new THREE.EdgesGeometry(geo)
      const edges = new THREE.LineSegments(edgeGeo, wallEdgeMat)
      edges.position.copy(wall.position)
      edges.rotation.copy(wall.rotation)
      roomGroup.add(edges)
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2b — Wireframe highlight helpers
  // ─────────────────────────────────────────────────────────────────────────
  const WIREFRAME_NAME = '__wf_highlight__'

  function addWireframe(mesh: THREE.Mesh) {
    removeWireframe(mesh)
    const wfGeo = new THREE.WireframeGeometry(mesh.geometry)
    const wfMat = new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 1 })
    const wf = new THREE.LineSegments(wfGeo, wfMat)
    wf.name = WIREFRAME_NAME
    wf.raycast = () => {} // don't intercept raycasts
    mesh.add(wf)
  }

  function removeWireframe(mesh: THREE.Mesh) {
    const existing = mesh.getObjectByName(WIREFRAME_NAME)
    if (existing) mesh.remove(existing)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2b — Dimension labels
  // ─────────────────────────────────────────────────────────────────────────
  function attachLabels(group: THREE.Group) {
    detachLabels()

    const { width, height, depth } = group.userData as {
      width: number
      height: number
      depth: number
    }
    if (!width && !height && !depth) return

    // Compute bounding box in world space
    const box = new THREE.Box3().setFromObject(group)
    const size = new THREE.Vector3()
    box.getSize(size)
    const center = new THREE.Vector3()
    box.getCenter(center)

    // Width label — top centre
    const wLabel = createLabel(`W: ${width}mm`)
    wLabel.position.set(center.x, box.max.y + 0.05, center.z)
    sceneRef.current!.add(wLabel)
    activeLabelRefs.current.push(wLabel)

    // Height label — right centre
    const hLabel = createLabel(`H: ${height}mm`)
    hLabel.position.set(box.max.x + 0.05, center.y, center.z)
    sceneRef.current!.add(hLabel)
    activeLabelRefs.current.push(hLabel)

    // Depth label — front centre
    const dLabel = createLabel(`D: ${depth}mm`)
    dLabel.position.set(center.x, center.y, box.max.z + 0.05)
    sceneRef.current!.add(dLabel)
    activeLabelRefs.current.push(dLabel)
  }

  function detachLabels() {
    activeLabelRefs.current.forEach((lbl) => {
      if (sceneRef.current) sceneRef.current.remove(lbl)
    })
    activeLabelRefs.current = []
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2b — Find the first real Mesh in a group (for wireframe target)
  // ─────────────────────────────────────────────────────────────────────────
  function findFirstMesh(obj: THREE.Object3D): THREE.Mesh | null {
    if ((obj as THREE.Mesh).isMesh) return obj as THREE.Mesh
    for (const child of obj.children) {
      const found = findFirstMesh(child)
      if (found) return found
    }
    return null
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Main init — runs once on mount
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const w = container.clientWidth
    const h = container.clientHeight

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)
    sceneRef.current = scene

    // ── WebGL Renderer ─────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // ── CSS2DRenderer ──────────────────────────────────────────────────────
    const labelRenderer = new CSS2DRenderer()
    labelRenderer.setSize(w, h)
    labelRenderer.domElement.style.position = 'absolute'
    labelRenderer.domElement.style.top = '0'
    labelRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(labelRenderer.domElement)
    labelRendererRef.current = labelRenderer

    // ── DRACOLoader + GLTFLoader ───────────────────────────────────────────
    const draco = new DRACOLoader()
    draco.setDecoderPath('/draco/')
    const gltfLoader = new GLTFLoader()
    gltfLoader.setDRACOLoader(draco)
    gltfLoaderRef.current = gltfLoader

    // ── Cameras ────────────────────────────────────────────────────────────
    const perspCamera = new THREE.PerspectiveCamera(50, w / h, 0.1, 500)
    perspCamera.position.set(10, 12, 10)
    perspCamera.lookAt(0, 0, 0)
    perspCameraRef.current = perspCamera

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

    // ── OrbitControls ──────────────────────────────────────────────────────
    const currentIs2D = useSceneStore.getState().cameraMode === '2d'
    is2DRef.current = currentIs2D

    const controls = new OrbitControls(
      currentIs2D ? orthoCamera : perspCamera,
      renderer.domElement,
    )
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    applyControlsForView(controls, currentIs2D)
    controlsRef.current = controls

    // ── Lighting ───────────────────────────────────────────────────────────
    setupLighting(scene)

    // ── Groups ─────────────────────────────────────────────────────────────
    const roomGroup = new THREE.Group()
    roomGroup.name = 'roomGroup'
    scene.add(roomGroup)
    roomGroupRef.current = roomGroup

    const itemsGroup = new THREE.Group()
    itemsGroup.name = 'itemsGroup'
    scene.add(itemsGroup)
    itemsGroupRef.current = itemsGroup

    // ── Initial room build ─────────────────────────────────────────────────
    const { roomWidth: rw, roomDepth: rd } = useSceneStore.getState()
    setupRoom(roomGroup, rw, rd, currentIs2D)

    // ── Test starter bay ───────────────────────────────────────────────────
    const starterBay = buildStarterBay()
    starterBay.position.set(0, 0, 0)
    itemsGroup.add(starterBay)

    // ── RAF loop ───────────────────────────────────────────────────────────
    function animate() {
      rafRef.current = requestAnimationFrame(animate)
      controls.update()
      const cam = is2DRef.current ? orthoCamera : perspCamera
      renderer.render(scene, cam)
      labelRenderer.render(scene, cam)
    }
    animate()

    // ── ResizeObserver ─────────────────────────────────────────────────────
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width: rw2, height: rh } = entry.contentRect
      if (rw2 === 0 || rh === 0) return

      renderer.setSize(rw2, rh)
      labelRenderer.setSize(rw2, rh)

      perspCamera.aspect = rw2 / rh
      perspCamera.updateProjectionMatrix()

      const asp = rw2 / rh
      orthoCamera.left = -frustum * asp
      orthoCamera.right = frustum * asp
      orthoCamera.top = frustum
      orthoCamera.bottom = -frustum
      orthoCamera.updateProjectionMatrix()
    })
    ro.observe(container)

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      ro.disconnect()
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
      if (container.contains(labelRenderer.domElement)) container.removeChild(labelRenderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // 2b — Camera mode effect (watches Zustand cameraMode)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const controls = controlsRef.current
    const persp = perspCameraRef.current
    const ortho = orthoCameraRef.current
    const roomGroup = roomGroupRef.current
    const renderer = rendererRef.current

    if (!controls || !persp || !ortho || !roomGroup || !renderer) return

    const is2D = cameraMode === '2d'
    is2DRef.current = is2D

    // Swap the camera OrbitControls listens to
    controls.object = is2D ? ortho : persp
    applyControlsForView(controls, is2D)
    controls.update()

    // Grid visible only in 2D
    const grid = roomGroup.getObjectByName('gridHelper')
    if (grid) grid.visible = is2D

    // Adjust ortho zoom when switching to 2D
    if (is2D) {
      const { roomWidth: rw, roomDepth: rd } = useSceneStore.getState()
      const maxDim = Math.max(rw, rd)
      const container = containerRef.current
      if (container) {
        ortho.zoom =
          Math.min(container.clientWidth, container.clientHeight) / (maxDim * 50)
        ortho.updateProjectionMatrix()
      }
    }
  }, [cameraMode])

  // ─────────────────────────────────────────────────────────────────────────
  // 2b — Room rebuild when dimensions change
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const roomGroup = roomGroupRef.current
    if (!roomGroup) return
    setupRoom(roomGroup, roomWidth, roomDepth, is2DRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomWidth, roomDepth])

  // ─────────────────────────────────────────────────────────────────────────
  // 2b — Sync highlight + labels when selectedId changes from outside
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const itemsGroup = itemsGroupRef.current
    if (!itemsGroup) return

    // Remove wireframe from previously selected mesh
    if (selectedMeshRef.current) {
      removeWireframe(selectedMeshRef.current)
      selectedMeshRef.current = null
    }

    detachLabels()

    if (selectedId === null) return

    // Find the matching group in itemsGroup
    const targetGroup = itemsGroup.children.find(
      (obj) => obj.userData.instanceId === selectedId,
    ) as THREE.Group | undefined

    if (!targetGroup) return

    const mesh = findFirstMesh(targetGroup)
    if (mesh) {
      addWireframe(mesh)
      selectedMeshRef.current = mesh
    }

    attachLabels(targetGroup)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ─────────────────────────────────────────────────────────────────────────
  // 2b — Click-to-select handler
  // ─────────────────────────────────────────────────────────────────────────
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const container = containerRef.current
    const itemsGroup = itemsGroupRef.current
    if (!container || !itemsGroup) return

    const rect = container.getBoundingClientRect()
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), getActiveCamera())

    // Collect all meshes in itemsGroup (exclude wireframe helpers)
    const meshes: THREE.Mesh[] = []
    itemsGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh && obj.name !== WIREFRAME_NAME) {
        meshes.push(obj as THREE.Mesh)
      }
    })

    const hits = raycaster.intersectObjects(meshes, false)

    if (hits.length > 0) {
      // Walk up to find the root group that has instanceId
      let obj: THREE.Object3D | null = hits[0].object
      while (obj && !obj.userData.instanceId) {
        obj = obj.parent
      }
      if (obj && obj.userData.instanceId) {
        setSelectedId(obj.userData.instanceId as string)
      }
    } else {
      setSelectedId(null)
    }
  }

  return (
    <div
      ref={containerRef}
      className="scene-container"
      onClick={handleClick}
    />
  )
}
