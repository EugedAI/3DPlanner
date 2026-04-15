import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { useSceneStore } from '../store/useSceneStore'
import type { ProductVariant } from '../types'
import { getEquidistantSpacing } from '../lib/roomUtils'

// mm → metres
function mmToM(mm: number) {
  return mm / 1000
}

// Frame colour from frameCoating / objectType
function frameColour(
  objectType: string,
  frameCoating: string
): number {
  if (frameCoating.toLowerCase().includes('timber') ||
      frameCoating.toLowerCase().includes('wood')) {
    return 0xc4a265
  }
  if (frameCoating.toLowerCase().includes('powder')) {
    return 0xc0c0c0
  }
  const fallback: Record<string, number> = {
    starter: 0x4a90b8,
    extender: 0x6aab6a,
    shelf: 0xb8a04a,
    accessory: 0x9a6ab8,
  }
  return fallback[objectType] ?? 0x888888
}

interface BayMeshUserData {
  instanceId: string
  objectType: string
  width: number
  height: number
  depth: number
  numberOfShelves: number
  numberOfLevels: number
  compatibleShelfSku: string | null
}

/**
 * Build a procedural bay mesh.
 * isExtender: when true, left upright is omitted (shares right upright of neighbour).
 */
function buildBayMesh(
  variant: ProductVariant,
  objectType: string,
  instanceId: string,
  currentShelves?: number
): THREE.Group {
  const w = mmToM(variant.width)
  const h = variant.height > 0 ? mmToM(variant.height) : 0.05
  const d = mmToM(variant.depth)
  const isExtender = objectType === 'extender'
  const col = frameColour(objectType, variant.frameCoating)

  const group = new THREE.Group()
  group.name = instanceId

  const userData: BayMeshUserData = {
    instanceId,
    objectType,
    width: variant.width,
    height: variant.height,
    depth: variant.depth,
    numberOfShelves: variant.numberOfShelves,
    numberOfLevels: variant.numberOfLevels,
    compatibleShelfSku: variant.compatibleShelfSku,
  }
  group.userData = userData

  const frameMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55, metalness: 0.3 })

  // Uprights (40mm wide = 0.04m)
  const uprightW = 0.04
  const uprightGeo = new THREE.BoxGeometry(uprightW, h, d)

  // Right upright — always present
  const rightUpright = new THREE.Mesh(uprightGeo, frameMat)
  rightUpright.position.set(w / 2 - uprightW / 2, h / 2, 0)
  rightUpright.castShadow = true
  group.add(rightUpright)

  // Left upright — omitted for extenders
  if (!isExtender) {
    const leftUpright = new THREE.Mesh(uprightGeo, frameMat)
    leftUpright.position.set(-w / 2 + uprightW / 2, h / 2, 0)
    leftUpright.castShadow = true
    group.add(leftUpright)
  }

  // Shelves (20mm thick = 0.02m)
  const shelfCount = currentShelves ?? variant.numberOfShelves
  if (shelfCount > 0 && h > 0) {
    const shelfMat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.7,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
    })
    const spacing = getEquidistantSpacing(variant.height > 0 ? variant.height : 50, shelfCount)
    const shelfGeo = new THREE.BoxGeometry(w, 0.02, d)
    for (let i = 1; i <= shelfCount; i++) {
      const shelf = new THREE.Mesh(shelfGeo, shelfMat)
      shelf.position.y = i * spacing
      shelf.castShadow = true
      group.add(shelf)
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
  const itemsGroupRef = useRef<THREE.Group | null>(null)
  const placedMeshesRef = useRef<Map<string, THREE.Group>>(new Map())
  const nextIdRef = useRef(0)

  // Zustand selectors
  const cameraMode = useSceneStore((s) => s.cameraMode)
  const roomWidth = useSceneStore((s) => s.roomWidth)
  const roomDepth = useSceneStore((s) => s.roomDepth)
  const selectedId = useSceneStore((s) => s.selectedId)
  const setSelectedId = useSceneStore((s) => s.setSelectedId)
  const pendingPlacement = useSceneStore((s) => s.pendingPlacement)
  const setPendingPlacement = useSceneStore((s) => s.setPendingPlacement)
  const cartItems = useSceneStore((s) => s.cartItems)
  const validationError = useSceneStore((s) => s.validationError)
  const placeItem = useSceneStore((s) => s.placeItem)

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

    // Items group
    const itemsGroup = new THREE.Group()
    itemsGroup.name = '__items__'
    scene.add(itemsGroup)
    itemsGroupRef.current = itemsGroup

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

    // Unused loaders (Phase 2: GLB loading)
    const _draco = new DRACOLoader()
    const _gltf = new GLTFLoader()
    _gltf.setDRACOLoader(_draco)

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
    setupRoom(scene, useSceneStore.getState().roomWidth, useSceneStore.getState().roomDepth)

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

  // ── camera mode ─────────────────────────────────────────────────────────

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
    if (!pendingPlacement || !sceneRef.current || !itemsGroupRef.current) return

    const variant = pendingPlacement.variants[0]
    if (!variant) return

    const instanceId = `inst-${nextIdRef.current++}`

    // Calculate position: centre or adjacent to rightmost item in last active row
    const { cartItems: currentItems } = useSceneStore.getState()
    const bays = currentItems.filter(
      (i) => i.objectType === 'starter' || i.objectType === 'extender'
    )

    let x = 0
    let z = 0

    if (bays.length > 0) {
      // Find the row with the highest row index (last placed row)
      const rows: Array<{ z: number; items: typeof bays }> = []
      for (const bay of bays) {
        const bz = bay.z ?? 0
        const row = rows.find((r) => Math.abs(r.z - bz) <= 0.05)
        if (row) {
          row.items.push(bay)
        } else {
          rows.push({ z: bz, items: [bay] })
        }
      }
      // Use the last row
      const lastRow = rows[rows.length - 1]
      const rightmost = lastRow.items.reduce((a, b) =>
        (a.x ?? 0) > (b.x ?? 0) ? a : b
      )
      const rightmostX = rightmost.x ?? 0
      const rightmostW = (rightmost.variantWidth ?? 1200) / 1000
      const thisW = variant.width / 1000
      x = rightmostX + rightmostW / 2 + thisW / 2
      z = lastRow.z
    }

    // Attempt placement via Zustand action (runs bounds + collision checks)
    const placed = placeItem(pendingPlacement, variant, x, z, instanceId)
    if (!placed) {
      // Fallback: try centre of room
      const fallbackPlaced = placeItem(pendingPlacement, variant, 0, 0, instanceId)
      if (!fallbackPlaced) {
        // Cannot place — silently abort
        setPendingPlacement(null)
        return
      }
    }

    // Determine objectType as set by the store
    const updatedItems = useSceneStore.getState().cartItems
    const placed_item = updatedItems.find((i) => i.instanceId === instanceId)
    const objectType = placed_item?.objectType ?? pendingPlacement.objectType

    // Build mesh
    const group = buildBayMesh(variant, objectType, instanceId)
    const finalItem = updatedItems.find((i) => i.instanceId === instanceId)
    group.position.set(finalItem?.x ?? x, 0, finalItem?.z ?? z)
    itemsGroupRef.current.add(group)
    placedMeshesRef.current.set(instanceId, group)

    setPendingPlacement(null)
  }, [pendingPlacement, setPendingPlacement, placeItem])

  // ── sync scene with cartItems (removal) ────────────────────────────────

  useEffect(() => {
    if (!itemsGroupRef.current) return
    const itemsGroup = itemsGroupRef.current
    const cartIds = new Set(cartItems.map((i) => i.instanceId))

    // Remove meshes for items no longer in cart
    placedMeshesRef.current.forEach((group, id) => {
      if (!cartIds.has(id)) {
        itemsGroup.remove(group)
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose()
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose())
            } else {
              obj.material.dispose()
            }
          }
        })
        placedMeshesRef.current.delete(id)
      }
    })
  }, [cartItems])

  // ── update shelf count in scene ─────────────────────────────────────────

  useEffect(() => {
    if (!itemsGroupRef.current) return
    const itemsGroup = itemsGroupRef.current

    cartItems.forEach((item) => {
      if (item.objectType !== 'starter' && item.objectType !== 'extender') return
      const liveCount = (item as typeof item & { currentShelves?: number }).currentShelves
      if (liveCount === undefined) return

      const existing = placedMeshesRef.current.get(item.instanceId)
      if (!existing) return

      // Rebuild mesh with new shelf count
      const variant: ProductVariant = {
        id: '',
        sku: item.sku,
        price: item.price,
        availableForSale: true,
        width: item.variantWidth ?? 1200,
        height: item.variantHeight ?? 2000,
        depth: item.variantDepth ?? 800,
        numberOfShelves: item.numberOfShelves ?? 3,
        numberOfLevels: item.numberOfLevels ?? 5,
        kgPerShelf: 500,
        frameMaterial: 'Steel',
        frameCoating: 'Powder Coated',
        shelfType: 'Steel Panels',
        compatibleShelfSku: item.compatibleShelfSku ?? null,
      }

      // Dispose old mesh
      itemsGroup.remove(existing)
      existing.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
          else obj.material.dispose()
        }
      })

      // Build new mesh
      const group = buildBayMesh(variant, item.objectType, item.instanceId, liveCount)
      group.position.set(item.x ?? 0, 0, item.z ?? 0)
      itemsGroup.add(group)
      placedMeshesRef.current.set(item.instanceId, group)
    })
  }, [cartItems])

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

  // ── validation highlight (amber outline on invalid bays) ────────────────

  useEffect(() => {
    if (!validationError) {
      // Clear amber on all meshes
      placedMeshesRef.current.forEach((group) => {
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            const mat = obj.material as THREE.MeshStandardMaterial
            if (mat.emissive?.getHex() === 0xff8c00) {
              mat.emissive = new THREE.Color(0x000000)
              mat.emissiveIntensity = 0
            }
          }
        })
      })
      return
    }

    // Find extenders whose row has no starter
    const bays = cartItems.filter(
      (i) => i.objectType === 'starter' || i.objectType === 'extender'
    )
    const affectedIds = new Set<string>()
    const rows: Array<{ z: number; items: typeof bays }> = []
    for (const bay of bays) {
      const bz = bay.z ?? 0
      const row = rows.find((r) => Math.abs(r.z - bz) <= 0.05)
      if (row) row.items.push(bay)
      else rows.push({ z: bz, items: [bay] })
    }
    for (const row of rows) {
      const hasStarter = row.items.some((i) => i.objectType === 'starter')
      if (!hasStarter) {
        row.items.forEach((i) => affectedIds.add(i.instanceId))
      }
    }

    placedMeshesRef.current.forEach((group, id) => {
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const mat = obj.material as THREE.MeshStandardMaterial
          if (affectedIds.has(id)) {
            mat.emissive = new THREE.Color(0xff8c00) // amber
            mat.emissiveIntensity = 0.5
          }
        }
      })
    })
  }, [validationError, cartItems])

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
        while (obj && !(obj.userData as BayMeshUserData).instanceId) obj = obj.parent
        const ud = obj?.userData as BayMeshUserData | undefined
        if (ud?.instanceId) {
          setSelectedId(ud.instanceId)
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

  // Room boundary
  const hw = roomWidth / 2
  const hd = roomDepth / 2
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
  boundary.position.y = 0.1
  boundary.name = '__boundary__'
  scene.add(boundary)
}
