import { create } from 'zustand'

export type CameraMode = '2d' | '3d'

interface SceneState {
  cameraMode: CameraMode
  roomWidth: number
  roomDepth: number
  selectedId: string | null

  setCameraMode: (mode: CameraMode) => void
  setRoomWidth: (w: number) => void
  setRoomDepth: (d: number) => void
  setSelectedId: (id: string | null) => void
}

export const useSceneStore = create<SceneState>((set) => ({
  cameraMode: '3d',
  roomWidth: 10,
  roomDepth: 8,
  selectedId: null,

  setCameraMode: (mode) => set({ cameraMode: mode }),
  setRoomWidth: (w) => set({ roomWidth: w }),
  setRoomDepth: (d) => set({ roomDepth: d }),
  setSelectedId: (id) => set({ selectedId: id }),
}))
