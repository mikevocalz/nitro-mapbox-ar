import type { MapStyle } from '../specs/MapStyle.nitro'

/**
 * A vector tile source.
 *
 * @see {@linkcode MapStyle.addVectorSource}
 */
export interface VectorSource {
  /** Source id, unique within the style. */
  id: string
  /** TileJSON URL or `mapbox://` tileset URL. */
  url: string
}
