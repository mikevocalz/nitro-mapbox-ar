import type { GeographicCoordinate } from './GeographicCoordinate'
import type { MapboxMapViewMethods } from '../specs/MapboxMapView.nitro'

/**
 * A geographic rectangle. When `southwest.longitude` is greater than
 * `northeast.longitude` the rectangle crosses the antimeridian.
 *
 * @see {@linkcode MapboxMapViewMethods.fitBounds}
 */
export interface CoordinateBounds {
  /** South-west corner. `altitude` is ignored. */
  southwest: GeographicCoordinate
  /** North-east corner. `altitude` is ignored. */
  northeast: GeographicCoordinate
}
