import type { NavigationCoordinate, NavigationRoute } from '../navigation/client'
import type { SearchFeature } from '../search/client'

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

export interface SpatialAgentPermissionPolicy {
  readonly allow: readonly SpatialAgentAction[]
}

export interface SpatialAgentContext {
  readonly location?: NavigationCoordinate
  readonly heading?: number
  readonly route?: NavigationRoute | null
  readonly visiblePlaces?: readonly SearchFeature[]
  readonly visibleAnchorIds?: readonly string[]
  readonly metadata?: Readonly<Record<string, unknown>>
}

export interface SpatialAgentEffects {
  focusCoordinate?(coordinate: NavigationCoordinate): Promise<void> | void
  addAnchor?(
    id: string,
    coordinate: NavigationCoordinate,
    feature: SearchFeature,
  ): Promise<void> | void
  highlightPlace?(feature: SearchFeature): Promise<void> | void
}

export interface SpatialAgentAuditEvent {
  readonly action: SpatialAgentAction
  readonly allowed: boolean
  readonly at: number
  readonly detail?: string
}

export interface MapboxAgentToolkitBridge {
  readonly available: boolean
  invoke(control: string, input?: unknown): Promise<unknown>
}
