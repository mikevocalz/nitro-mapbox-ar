import type { NavigationCoordinate, NavigationRoute } from '../navigation/client'
import type { SearchFeature } from '../search/client'

/**
 * An action a spatial agent can attempt. Each `SpatialAgentRuntime` method
 * checks one of these against {@linkcode SpatialAgentPermissionPolicy.allow}
 * before it runs.
 *
 * @see {@linkcode SpatialAgentAuditEvent.action}
 */
export type SpatialAgentAction =
  | 'read-context'
  | 'search'
  | 'route'
  | 'start-navigation'
  | 'stop-navigation'
  | 'focus-map'
  | 'add-anchor'
  | 'highlight-place'
  | 'add-stop'
  | 'mapbox-agent-toolkit'

/**
 * The allow-list of actions a spatial agent may perform. Anything not listed
 * is denied.
 */
export interface SpatialAgentPermissionPolicy {
  /** Actions the agent may perform. A denied action throws before it has any effect. */
  readonly allow: readonly SpatialAgentAction[]
}

/**
 * A snapshot of what the user currently sees and where they are, supplied by
 * the host app and returned to the agent on a `'read-context'` action.
 */
export interface SpatialAgentContext {
  /** The user's current position. */
  readonly location?: NavigationCoordinate
  /** The user's compass heading in degrees. */
  readonly heading?: number
  /** The active navigation route, or `null` when navigation is stopped. */
  readonly route?: NavigationRoute | null
  /** Search features currently visible to the user. */
  readonly visiblePlaces?: readonly SearchFeature[]
  /** Ids of AR anchors currently visible to the user. */
  readonly visibleAnchorIds?: readonly string[]
  /** Host-defined extra context, passed through unchanged. */
  readonly metadata?: Readonly<Record<string, unknown>>
}

/**
 * Host callbacks that apply an agent's map and AR changes. Every callback is
 * optional; the runtime skips a missing one after the permission check passes.
 */
export interface SpatialAgentEffects {
  /** Moves the map camera to a coordinate. Called for a `'focus-map'` action. */
  focusCoordinate?(coordinate: NavigationCoordinate): Promise<void> | void
  /**
   * Places an AR anchor with the given id at a place's anchor point. Called
   * for an `'add-anchor'` action, with the coordinate already resolved from
   * the feature.
   */
  addAnchor?(
    id: string,
    coordinate: NavigationCoordinate,
    feature: SearchFeature,
  ): Promise<void> | void
  /** Visually highlights a place. Called for a `'highlight-place'` action. */
  highlightPlace?(feature: SearchFeature): Promise<void> | void
}

/**
 * Record of one permission check, emitted for allowed and denied attempts
 * alike, before the action runs.
 */
export interface SpatialAgentAuditEvent {
  /** The action that was attempted. */
  readonly action: SpatialAgentAction
  /** Whether {@linkcode SpatialAgentPermissionPolicy} allowed the action. */
  readonly allowed: boolean
  /** When the check ran, in milliseconds since the Unix epoch. */
  readonly at: number
  /** Optional extra description of the attempt. */
  readonly detail?: string
}

/**
 * Host-supplied bridge to the Mapbox Agent Toolkit for Maps and Navigation
 * (public preview, access by request). Inject it only when the host has
 * toolkit access; the direct Search and Navigation APIs remain the fallback.
 */
export interface MapboxAgentToolkitBridge {
  /** Whether the toolkit can take calls right now. */
  readonly available: boolean
  /**
   * Runs a toolkit control by name with an optional input, resolving with the
   * control's output.
   */
  invoke(control: string, input?: unknown): Promise<unknown>
}
