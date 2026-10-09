import { create } from 'zustand'
import { isARSupportedOnDevice } from '@reactvision/react-viro'
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

import { agentRuntime, navigation, TIMES_SQUARE } from './services'
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

export type RoutePlanState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly miles: number; readonly minutes: number }
  | { readonly status: 'failed'; readonly message: string }

export type AgentSearchState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly places: readonly AgentPlace[] }
  | { readonly status: 'failed'; readonly message: string }

export interface AgentPlace {
  readonly id: string
  readonly name: string
  readonly address: string | undefined
}

export type ARSupportState =
  | { readonly status: 'unknown' }
  | { readonly status: 'checking' }
  | { readonly status: 'supported' }
  | { readonly status: 'unsupported' }
  | { readonly status: 'failed'; readonly message: string }

const METRES_PER_MILE = 1609.344

/** Times Square to Brooklyn Bridge, shared by the Navigate and Table screens. */
const TRIP = [
  { longitude: -73.9855, latitude: 40.758 },
  { longitude: -73.9969, latitude: 40.7061 },
] as const

interface ReferenceState {
  mode: ReferenceMode
  host: HostState
  tabletopRoute: TabletopRouteState
  routePlan: RoutePlanState
  agentQuery: string
  agentSearch: AgentSearchState
  arSupport: ARSupportState
  setMode(mode: ReferenceMode): void
  /** Plans the Navigate screen's trip. Ignored while a plan is running. */
  planRoute(): Promise<void>
  setAgentQuery(query: string): void
  /** Searches for `agentQuery` near Times Square. Ignored while one runs. */
  runAgentSearch(): Promise<void>
  /** Asks Viro once whether camera AR works on this device. */
  checkARSupport(): Promise<void>
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

function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export const useReferenceStore = create<ReferenceState>((set, get) => ({
  mode: 'map',
  host: { status: 'idle' },
  tabletopRoute: { status: 'idle' },
  routePlan: { status: 'idle' },
  agentQuery: '',
  agentSearch: { status: 'idle' },
  arSupport: { status: 'unknown' },
  setMode: (mode) => set({ mode }),

  planRoute: async () => {
    if (get().routePlan.status === 'loading') {
      return
    }
    set({ routePlan: { status: 'loading' } })
    try {
      const route = await navigation.planRoute(TRIP)
      set({
        routePlan: {
          status: 'ready',
          miles: route.primary.distance / METRES_PER_MILE,
          minutes: Math.round(route.primary.duration / 60),
        },
      })
    } catch (error) {
      set({ routePlan: { status: 'failed', message: describeError(error) } })
    }
  },

  setAgentQuery: (agentQuery) => set({ agentQuery }),

  runAgentSearch: async () => {
    const query = get().agentQuery.trim()
    if (query.length === 0 || get().agentSearch.status === 'loading') {
      return
    }
    set({ agentSearch: { status: 'loading' } })
    try {
      const result = await agentRuntime.search(query, { proximity: TIMES_SQUARE, limit: 5 })
      const places = result.features.map((feature, index): AgentPlace => ({
        id: feature.id ?? String(index),
        name: readString(feature.properties, 'name') ?? '',
        address:
          readString(feature.properties, 'full_address') ??
          readString(feature.properties, 'place_formatted'),
      }))
      set({ agentSearch: { status: 'ready', places } })
    } catch (error) {
      set({ agentSearch: { status: 'failed', message: describeError(error) } })
    }
  },

  checkARSupport: async () => {
    if (get().arSupport.status !== 'unknown') {
      return
    }
    set({ arSupport: { status: 'checking' } })
    try {
      const { isARSupported } = await isARSupportedOnDevice()
      set({ arSupport: { status: isARSupported ? 'supported' : 'unsupported' } })
    } catch (error) {
      set({ arSupport: { status: 'failed', message: describeError(error) } })
    }
  },

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
      const planned = await navigation.planRoute(TRIP)
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
