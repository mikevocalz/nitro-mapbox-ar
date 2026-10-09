import type { MapboxMapViewMethods } from './MapboxMapView.nitro'

/**
 * Style URIs for the Mapbox-hosted styles this package documents. Any
 * `mapbox://styles/...` or `https://` style URI also works.
 *
 * @see {@linkcode MapboxMapViewMethods.loadStyle}
 */
export const MapStyles = {
  /** Mapbox Standard. */
  standard: 'mapbox://styles/mapbox/standard',
  /** Mapbox Standard Satellite. */
  standardSatellite: 'mapbox://styles/mapbox/standard-satellite',
} as const satisfies Record<string, string>
