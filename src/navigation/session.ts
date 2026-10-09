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

export interface NavigationSessionOptions {
  readonly client: MapboxNavigationClient
  readonly nativeProvider?: NativeNavigationProvider
}

export interface PlannedRoute {
  readonly primary: NavigationRoute
  readonly alternatives: readonly NavigationRoute[]
}

export class NavigationSession {
  readonly #client: MapboxNavigationClient
  readonly #provider?: NativeNavigationProvider

  #activeRoute: NavigationRoute | null = null
  #started = false
  #lastProgress: NavigationProgressSnapshot | null = null
  readonly #sources = new WeakMap<NavigationRoute, { readonly requestUrl: string; readonly routeIndex: number }>()

  constructor(options: NavigationSessionOptions) {
    this.#client = options.client
    this.#provider = options.nativeProvider
  }

  get capabilities(): NativeNavigationCapabilities {
    return this.#provider?.capabilities ?? CORE_ONLY_CAPABILITIES
  }

  get activeRoute(): NavigationRoute | null {
    return this.#activeRoute
  }

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

  electronicHorizon(): Promise<ElectronicHorizonSnapshot | null> {
    if (!this.#provider?.capabilities.electronicHorizon) {
      return Promise.resolve(null)
    }
    return this.#provider.getElectronicHorizon()
  }
}
