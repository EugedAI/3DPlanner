import type { RoomItem, RoomType } from '../types'

export interface SceneSlice {
  // State
  items: RoomItem[]
  roomType: RoomType
  roomWidth: number
  roomDepth: number
  selectedId: number | null
  nextId: number

  // Actions
  setRoomConfig: (roomType: RoomType, width: number, depth: number) => void
  addItem: (item: RoomItem) => void
  removeItem: (instanceId: number) => void
  updateItem: (instanceId: number, patch: Partial<RoomItem>) => void
  selectItem: (instanceId: number | null) => void
  clearItems: () => RoomItem[]
  bumpNextId: () => number
}

export const createSceneSlice = (
  set: (fn: (state: SceneSlice) => Partial<SceneSlice>) => void,
  get: () => SceneSlice,
): SceneSlice => ({
  items: [],
  roomType: 'warehouse',
  roomWidth: 20,
  roomDepth: 15,
  selectedId: null,
  nextId: 1,

  setRoomConfig(roomType, width, depth) {
    set(() => ({ roomType, roomWidth: width, roomDepth: depth }))
  },

  addItem(item) {
    set((s) => ({ items: [...s.items, item] }))
  },

  removeItem(instanceId) {
    set((s) => ({
      items: s.items.filter((i) => i.instanceId !== instanceId),
      selectedId: s.selectedId === instanceId ? null : s.selectedId,
    }))
  },

  updateItem(instanceId, patch) {
    set((s) => ({
      items: s.items.map((i) =>
        i.instanceId === instanceId ? { ...i, ...patch } : i,
      ),
    }))
  },

  selectItem(instanceId) {
    set(() => ({ selectedId: instanceId }))
  },

  clearItems() {
    const current = get().items
    set(() => ({ items: [], selectedId: null }))
    return current
  },

  bumpNextId() {
    const id = get().nextId
    set(() => ({ nextId: id + 1 }))
    return id
  },
})
