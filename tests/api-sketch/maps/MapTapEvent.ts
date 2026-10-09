import type { GeographicCoordinate } from '../../../src/navigation/route'
import type { MapboxMapViewMethods } from './MapboxMapView.nitro'
import type { ScreenPoint } from './ScreenPoint'

/**
 * A single tap on the map surface that no annotation consumed.
 *
 * @see {@linkcode MapboxMapViewMethods.addOnMapTapListener}
 */
export interface MapTapEvent {
  /** Where the tap landed on the map. `altitude` is never set. */
  readonly coordinate: GeographicCoordinate
  /** Where the tap landed in the view. */
  readonly point: ScreenPoint
}
