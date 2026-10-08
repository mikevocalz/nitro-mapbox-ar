import type { MapboxMapViewMethods } from './MapboxMapView.nitro'

/**
 * How an animated camera move ended.
 *
 * - `finished`: the camera reached the target.
 * - `interrupted`: a gesture, another camera command, or a `camera` prop
 *   change stopped it first. Not an error.
 *
 * @see {@linkcode MapboxMapViewMethods.flyTo}
 */
export type CameraAnimationEnd = 'finished' | 'interrupted'
