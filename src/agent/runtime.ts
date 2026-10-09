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

/** Dependencies and policy for a {@linkcode SpatialAgentRuntime}. */
export interface SpatialAgentRuntimeOptions {
  /** Client that {@linkcode SpatialAgentRuntime.search} queries. */
  readonly search: MapboxSearchClient
  /** Session that plans routes and starts or stops navigation. */
  readonly navigation: NavigationSession
  /** Allow-list checked before every action. Copied at construction; later edits have no effect. */
  readonly policy: SpatialAgentPermissionPolicy
  /** Returns the current context for {@linkcode SpatialAgentRuntime.context}. */
  readonly getContext: () => SpatialAgentContext | Promise<SpatialAgentContext>
  /** Host callbacks for map and AR changes. Omitted callbacks make those actions no-ops. */
  readonly effects?: SpatialAgentEffects
  /** Mapbox Agent Toolkit bridge, injected only when the host has access. */
  readonly mapboxToolkit?: MapboxAgentToolkitBridge
  /** Called synchronously for every permission check, allowed or denied, before the action runs. */
  readonly onAudit?: (event: SpatialAgentAuditEvent) => void
}

/**
 * Typed location actions for an AI agent, built on the direct Mapbox Search
 * and Navigation APIs. Needs no LLM SDK.
 *
 * Every method first checks its {@linkcode SpatialAgentAction} against
 * {@linkcode SpatialAgentRuntimeOptions.policy}, reports the check to
 * {@linkcode SpatialAgentRuntimeOptions.onAudit}, and throws an `Error`
 * naming the action when the policy denies it. A denied action changes
 * nothing.
 */
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

  /**
   * Reads the host's current spatial context. Requires `'read-context'`.
   *
   * @throws {Error} When the policy denies `'read-context'`.
   */
  context(): Promise<SpatialAgentContext> {
    this.#assertAllowed('read-context')
    return Promise.resolve(this.#getContext())
  }

  /**
   * Runs a forward place search through {@linkcode SpatialAgentRuntimeOptions.search}.
   * Requires `'search'`.
   *
   * @param options.proximity Biases results toward this coordinate.
   * @param options.limit Maximum number of results.
   * @throws {Error} When the policy denies `'search'`.
   */
  async search(query: string, options: { proximity?: NavigationCoordinate; limit?: number } = {}) {
    this.#assertAllowed('search')
    return this.#search.forward(query, {
      proximity: options.proximity,
      limit: options.limit,
    })
  }

  /**
   * Plans a route through the given waypoints and resolves with the primary
   * route. Requires `'route'`. Planning does not start navigation.
   *
   * @throws {Error} When the policy denies `'route'`.
   */
  async route(
    coordinates: readonly NavigationCoordinate[],
  ): Promise<NavigationRoute> {
    this.#assertAllowed('route')
    return (await this.#navigation.planRoute(coordinates)).primary
  }

  /**
   * Starts turn-by-turn navigation along a route, stopping any active route
   * first. Requires `'start-navigation'`.
   *
   * @throws {Error} When the policy denies `'start-navigation'`.
   */
  async startNavigation(route: NavigationRoute): Promise<void> {
    this.#assertAllowed('start-navigation')
    await this.#navigation.start(route)
  }

  /**
   * Stops the active navigation session. Requires `'stop-navigation'`.
   *
   * @throws {Error} When the policy denies `'stop-navigation'`.
   */
  async stopNavigation(): Promise<void> {
    this.#assertAllowed('stop-navigation')
    await this.#navigation.stop()
  }

  /**
   * Moves the map to a place's anchor point through
   * {@linkcode SpatialAgentEffects.focusCoordinate}. Requires `'focus-map'`.
   * The anchor prefers a Geocoding v6 entrance point over the routable point
   * and the centroid.
   *
   * @throws {Error} When the policy denies `'focus-map'` or the feature has no
   * usable point geometry.
   */
  async focusPlace(feature: SearchFeature): Promise<void> {
    this.#assertAllowed('focus-map')
    const anchor = getSpatialSearchAnchor(feature)
    if (!anchor) throw new Error('Search feature has no usable point geometry')
    await this.#effects.focusCoordinate?.({
      longitude: anchor.longitude,
      latitude: anchor.latitude,
    })
  }

  /**
   * Places an AR anchor at a place's entrance-aware anchor point through
   * {@linkcode SpatialAgentEffects.addAnchor}. Requires `'add-anchor'`.
   *
   * @throws {Error} When the policy denies `'add-anchor'`, `id` is empty or
   * whitespace, or the feature has no usable point geometry.
   */
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

  /**
   * Highlights a place through {@linkcode SpatialAgentEffects.highlightPlace}.
   * Requires `'highlight-place'`.
   *
   * @throws {Error} When the policy denies `'highlight-place'`.
   */
  async highlightPlace(feature: SearchFeature): Promise<void> {
    this.#assertAllowed('highlight-place')
    await this.#effects.highlightPlace?.(feature)
  }

  /**
   * Runs a Mapbox Agent Toolkit control through
   * {@linkcode SpatialAgentRuntimeOptions.mapboxToolkit}. Requires
   * `'mapbox-agent-toolkit'`.
   *
   * @throws {Error} When the policy denies `'mapbox-agent-toolkit'`, or no
   * bridge was injected or it reports `available: false`. Use
   * {@linkcode SpatialAgentRuntime.search} and
   * {@linkcode SpatialAgentRuntime.route} instead.
   */
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
