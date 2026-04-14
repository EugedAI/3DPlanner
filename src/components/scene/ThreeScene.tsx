/**
 * ThreeScene — Centre panel Three.js canvas.
 *
 * Single scene, two cameras:
 *  - PerspectiveCamera  → 3D mode (orbit controls)
 *  - OrthographicCamera → 2D mode (pan controls, grid visible)
 *
 * Sync invariant: both cameras view the same scene graph at all times.
 *
 * Dev phase: all geometry is procedural (BoxGeometry).
 * Launch phase: swap to GLTF models via useModelLoader — procedural is the fallback.
 */

import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { useStore, useUI, useScene } from '@/store'
import { buildStarterBay } from './buildStarterBay'

// Snap grid parameters (visible in 2D mode)
const GRID_SIZE = 10000   // mm footprint
const GRID_DIVISIONS = 40 // every 250mm

export function ThreeScene() {
  const mountRef = useRef<HTMLDivElement>(null)

  // Read camera mode from store — used inside animation loop via ref
  const ui = useUI()
  const scene = useScene()
  const cameraModeRef = useRef(ui.cameraMode)
  const selectedIdRef = useRef(scene.selectedId)

  const selectObject = useStore((s) => s.selectObject)

  // Keep refs in sync with store (avoids stale closures inside animation loop)
  useEffect(() => { cameraModeRef.current = ui.cameraMode }, [ui.cameraMode])
  useEffect(() => { selectedIdRef.current = scene.selectedId }, [scene.selectedId])

  // ── Scene setup ─────────────────────────────────────────────────────────────
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer
    css2dRenderer: CSS2DRenderer
    scene: THREE.Scene
    perspCamera: THREE.PerspectiveCamera
    orthoCamera: THREE.OrthographicCamera
    orbitControls: OrbitControls
    panControls: OrbitControls
    outlineMesh: THREE.Mesh | null
    bayGroup: THREE.Group
  } | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const W = mount.clientWidth
    const H = mount.clientHeight

    // ── WebGL renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(W, H)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    // ── CSS2D renderer (dimension labels) ──────────────────────────────────
    const css2dRenderer = new CSS2DRenderer()
    css2dRenderer.setSize(W, H)
    css2dRenderer.domElement.style.position = 'absolute'
    css2dRenderer.domElement.style.top = '0'
    css2dRenderer.domElement.style.pointerEvents = 'none'
    mount.appendChild(css2dRenderer.domElement)

    // ── Scene ───────────────────────────────────────────────────────────────
    const threeScene = new THREE.Scene()
    threeScene.background = new THREE.Color(0xf0f0f0)

    // Ambient + directional light
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    threeScene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(3000, 5000, 3000)
    dirLight.castShadow = true
    threeScene.add(dirLight)

    // ── Grid (visible in 2D mode) ────────────────────────────────────────────
    const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0xaaaaaa, 0xdddddd)
    grid.name = 'grid'
    threeScene.add(grid)

    // ── Perspective camera (3D) ──────────────────────────────────────────────
    const perspCamera = new THREE.PerspectiveCamera(45, W / H, 1, 100000)
    perspCamera.position.set(2000, 2500, 4000)
    perspCamera.lookAt(0, 1000, 0)

    // ── Orthographic camera (2D) ─────────────────────────────────────────────
    const orthoCamera = new THREE.OrthographicCamera(
      -W / 2, W / 2, H / 2, -H / 2, 1, 100000,
    )
    orthoCamera.position.set(0, 10000, 0)
    orthoCamera.lookAt(0, 0, 0)
    orthoCamera.zoom = 0.3
    orthoCamera.updateProjectionMatrix()

    // ── Orbit controls (3D — perspective) ───────────────────────────────────
    const orbitControls = new OrbitControls(perspCamera, renderer.domElement)
    orbitControls.enableDamping = true
    orbitControls.dampingFactor = 0.05
    orbitControls.target.set(0, 1000, 0)
    orbitControls.update()

    // ── Pan controls (2D — orthographic) ─────────────────────────────────────
    const panControls = new OrbitControls(orthoCamera, renderer.domElement)
    panControls.enableRotate = false
    panControls.enableZoom = true
    panControls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    }
    panControls.enableDamping = true
    panControls.dampingFactor = 0.05

    // ── Procedural starter bay ───────────────────────────────────────────────
    // bayGroup.name and userData['bayId'] are both set to group.uuid by buildStarterBay.
    // Do NOT overwrite bayGroup.name — selection lookup uses getObjectByName(bayId).
    const bayGroup = buildStarterBay({
      width: 1200,
      height: 2000,
      depth: 800,
      shelfCount: 3,
      colour: 0xc0c0c0,
    })
    threeScene.add(bayGroup)

    // ── Animation loop ───────────────────────────────────────────────────────
    // Use an object so cancellation reference is always current
    const raf = { id: 0 }

    function animate() {
      raf.id = requestAnimationFrame(animate)
      const mode = cameraModeRef.current
      const activeCamera = mode === '3d' ? perspCamera : orthoCamera

      if (mode === '3d') {
        orbitControls.update()
        grid.visible = false
      } else {
        panControls.update()
        grid.visible = true
      }

      renderer.render(threeScene, activeCamera)
      css2dRenderer.render(threeScene, activeCamera)
    }
    animate()

    threeRef.current = {
      renderer,
      css2dRenderer,
      scene: threeScene,
      perspCamera,
      orthoCamera,
      orbitControls,
      panControls,
      outlineMesh: null,
      bayGroup,
    }

    // ── Resize handler ───────────────────────────────────────────────────────
    const onResize = () => {
      if (!mount) return
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      css2dRenderer.setSize(w, h)
      perspCamera.aspect = w / h
      perspCamera.updateProjectionMatrix()
      orthoCamera.left = -w / 2
      orthoCamera.right = w / 2
      orthoCamera.top = h / 2
      orthoCamera.bottom = -h / 2
      orthoCamera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf.id)
      orbitControls.dispose()
      panControls.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      if (mount.contains(css2dRenderer.domElement)) {
        mount.removeChild(css2dRenderer.domElement)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Click-to-select ─────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const three = threeRef.current
      const mount = mountRef.current
      if (!three || !mount) return

      const rect = mount.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )

      const mode = cameraModeRef.current
      const activeCamera = mode === '3d' ? three.perspCamera : three.orthoCamera
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(ndc, activeCamera)

      const hits = raycaster.intersectObjects(three.scene.children, true)

      // Find the first hit that belongs to a bay group
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object
        while (obj) {
          if (obj.userData['bayId'] as string | undefined) {
            const bayId = obj.userData['bayId'] as string
            const currentSelected = selectedIdRef.current
            selectObject(currentSelected === bayId ? null : bayId)
            return
          }
          obj = obj.parent
        }
      }

      // Clicked empty space — deselect
      selectObject(null)
    },
    [selectObject],
  )

  // ── Highlight selected bay ──────────────────────────────────────────────────
  useEffect(() => {
    const three = threeRef.current
    if (!three) return

    // Remove previous outline
    if (three.outlineMesh) {
      three.scene.remove(three.outlineMesh)
      three.outlineMesh.geometry.dispose()
      ;(three.outlineMesh.material as THREE.Material).dispose()
      three.outlineMesh = null
    }

    if (!scene.selectedId) return

    // Find the selected bay group
    const bayGroup = three.scene.getObjectByName(scene.selectedId)
    if (!bayGroup) return

    // Compute bounding box
    const box = new THREE.Box3().setFromObject(bayGroup)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    // Slightly enlarged wireframe outline
    const geo = new THREE.BoxGeometry(
      size.x + 20, size.y + 20, size.z + 20,
    )
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0088ff,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    })
    const outline = new THREE.Mesh(geo, mat)
    outline.position.copy(center)
    outline.name = '__selection_outline__'
    three.scene.add(outline)
    three.outlineMesh = outline
  }, [scene.selectedId])

  // ── CSS2D dimension labels on selected bay ──────────────────────────────────
  useEffect(() => {
    const three = threeRef.current
    if (!three) return

    // Remove existing labels
    const toRemove: THREE.Object3D[] = []
    three.scene.traverse((obj) => {
      if (obj.userData['isDimensionLabel'] === true) toRemove.push(obj)
    })
    toRemove.forEach((obj) => {
      obj.parent?.remove(obj)
      if (obj instanceof CSS2DObject) {
        obj.element.remove()
      }
    })

    if (!scene.selectedId) return

    const bayGroup = three.scene.getObjectByName(scene.selectedId)
    if (!bayGroup) return

    const dims = bayGroup.userData['dimensions'] as
      | { width: number; height: number; depth: number }
      | undefined

    if (!dims) return

    const box = new THREE.Box3().setFromObject(bayGroup)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const labels: Array<{ text: string; pos: THREE.Vector3 }> = [
      {
        text: `W: ${dims.width}mm`,
        pos: new THREE.Vector3(center.x, box.max.y + 120, center.z),
      },
      {
        text: `H: ${dims.height}mm`,
        pos: new THREE.Vector3(box.max.x + 120, center.y, center.z),
      },
      {
        text: `D: ${dims.depth}mm`,
        pos: new THREE.Vector3(center.x, center.y, box.max.z + 120),
      },
    ]

    labels.forEach(({ text, pos }) => {
      const div = document.createElement('div')
      div.className = 'dimension-label'
      div.textContent = text
      div.style.cssText = [
        'background: rgba(0,0,0,0.7)',
        'color: #fff',
        'padding: 3px 7px',
        'border-radius: 4px',
        'font: bold 12px/1.4 monospace',
        'pointer-events: none',
        'white-space: nowrap',
      ].join(';')

      const label = new CSS2DObject(div)
      label.position.copy(pos)
      label.userData['isDimensionLabel'] = true
      three.scene.add(label)
    })
  }, [scene.selectedId])

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', position: 'relative', cursor: 'crosshair' }}
      onClick={handleClick}
    />
  )
}
