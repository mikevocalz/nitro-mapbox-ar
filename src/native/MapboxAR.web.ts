import { decodeTerrainRgbBytes } from './decodeTerrainRgbBytes'
import type { MapboxARWeb } from './MapboxARWeb'

const MAX_SYNC_TERRAIN_RGB_BYTES = 1024 * 1024

/**
 * Browser stand-in for the native `MapboxAR` root: same members, decoded in
 * JS. See {@linkcode MapboxARWeb}.
 */
export const MapboxAR: MapboxARWeb = {
  accessToken: '',

  decodeTerrainRgb(rgba, heightModifier) {
    if (rgba.byteLength > MAX_SYNC_TERRAIN_RGB_BYTES) {
      throw new RangeError(
        `Terrain-RGB input is ${rgba.byteLength} bytes; decodeTerrainRgb accepts at most ` +
          `${MAX_SYNC_TERRAIN_RGB_BYTES} bytes (one 512 x 512 tile). ` +
          'Use decodeTerrainRgbAsync for larger inputs.',
      )
    }
    return decodeTerrainRgbBytes(rgba, heightModifier)
  },

  decodeTerrainRgbAsync(rgba, heightModifier) {
    try {
      const input = rgba.slice(0)
      return Promise.resolve(decodeTerrainRgbBytes(input, heightModifier))
    } catch (error) {
      return Promise.reject(error)
    }
  },
}
/** Type of the web {@linkcode MapboxAR} object. */
export type MapboxAR = MapboxARWeb
