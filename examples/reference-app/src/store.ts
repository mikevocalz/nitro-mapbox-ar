import { create } from 'zustand'

export type ReferenceMode = 'map' | 'navigate' | 'ar' | 'agent'

interface ReferenceState {
  mode: ReferenceMode
  setMode(mode: ReferenceMode): void
}

export const useReferenceStore = create<ReferenceState>((set) => ({
  mode: 'map',
  setMode: (mode) => set({ mode }),
}))
