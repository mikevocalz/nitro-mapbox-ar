import type { MapboxMapView, MapboxMapViewProps } from '../specs/MapboxMapView.nitro'

/**
 * How a {@linkcode MapboxMapView} projects the earth onto the screen.
 *
 * - `mercator`: flat Web Mercator at every zoom.
 * - `globe`: a 3D globe at low zoom that blends into Mercator as you zoom in.
 *
 * @see {@linkcode MapboxMapViewProps.projection}
 */
export type MapProjection = 'mercator' | 'globe'
