import type {
  DirectionsOptions,
  MapboxNavigationClient,
  NavigationCoordinate,
  NavigationRoute,
} from './client'
import type {
  ElectronicHorizonSnapshot,
  NativeNavigationCapabilities,
  NativeNavigationProvider,
  NavigationProgressSnapshot,
} from './contracts'
import { routeProgressAt } from './progress'

const CORE_ONLY_CAPABILITIES: NativeNavigationCapabilities = {
  activeGuidance: false,
  rerouting: false,
  trafficRefresh: false,
  incidents: false,
  predictiveCaching: false,
  offlineRegions: false,
  electronicHorizon: false,
}

/**
 * Construction options for {@linkcode NavigationSession}.
 */
export interface NavigationSessionOptions {
  /** Directions client used by {@linkcode NavigationSession.planRoute}. */
  readonly client: MapboxNavigationClient
  /**
   * Native Navigation SDK bridge. When omitted, the session runs in JS:
   * progress comes from {@linkcode NavigationSession.updateLocation} and
   * every capability is `false`.
   */
  readonly nativeProvider?: NativeNavigationProvider
}

/**
 * Routes returned by {@linkcode NavigationSession.planRoute}. Pass any of
 * them to {@linkcode NavigationSession.start}.
 */
export interface PlannedRoute {
  /** First route in the Directions response. */
  readonly primary: NavigationRoute
  /** The remaining routes in response order; empty when the API returned one route. */
  readonly alternatives: readonly NavigationRoute[]
}

/**
 * Plans a route with a {@linkcode MapboxNavigationClient} and guides along
 * it, either through a {@linkcode NativeNavigationProvider} or in JS.
 * Call {@linkcode NavigationSession.start} to begin guidance and
 * {@linkcode NavigationSession.stop} to end it; the session holds one active
 * route at a time.
 */
export class NavigationSession {
  readonly #client: MapboxNavigationClient
  readonly #provider?: NativeNavigationProvider

  #activeRoute: NavigationRoute | null = null
  #started = false
  #lastProgress: NavigationProgressSnapshot | null = null
  readonly #sources = new WeakMap<NavigationRoute, { readonly requestUrl: string; readonly routeIndex: number }>()

  /** Creates an idle session with no active route. */
  constructor(options: NavigationSessionOptions) {
    this.#client = options.client
    this.#provider = options.nativeProvider
  }

  /**
   * The native provider's capabilities, or all `false` when no provider is
   * attached.
   */
  get capabilities(): NativeNavigationCapabilities {
    return this.#provider?.capabilities ?? CORE_ONLY_CAPABILITIES
  }

  /** The route passed to the last {@linkcode NavigationSession.start}, or `null` when stopped. */
  get activeRoute(): NavigationRoute | null {
    return this.#activeRoute
  }

  /**
   * Requests routes through {@linkcode MapboxNavigationClient.directionsWithRequestUrl}
   * without starting guidance. The session remembers each returned route's
   * request URL, so {@linkcode NavigationSession.start} can hand it to the
   * native provider.
   *
   * @throws {Error} When the response has no routes. Request and validation
   * errors from the client propagate unchanged.
   */
  async planRoute(
    coordinates: readonly NavigationCoordinate[],
    options: DirectionsOptions = {},
  ): Promise<PlannedRoute> {
    const { response, requestUrl } = await this.#client.directionsWithRequestUrl(
      coordinates,
      options,
    )
    const primary = response.routes[0]
    if (!primary) {
      throw new Error('Mapbox returned no routes')
    }
    response.routes.forEach((route, routeIndex) => {
      this.#sources.set(route, { requestUrl, routeIndex })
    })

    return {
      primary,
      alternatives: response.routes.slice(1),
    }
  }

  /**
   * Starts guidance along `route`, stopping any running guidance first and
   * clearing the last progress. With a native provider it calls
   * `setRoute(route, source)` then `startTripSession()`; `source` is set
   * only for routes from {@linkcode NavigationSession.planRoute} on this
   * session. Without a provider, follow with
   * {@linkcode NavigationSession.updateLocation} calls.
   */
  async start(route: NavigationRoute): Promise<void> {
    if (this.#started) {
      await this.stop()
    }

    this.#activeRoute = route
    this.#lastProgress = null

    if (!this.#provider) {
      this.#started = true
      return
    }

    await this.#provider.setRoute(route, this.#sources.get(route))
    await this.#provider.startTripSession()
    this.#started = true
  }

  /**
   * Ends guidance: with a native provider it calls `stopTripSession()` then
   * `setRoute(null)`, and it clears the active route and last progress.
   * Calling it when not started only clears the active route.
   */
  async stop(): Promise<void> {
    if (!this.#started) {
      this.#activeRoute = null
      return
    }

    if (this.#provider) {
      await this.#provider.stopTripSession()
      await this.#provider.setRoute(null)
    }

    this.#started = false
    this.#activeRoute = null
    this.#lastProgress = null
  }

  /**
   * Feeds one position fix to a session that has no native provider and
   * returns the resulting progress, which {@linkcode NavigationSession.progress}
   * then reports. Use it to drive the JS path from any location source, or to
   * replay a recorded drive.
   *
   * Progress comes from the active route's GeoJSON geometry: the fix is
   * projected onto the nearest point of the line, `fractionTraveled` is the
   * distance along the line to that point over its length, and the remaining
   * distance and duration scale `route.distance` and `route.duration` by the
   * untravelled share (constant speed assumed). `location` is the fix as
   * given. There is no off-route detection.
   *
   * @throws {Error} When no route is active (call `start(route)` first), or
   * when a native provider is attached: the provider tracks location itself.
   * @throws {TypeError} When the active route has no GeoJSON `LineString`
   * geometry.
   */
  updateLocation(sample: {
    /** WGS84 position of the traveller. */
    readonly location: NavigationCoordinate
    /** Course in degrees clockwise from true north, when known. */
    readonly bearing?: number
    /** Ground speed in metres per second, when known. */
    readonly speedMetersPerSecond?: number
  }): NavigationProgressSnapshot {
    if (this.#provider) {
      throw new Error('updateLocation is for sessions without a native provider; the provider tracks location itself')
    }
    if (!this.#started || this.#activeRoute === null) {
      throw new Error('No active route; call start(route) before updateLocation')
    }
    const progress = routeProgressAt(this.#activeRoute, sample)
    this.#lastProgress = progress
    return progress
  }

  /**
   * The latest progress: from the native provider when one is attached,
   * otherwise from the last {@linkcode NavigationSession.updateLocation}
   * call. `null` before the first update or after `stop()`.
   */
  progress(): Promise<NavigationProgressSnapshot | null> {
    if (this.#provider) return this.#provider.getProgress()
    return Promise.resolve(this.#lastProgress)
  }

  /**
   * The provider's latest electronic horizon. Resolves `null` without
   * calling the provider when there is no provider or
   * {@linkcode NativeNavigationCapabilities.electronicHorizon} is `false`.
   */
  electronicHorizon(): Promise<ElectronicHorizonSnapshot | null> {
    if (!this.#provider?.capabilities.electronicHorizon) {
      return Promise.resolve(null)
    }
    return this.#provider.getElectronicHorizon()
  }
}
