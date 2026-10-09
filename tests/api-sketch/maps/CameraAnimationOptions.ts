import type { MapboxMapViewMethods } from './MapboxMapView.nitro'

/**
 * Timing for an animated camera move.
 *
 * @see {@linkcode MapboxMapViewMethods.flyTo}
 * @see {@linkcode MapboxMapViewMethods.easeTo}
 */
export interface CameraAnimationOptions {
  /**
   * Duration in milliseconds. `0` jumps without animating.
   *
   * @default for `flyTo`, the SDK picks a duration from the distance
   * travelled; for `easeTo` and `fitBounds`, 300.
   */
  durationMs?: number
}
