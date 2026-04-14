import type { StateCreator } from 'zustand'
import type { UIState, CameraMode } from '@/types'
import type { RootStore } from './index'

export interface UISlice {
  ui: UIState
  setCameraMode: (mode: CameraMode) => void
  toggleCameraMode: () => void
  setLeftPanelVisible: (visible: boolean) => void
  setRightPanelVisible: (visible: boolean) => void
  openModal: (modalId: string) => void
  closeModal: () => void
}

const initialUIState: UIState = {
  cameraMode: '3d',
  leftPanelVisible: true,
  rightPanelVisible: true,
  activeModal: null,
}

export const createUISlice: StateCreator<
  RootStore,
  [],
  [],
  UISlice
> = (set) => ({
  ui: initialUIState,

  setCameraMode: (mode) =>
    set((s) => ({ ui: { ...s.ui, cameraMode: mode } })),

  toggleCameraMode: () =>
    set((s) => ({
      ui: { ...s.ui, cameraMode: s.ui.cameraMode === '3d' ? '2d' : '3d' },
    })),

  setLeftPanelVisible: (visible) =>
    set((s) => ({ ui: { ...s.ui, leftPanelVisible: visible } })),

  setRightPanelVisible: (visible) =>
    set((s) => ({ ui: { ...s.ui, rightPanelVisible: visible } })),

  openModal: (modalId) =>
    set((s) => ({ ui: { ...s.ui, activeModal: modalId } })),

  closeModal: () =>
    set((s) => ({ ui: { ...s.ui, activeModal: null } })),
})
