import type { TripSession } from '../specs/TripSession.nitro'
import type { GeographicCoordinate } from './GeographicCoordinate'
import type { NavigationManeuver } from './NavigationManeuver'

/**
 * Progress along the primary route, emitted by a {@linkcode TripSession}.
 *
 * Field names and units match `NavigationProgressSnapshot` in
 * `@mikevocalz/nitro-mapbox-ar` without its `route` field, which cannot cross
 * the native boundary; `createNativeNavigationProvider` adds it
 * back. `distanceRemaining` and `durationRemaining` keep their unitless names
 * to stay identical to that contract.
 *
 * @see {@linkcode TripSession.addOnProgressListener}
 */
export interface NavigationProgress {
  /** Map-matched position. */
  readonly location: GeographicCoordinate
  /** Course in degrees clockwise from true north, when known. */
  readonly bearing?: number
  /** Speed in metres per second, when known. */
  readonly speedMetersPerSecond?: number
  /** Metres left on the route. */
  readonly distanceRemaining: number
  /** Seconds left on the route. */
  readonly durationRemaining: number
  /** Share of the route travelled, 0 to 1. */
  readonly fractionTraveled: number
  /** Index of the current leg. */
  readonly currentLegIndex: number
  /** Index of the current step within the leg. */
  readonly currentStepIndex?: number
  /** The next manoeuvre, absent after the final arrival. */
  readonly upcomingManeuver?: NavigationManeuver
}

