import { create } from 'zustand'
import {
  isGraphiteWebGPUAvailable,
  routeGeometryToCoordinates,
} from '@mikevocalz/nitro-mapbox-ar'
import {
  createReactVisionSpatialBridge,
  createViroSpatialHostProbe,
  getSpatialHostCapabilities,
  type GeoCoordinate,
  type ReactVisionGeospatialNavigator,
  type SpatialHostCapabilities,
} from '@mikevocalz/nitro-mapbox-ar-reactvision'

import { navigation } from './services'
import { hasDeviceLocation } from './spatial/hasDeviceLocation'
import {
  resolveRoutePlacement,
  type RoutePlacement,
} from './spatial/resolveRoutePlacement'

export type ReferenceMode = 'map' | 'navigate' | 'ar' | 'tabletop' | 'agent'

export type HostState =
  | { readonly status: 'idle' }
  | { readonly status: 'probing' }
  | {
      readonly status: 'ready'
      readonly capabilities: SpatialHostCapabilities
      readonly placement: RoutePlacement
    }
  | { readonly status: 'failed'; readonly message: string }

export type TabletopRouteState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly coordinates: readonly GeoCoordinate[] }
  | { readonly status: 'failed'; readonly message: string }

/** Times Square to Brooklyn Bridge, the same trip as the Navigate screen. */
const TABLETOP_TRIP = [
  { longitude: -73.9855, latitude: 40.758 },
  { longitude: -73.9969, latitude: 40.7061 },
] as const

interface ReferenceState {
  mode: ReferenceMode
  host: HostState
  tabletopRoute: TabletopRouteState
  setMode(mode: ReferenceMode): void
  /**
   * Reads the host's spatial capabilities and picks the route placement.
   * Pass the scene's `arSceneNavigator`; a VR scene (Meta Quest) has none.
   */
  probeHost(navigator: ReactVisionGeospatialNavigator | undefined): Promise<void>
  loadTabletopRoute(): Promise<void>
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const useReferenceStore = create<ReferenceState>((set, get) => ({
  mode: 'map',
  host: { status: 'idle' },
  tabletopRoute: { status: 'idle' },
  setMode: (mode) => set({ mode }),

  probeHost: async (navigator) => {
    set({ host: { status: 'probing' } })
    try {
      const capabilities = await getSpatialHostCapabilities(
        createViroSpatialHostProbe({
          navigator,
          hasDeviceLocation,
          isGraphiteAvailable: isGraphiteWebGPUAvailable,
        }),
      )
      const bridge =
        navigator === undefined
          ? undefined
          : createReactVisionSpatialBridge(navigator)
      const placement = await resolveRoutePlacement(capabilities, bridge)
      set({ host: { status: 'ready', capabilities, placement } })
    } catch (error) {
      set({ host: { status: 'failed', message: describeError(error) } })
    }
  },

  loadTabletopRoute: async () => {
    if (get().tabletopRoute.status === 'loading') {
      return
    }
    set({ tabletopRoute: { status: 'loading' } })
    try {
      const planned = await navigation.planRoute(TABLETOP_TRIP)
      set({
        tabletopRoute: {
          status: 'ready',
          coordinates: routeGeometryToCoordinates(planned.primary),
        },
      })
    } catch (error) {
      set({
        tabletopRoute: { status: 'failed', message: describeError(error) },
      })
    }
  },
}))
