import type { MapboxMaps } from '../specs/MapboxMaps.nitro'
import type { MapStyle } from '../specs/MapStyle.nitro'

/**
 * What the map renderer on this device can do. Values do not change while the
 * process runs.
 *
 * @see {@linkcode MapboxMaps.capabilities}
 */
export interface MapCapabilities {
  /** `true` when `projection: 'globe'` renders as a globe. */
  readonly supportsGlobeProjection: boolean
  /**
   * `true` when {@linkcode MapStyle.setTerrain} renders 3D terrain. When
   * `false`, `setTerrain` rejects.
   */
  readonly supportsTerrain: boolean
  /** `true` when 3D model layers (`type: 'model'`) render. */
  readonly supportsModelLayers: boolean
  /**
   * `true` when the device can report its location to the map's location
   * puck. `false` on hosts without location services, such as Meta Quest.
   */
  readonly supportsLocationPuck: boolean
}
