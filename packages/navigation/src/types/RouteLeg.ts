import type { RerouteEvent } from './RerouteEvent'
import type { RouteStep } from './RouteStep'

/**
 * Travel between two waypoints. Same fields as `RouteLeg` in
 * `@mikevocalz/nitro-mapbox-ar`.
 *
 * @see {@linkcode RerouteEvent.legs}
 */
export interface RouteLeg {
  /** Metres. */
  readonly distanceM: number
  /** Seconds. */
  readonly durationS: number
  /** Steps in travel order; the last one is the leg's arrival. */
  readonly steps: RouteStep[]
}
