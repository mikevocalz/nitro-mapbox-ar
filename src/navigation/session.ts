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
    const response = await this.#client.directions(coordinates, options)
    const primary = response.routes[0]
    if (!primary) {
      throw new Error('Mapbox returned no routes')
    }

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

    if (!this.#provider) {
      this.#started = true
      return
    }

    await this.#provider.setRoute(route)
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
  }

  progress(): Promise<NavigationProgressSnapshot | null> {
    return this.#provider?.getProgress() ?? Promise.resolve(null)
  }

  electronicHorizon(): Promise<ElectronicHorizonSnapshot | null> {
    if (!this.#provider?.capabilities.electronicHorizon) {
      return Promise.resolve(null)
    }
    return this.#provider.getElectronicHorizon()
  }
}
