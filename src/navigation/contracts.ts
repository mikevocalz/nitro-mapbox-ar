import type { NavigationCoordinate, NavigationRoute } from './client'

export interface NavigationProgressSnapshot {
  readonly location: NavigationCoordinate
  readonly bearing?: number
  readonly speedMetersPerSecond?: number
  readonly distanceRemaining: number
  readonly durationRemaining: number
  readonly fractionTraveled: number
  readonly currentLegIndex: number
  readonly currentStepIndex?: number
  readonly route: NavigationRoute
}

export interface ElectronicHorizonEdge {
  readonly id: string | number
  readonly level: number
  readonly probability: number
  readonly shape?: readonly NavigationCoordinate[]
}

export interface ElectronicHorizonSnapshot {
  readonly edgeId: string | number
  readonly percentAlong: number
  readonly edges: readonly ElectronicHorizonEdge[]
}

export interface NativeNavigationCapabilities {
  readonly activeGuidance: boolean
  readonly rerouting: boolean
  readonly trafficRefresh: boolean
  readonly incidents: boolean
  readonly predictiveCaching: boolean
  readonly offlineRegions: boolean
  readonly electronicHorizon: boolean
}

export interface NativeNavigationProvider {
  readonly capabilities: NativeNavigationCapabilities
  startTripSession(): Promise<void>
  stopTripSession(): Promise<void>
  /**
   * Sets or clears the route to guide along. `source` is present when the
   * route came from `NavigationSession.planRoute`: `requestUrl` is the
   * Directions request URL and `routeIndex` the route's index in the
   * response. A native Navigation SDK rebuilds its own route objects from the
   * request, so it needs the URL. The URL carries the access token: never log
   * it. Providers that do not need `source` can ignore it.
   */
  setRoute(
    route: NavigationRoute | null,
    source?: { readonly requestUrl: string; readonly routeIndex: number },
  ): Promise<void>
  getProgress(): Promise<NavigationProgressSnapshot | null>
  getElectronicHorizon(): Promise<ElectronicHorizonSnapshot | null>
}
