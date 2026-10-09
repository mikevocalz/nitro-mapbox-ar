import type { MapStyle } from './MapStyle.nitro'

/**
 * A GeoJSON source holding inline data.
 *
 * @see {@linkcode MapStyle.addGeoJsonSource}
 */
export interface GeoJsonSource {
  /** Source id, unique within the style. */
  id: string
  /** A GeoJSON `Feature`, `FeatureCollection` or geometry, as JSON text. */
  data: string
}
