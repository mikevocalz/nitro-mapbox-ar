import type { NavigationCoordinate, NavigationRoute } from '../navigation/client'
import type { NavigationSession } from '../navigation/session'
import { getSpatialSearchAnchor } from '../search/anchor'
import type { MapboxSearchClient, SearchFeature } from '../search/client'
import type {
  MapboxAgentToolkitBridge,
  SpatialAgentAction,
  SpatialAgentAuditEvent,
  SpatialAgentContext,
  SpatialAgentEffects,
  SpatialAgentPermissionPolicy,
} from './types'

export interface SpatialAgentRuntimeOptions {
  readonly search: MapboxSearchClient
  readonly navigation: NavigationSession
  readonly policy: SpatialAgentPermissionPolicy
  readonly getContext: () => SpatialAgentContext | Promise<SpatialAgentContext>
  readonly effects?: SpatialAgentEffects
  readonly mapboxToolkit?: MapboxAgentToolkitBridge
  readonly onAudit?: (event: SpatialAgentAuditEvent) => void
}

export class SpatialAgentRuntime {
  readonly #search: MapboxSearchClient
  readonly #navigation: NavigationSession
  readonly #allowed: ReadonlySet<SpatialAgentAction>
  readonly #getContext: SpatialAgentRuntimeOptions['getContext']
  readonly #effects: SpatialAgentEffects
  readonly #toolkit?: MapboxAgentToolkitBridge
  readonly #onAudit?: (event: SpatialAgentAuditEvent) => void

  constructor(options: SpatialAgentRuntimeOptions) {
    this.#search = options.search
    this.#navigation = options.navigation
    this.#allowed = new Set(options.policy.allow)
    this.#getContext = options.getContext
    this.#effects = options.effects ?? {}
    this.#toolkit = options.mapboxToolkit
    this.#onAudit = options.onAudit
  }

  context(): Promise<SpatialAgentContext> {
    this.#assertAllowed('read-context')
    return Promise.resolve(this.#getContext())
  }

  async search(query: string, options: { proximity?: NavigationCoordinate; limit?: number } = {}) {
    this.#assertAllowed('search')
    return this.#search.forward(query, {
      proximity: options.proximity,
      limit: options.limit,
    })
  }

  async route(
    coordinates: readonly NavigationCoordinate[],
  ): Promise<NavigationRoute> {
    this.#assertAllowed('route')
    return (await this.#navigation.planRoute(coordinates)).primary
  }

  async startNavigation(route: NavigationRoute): Promise<void> {
    this.#assertAllowed('start-navigation')
    await this.#navigation.start(route)
  }

  async stopNavigation(): Promise<void> {
    this.#assertAllowed('stop-navigation')
    await this.#navigation.stop()
  }

  async focusPlace(feature: SearchFeature): Promise<void> {
    this.#assertAllowed('focus-map')
    const anchor = getSpatialSearchAnchor(feature)
    if (!anchor) throw new Error('Search feature has no usable point geometry')
    await this.#effects.focusCoordinate?.({
      longitude: anchor.longitude,
      latitude: anchor.latitude,
    })
  }

  async addAnchor(id: string, feature: SearchFeature): Promise<void> {
    this.#assertAllowed('add-anchor')
    if (!id.trim()) throw new Error('Anchor id cannot be empty')

    const anchor = getSpatialSearchAnchor(feature)
    if (!anchor) throw new Error('Search feature has no usable point geometry')

    await this.#effects.addAnchor?.(
      id,
      {
        longitude: anchor.longitude,
        latitude: anchor.latitude,
      },
      feature,
    )
  }

  async highlightPlace(feature: SearchFeature): Promise<void> {
    this.#assertAllowed('highlight-place')
    await this.#effects.highlightPlace?.(feature)
  }

  async invokeMapboxToolkit(control: string, input?: unknown): Promise<unknown> {
    this.#assertAllowed('mapbox-agent-toolkit')
    if (!this.#toolkit?.available) {
      throw new Error(
        'Mapbox Agent Toolkit is unavailable; use direct Search/Navigation APIs instead',
      )
    }
    return this.#toolkit.invoke(control, input)
  }

  #assertAllowed(action: SpatialAgentAction): void {
    const allowed = this.#allowed.has(action)
    this.#onAudit?.({
      action,
      allowed,
      at: Date.now(),
    })

    if (!allowed) {
      throw new Error(`Spatial agent action is not permitted: ${action}`)
    }
  }
}
