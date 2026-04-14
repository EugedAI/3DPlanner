import type { StateCreator } from 'zustand'
import type { SceneState, PlacedBay, PlacedAccessory, ValidationError } from '@/types'
import type { RootStore } from './index'

export interface SceneSlice {
  scene: SceneState

  // Bay mutations
  addBay: (bay: PlacedBay) => void
  removeBay: (id: string) => void
  updateBay: (id: string, patch: Partial<PlacedBay>) => void

  // Accessory mutations
  addAccessory: (accessory: PlacedAccessory) => void
  removeAccessory: (id: string) => void

  // Selection
  selectObject: (id: string | null) => void

  // Validation
  setValidationErrors: (errors: ValidationError[]) => void
}

const initialSceneState: SceneState = {
  bays: [],
  accessories: [],
  selectedId: null,
  validationErrors: [],
}

export const createSceneSlice: StateCreator<
  RootStore,
  [],
  [],
  SceneSlice
> = (set) => ({
  scene: initialSceneState,

  addBay: (bay) =>
    set((s) => ({ scene: { ...s.scene, bays: [...s.scene.bays, bay] } })),

  removeBay: (id) =>
    set((s) => ({
      scene: {
        ...s.scene,
        bays: s.scene.bays.filter((b) => b.id !== id),
        selectedId: s.scene.selectedId === id ? null : s.scene.selectedId,
      },
    })),

  updateBay: (id, patch) =>
    set((s) => ({
      scene: {
        ...s.scene,
        bays: s.scene.bays.map((b) => (b.id === id ? { ...b, ...patch } : b)),
      },
    })),

  addAccessory: (accessory) =>
    set((s) => ({
      scene: { ...s.scene, accessories: [...s.scene.accessories, accessory] },
    })),

  removeAccessory: (id) =>
    set((s) => ({
      scene: {
        ...s.scene,
        accessories: s.scene.accessories.filter((a) => a.id !== id),
      },
    })),

  selectObject: (id) =>
    set((s) => ({ scene: { ...s.scene, selectedId: id } })),

  setValidationErrors: (errors) =>
    set((s) => ({ scene: { ...s.scene, validationErrors: errors } })),
})
