import type { NavigationCoordinate, NavigationRoute } from './client'

/**
 * Progress along the active route at one moment, from
 * {@linkcode NativeNavigationProvider.getProgress} or, without a native
 * provider, from `NavigationSession.updateLocation`.
 */
export interface NavigationProgressSnapshot {
  /** WGS84 position of the traveller. */
  readonly location: NavigationCoordinate
  /** Course in degrees clockwise from true north, when the location source reports it. */
  readonly bearing?: number
  /** Ground speed in metres per second, when the location source reports it. */
  readonly speedMetersPerSecond?: number
  /** Metres left to the end of the route. */
  readonly distanceRemaining: number
  /** Seconds left to the end of the route. */
  readonly durationRemaining: number
  /** Share of the route already travelled, 0 to 1. */
  readonly fractionTraveled: number
  /** Zero-based index of the leg the traveller is on, into `route.legs`. */
  readonly currentLegIndex: number
  /** Zero-based index of the step within the current leg; absent when the leg has no steps. */
  readonly currentStepIndex?: number
  /** The route this progress is measured against. */
  readonly route: NavigationRoute
}

/**
 * One road-graph edge ahead of the traveller, listed in
 * {@linkcode ElectronicHorizonSnapshot.edges}.
 */
export interface ElectronicHorizonEdge {
  /**
   * Road-graph edge id. Native providers send a decimal string, because the
   * ids are unsigned 64-bit integers a JS number cannot hold exactly.
   */
  readonly id: string | number
  /** 0 for the most probable path, higher for branches off it. */
  readonly level: number
  /** Probability, 0 to 1, that the traveller takes this edge. */
  readonly probability: number
  /** The edge's geometry, when the road graph has it. */
  readonly shape?: readonly NavigationCoordinate[]
}

/**
 * The road graph ahead of the traveller, from
 * {@linkcode NativeNavigationProvider.getElectronicHorizon}.
 */
export interface ElectronicHorizonSnapshot {
  /** Id of the edge the traveller is on; matches an {@linkcode ElectronicHorizonEdge.id}. */
  readonly edgeId: string | number
  /** Share of the current edge already travelled, 0 to 1. */
  readonly percentAlong: number
  /** The edge the traveller is on, then every edge reachable from it, depth first. */
  readonly edges: readonly ElectronicHorizonEdge[]
}

/**
 * Features a {@linkcode NativeNavigationProvider} has wired up. A field is
 * `true` only when the provider implements the feature, not merely when the
 * underlying SDK could. `NavigationSession.capabilities` reports all `false`
 * when no provider is attached.
 *
 * @see {@linkcode NativeNavigationProvider.capabilities}
 */
export interface NativeNavigationCapabilities {
  /** The provider tracks the traveller along a route set with {@linkcode NativeNavigationProvider.setRoute} and reports progress. */
  readonly activeGuidance: boolean
  /** The provider requests a new route when the traveller leaves the active one. */
  readonly rerouting: boolean
  /** The provider refreshes traffic data and durations on the active route while guiding. */
  readonly trafficRefresh: boolean
  /** The provider reports traffic incidents on the active route. */
  readonly incidents: boolean
  /** The provider caches map and routing tiles ahead of the traveller. */
  readonly predictiveCaching: boolean
  /** The provider can download regions for offline routing. */
  readonly offlineRegions: boolean
  /** {@linkcode NativeNavigationProvider.getElectronicHorizon} returns data. */
  readonly electronicHorizon: boolean
}

/**
 * Bridge from `NavigationSession` to a native Navigation SDK. Without one,
 * the session plans routes and computes progress in JS.
 */
export interface NativeNavigationProvider {
  /** What this provider implements. */
  readonly capabilities: NativeNavigationCapabilities
  /**
   * Starts the native trip session so the SDK begins tracking location.
   * `NavigationSession.start` calls it after {@linkcode NativeNavigationProvider.setRoute}.
   */
  startTripSession(): Promise<void>
  /**
   * Stops the native trip session. `NavigationSession.stop` calls it before
   * clearing the route with `setRoute(null)`.
   */
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
  /** Latest progress along the active route, or `null` when the SDK has not reported any yet. */
  getProgress(): Promise<NavigationProgressSnapshot | null>
  /**
   * Latest electronic horizon, or `null` when the SDK has not produced one.
   * `NavigationSession.electronicHorizon` calls it only when
   * {@linkcode NativeNavigationCapabilities.electronicHorizon} is `true`.
   */
  getElectronicHorizon(): Promise<ElectronicHorizonSnapshot | null>
}
