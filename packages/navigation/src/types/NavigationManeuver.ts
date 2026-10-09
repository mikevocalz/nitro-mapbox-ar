import type { GeographicCoordinate } from './GeographicCoordinate'
import type { NavigationProgress } from './NavigationProgress'
import type { RouteStep } from './RouteStep'

/**
 * What to do at the start of a {@linkcode RouteStep}, as the native
 * Navigation SDK reports it.
 *
 * Same fields as `NavigationManeuver` in `@mikevocalz/nitro-mapbox-ar`, except
 * that `kind` and `modifier` are plain strings here, so a manoeuvre type added
 * by a newer SDK crosses the bridge instead of failing it.
 * `toCoreRouteLegs` maps them back to the core unions, with unknown
 * kinds becoming `'unknown'`.
 *
 * @see {@linkcode NavigationProgress.upcomingManeuver}
 */
export interface NavigationManeuver {
  /** Directions API manoeuvre type, for example `turn` or `arrive`. */
  readonly kind: string
  /** Directions API modifier, for example `slight left`, when given. */
  readonly modifier?: string
  /** Where the manoeuvre happens. */
  readonly location: GeographicCoordinate
  /** Compass bearing in degrees [0, 360) of travel into the manoeuvre. */
  readonly bearingBeforeDeg: number
  /** Compass bearing in degrees [0, 360) of travel out of the manoeuvre. */
  readonly bearingAfterDeg: number
  /** Human-readable instruction in the request's language. */
  readonly instruction: string
  /** Roundabout or rotary exit number, when given. */
  readonly exitNumber?: number
}
