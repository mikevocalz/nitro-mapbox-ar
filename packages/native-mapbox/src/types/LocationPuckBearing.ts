import type { MapboxMapViewProps } from '../specs/MapboxMapView.nitro'

/**
 * What rotates the user location puck.
 *
 * - `heading`: the direction the device faces, from the compass.
 * - `course`: the direction of travel, from successive GPS fixes.
 * - `none`: the puck does not rotate and draws no bearing arrow.
 *
 * @see {@linkcode MapboxMapViewProps.puckBearing}
 */
export type LocationPuckBearing = 'heading' | 'course' | 'none'
