import type { GeographicCoordinate } from './GeographicCoordinate'
import type { MapboxMapView, MapboxMapViewMethods } from '../specs/MapboxMapView.nitro'
import type { EdgeInsets } from './EdgeInsets'

/**
 * The camera of a {@linkcode MapboxMapView} as the map last rendered it.
 *
 * @see {@linkcode MapboxMapViewMethods.getCameraState}
 * @see {@linkcode MapboxMapViewMethods.addOnCameraChangedListener}
 */
export interface CameraState {
  /** Map centre. `altitude` is never set. */
  readonly center: GeographicCoordinate
  /** Zoom level, 0 (whole world) to 22. */
  readonly zoom: number
  /** Clockwise degrees from true north, [0, 360). */
  readonly bearingDeg: number
  /** Degrees from looking straight down, 0 to 85. */
  readonly pitchDeg: number
  /** Padding the camera currently applies. */
  readonly padding: EdgeInsets
}
