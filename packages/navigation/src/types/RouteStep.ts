import type { GeographicCoordinate } from './GeographicCoordinate'
import type { NavigationManeuver } from './NavigationManeuver'
import type { RouteLeg } from './RouteLeg'

/**
 * One manoeuvre and the stretch of travel up to the next one. Same fields as
 * `RouteStep` in `@mikevocalz/nitro-mapbox-ar`.
 *
 * @see {@linkcode RouteLeg.steps}
 */
export interface RouteStep {
  /** The manoeuvre at the start of the step. */
  readonly maneuver: NavigationManeuver
  /** Metres from this manoeuvre to the next. */
  readonly distanceM: number
  /** Seconds from this manoeuvre to the next. */
  readonly durationS: number
  /** Street or path name; empty when the route has none. */
  readonly streetName: string
  /** The step's path, when the route carries step geometry. */
  readonly geometry?: GeographicCoordinate[]
}
