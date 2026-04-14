import type { CameraMode } from '../types'

export interface UiSlice {
  cameraMode: CameraMode
  catalogueOpen: boolean
  itemsPanelOpen: boolean
  helpOpen: boolean
  setupDone: boolean

  setCameraMode: (mode: CameraMode) => void
  toggleCataloguePanel: () => void
  setCatalogueOpen: (open: boolean) => void
  toggleItemsPanel: () => void
  setItemsPanelOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setSetupDone: (done: boolean) => void
}

export const createUiSlice = (
  set: (fn: (state: UiSlice) => Partial<UiSlice>) => void,
): UiSlice => ({
  cameraMode: '2d',
  catalogueOpen: false,
  itemsPanelOpen: false,
  helpOpen: false,
  setupDone: false,

  setCameraMode(mode) {
    set(() => ({ cameraMode: mode }))
  },

  toggleCataloguePanel() {
    set((s) => ({ catalogueOpen: !s.catalogueOpen }))
  },

  setCatalogueOpen(open) {
    set(() => ({ catalogueOpen: open }))
  },

  toggleItemsPanel() {
    set((s) => ({ itemsPanelOpen: !s.itemsPanelOpen }))
  },

  setItemsPanelOpen(open) {
    set(() => ({ itemsPanelOpen: open }))
  },

  setHelpOpen(open) {
    set(() => ({ helpOpen: open }))
  },

  setSetupDone(done) {
    set(() => ({ setupDone: done }))
  },
})
