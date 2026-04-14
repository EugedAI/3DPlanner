/**
 * buildStarterBay — Procedural geometry for a Starter bay.
 *
 * Dev phase only. All dimensions in millimetres.
 *
 * Structure:
 *  - 2 uprights: narrow BoxGeometry on left and right sides
 *  - N shelf panels: flat BoxGeometry, 20mm thick, equidistant spacing
 *
 * Shelf spacing formula (ARCHITECTURE.md §7):
 *   spacing = height ÷ (shelfCount + 1)
 *
 * Colour: #C0C0C0 (Steel / Powder Coated) per ARCHITECTURE.md §9
 */

import * as THREE from 'three'

const UPRIGHT_WIDTH = 60   // mm — narrow profile
const UPRIGHT_DEPTH_RATIO = 1  // full depth
const SHELF_THICKNESS = 20     // mm — flat panel

interface BuildStarterBayOptions {
  width: number
  height: number
  depth: number
  shelfCount: number
  colour: number
}

export function buildStarterBay({
  width,
  height,
  depth,
  shelfCount,
  colour,
}: BuildStarterBayOptions): THREE.Group {
  const group = new THREE.Group()

  const mat = new THREE.MeshLambertMaterial({ color: colour })

  // ── Uprights ───────────────────────────────────────────────────────────────
  // Left upright
  const uprightGeo = new THREE.BoxGeometry(UPRIGHT_WIDTH, height, depth * UPRIGHT_DEPTH_RATIO)
  const leftUpright = new THREE.Mesh(uprightGeo, mat)
  leftUpright.position.set(-(width / 2) + UPRIGHT_WIDTH / 2, height / 2, 0)
  leftUpright.castShadow = true
  leftUpright.receiveShadow = true
  leftUpright.userData['bayId'] = group.uuid
  group.add(leftUpright)

  // Right upright
  const rightUpright = new THREE.Mesh(uprightGeo, mat)
  rightUpright.position.set((width / 2) - UPRIGHT_WIDTH / 2, height / 2, 0)
  rightUpright.castShadow = true
  rightUpright.receiveShadow = true
  rightUpright.userData['bayId'] = group.uuid
  group.add(rightUpright)

  // ── Shelf panels ───────────────────────────────────────────────────────────
  // Equidistant spacing: spacing = height ÷ (shelfCount + 1)
  const innerWidth = width - UPRIGHT_WIDTH * 2
  const shelfGeo = new THREE.BoxGeometry(innerWidth, SHELF_THICKNESS, depth)
  const spacing = height / (shelfCount + 1)

  for (let i = 1; i <= shelfCount; i++) {
    const shelf = new THREE.Mesh(shelfGeo, mat)
    shelf.position.set(0, spacing * i, 0)
    shelf.castShadow = true
    shelf.receiveShadow = true
    shelf.userData['bayId'] = group.uuid
    group.add(shelf)
  }

  // ── Group metadata ─────────────────────────────────────────────────────────
  group.name = group.uuid
  group.userData['bayId'] = group.uuid
  group.userData['objectType'] = 'starter'
  group.userData['dimensions'] = { width, height, depth }
  group.userData['shelfCount'] = shelfCount

  return group
}
