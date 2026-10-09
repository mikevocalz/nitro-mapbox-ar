import type { MapStyle } from '../specs/MapStyle.nitro'
import type { RasterDemSource } from './RasterDemSource'

/**
 * 3D terrain settings.
 *
 * @see {@linkcode MapStyle.setTerrain}
 */
export interface TerrainOptions {
  /** Id of a {@linkcode RasterDemSource} already added to the style. */
  sourceId: string
  /** Vertical scale, 0 to 1000. `1` is true scale. @default 1 */
  exaggeration?: number
}
