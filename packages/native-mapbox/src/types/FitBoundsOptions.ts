import type { CameraAnimationOptions } from './CameraAnimationOptions'
import type { EdgeInsets } from './EdgeInsets'
import type { MapboxMapViewMethods } from '../specs/MapboxMapView.nitro'

/**
 * How {@linkcode MapboxMapViewMethods.fitBounds} frames a rectangle.
 */
export interface FitBoundsOptions extends CameraAnimationOptions {
  /** Space to keep clear around the bounds. @default all zero */
  padding?: EdgeInsets
  /** Bearing of the resulting camera, in degrees. @default 0 */
  bearingDeg?: number
  /** Pitch of the resulting camera, in degrees. @default 0 */
  pitchDeg?: number
  /** Upper zoom limit, so a small bounds does not zoom to street level. */
  maxZoom?: number
}
