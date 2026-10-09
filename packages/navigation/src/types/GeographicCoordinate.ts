import type { NavigationManeuver } from './NavigationManeuver'
import type { NavigationProgress } from './NavigationProgress'

/**
 * A WGS84 position in degrees, with altitude in metres when known. Same shape
 * as `GeographicCoordinate` in `@mikevocalz/nitro-mapbox-ar`.
 *
 * @see {@linkcode NavigationProgress.location}
 * @see {@linkcode NavigationManeuver.location}
 */
export interface GeographicCoordinate {
  /** Degrees north of the equator, -90 to 90. */
  readonly latitude: number
  /** Degrees east of Greenwich, -180 to 180. */
  readonly longitude: number
  /** Metres above the WGS84 ellipsoid, when the source reports it. */
  readonly altitude?: number
}
