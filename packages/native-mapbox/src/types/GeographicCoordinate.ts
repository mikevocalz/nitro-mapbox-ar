import type { CameraTarget } from './CameraTarget'
import type { PointAnnotation } from './PointAnnotation'

/**
 * A WGS84 position. Same shape as `GeographicCoordinate` in
 * `@mikevocalz/nitro-mapbox-ar`, so values pass between the packages
 * unchanged; Nitrogen needs its own copy in this package.
 *
 * @see {@linkcode CameraTarget.center}
 * @see {@linkcode PointAnnotation.coordinate}
 */
export interface GeographicCoordinate {
  /** Degrees, -90 to 90. */
  readonly latitude: number
  /** Degrees, -180 to 180. */
  readonly longitude: number
  /** Metres above the WGS84 ellipsoid. */
  readonly altitude?: number
}
