import type { GeographicCoordinate } from './GeographicCoordinate'
import type { MapboxMapViewMethods, MapboxMapViewProps } from '../specs/MapboxMapView.nitro'
import type { EdgeInsets } from './EdgeInsets'

/**
 * A requested camera. Omitted fields keep their current value.
 *
 * @see {@linkcode MapboxMapViewMethods.flyTo}
 * @see {@linkcode MapboxMapViewMethods.easeTo}
 * @see {@linkcode MapboxMapViewProps.camera}
 */
export interface CameraTarget {
  /** New centre. `altitude` is ignored. */
  center?: GeographicCoordinate
  /** Zoom level, 0 to 22. */
  zoom?: number
  /** Clockwise degrees from true north. Any finite value; wrapped to [0, 360). */
  bearingDeg?: number
  /** Degrees from looking straight down, 0 to 85. */
  pitchDeg?: number
  /** Padding to apply. */
  padding?: EdgeInsets
}
