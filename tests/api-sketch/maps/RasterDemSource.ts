import type { MapStyle } from './MapStyle.nitro'

/**
 * A raster DEM source for 3D terrain, such as
 * `mapbox://mapbox.mapbox-terrain-dem-v1`.
 *
 * @see {@linkcode MapStyle.addRasterDemSource}
 * @see {@linkcode MapStyle.setTerrain}
 */
export interface RasterDemSource {
  /** Source id, unique within the style. */
  id: string
  /** TileJSON URL or `mapbox://` tileset URL. */
  url: string
  /** Tile size in pixels. @default 512 */
  tileSizePx?: number
}
