import type {
  NavigationCoordinate,
} from '../../../src/navigation/client'
import type { NavigationProgressSnapshot } from '../../../src/navigation/contracts'
import type { NavigationManeuver } from '../../../src/navigation/route'
import type { TripSession } from './TripSession.nitro'

/**
 * Progress along the primary route, emitted by a {@linkcode TripSession}.
 *
 * Field names and units match {@linkcode NavigationProgressSnapshot} without
 * its `route` field, which cannot cross the native boundary. The JS
 * `NavigationSession` adds `route` back.
 *
 * @see {@linkcode TripSession.addOnProgressListener}
 */
export interface TripProgress {
  /** Map-matched position. */
  readonly location: NavigationCoordinate
  /** Course in degrees from true north, when known. */
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
