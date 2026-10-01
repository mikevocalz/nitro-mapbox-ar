import type { MapboxARCore } from './MapboxARCore.types'

let accessToken = ''

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`)
  }
}

const instance: MapboxARCore = {
  setAccessToken(value) {
    const normalized = value.trim()
    if (!normalized) {
      throw new Error('Mapbox access token cannot be empty')
    }
    accessToken = normalized
  },

  getAccessToken() {
    return accessToken
  },

  hasAccessToken() {
    return accessToken.length > 0
  },

  assertAccessToken() {
    if (!accessToken) {
      throw new Error('Mapbox access token has not been configured')
    }
  },

  decodeTerrainRgb(rgba, heightModifier) {
    if (rgba.byteLength % 4 !== 0) {
      throw new RangeError(
        'Terrain-RGB input must contain exactly 4 bytes per pixel',
      )
    }

    assertFinite(heightModifier, 'heightModifier')

    const source = new Uint8Array(rgba)
    const count = source.length / 4
    const output = new ArrayBuffer(count * Float32Array.BYTES_PER_ELEMENT)
    const heights = new Float32Array(output)

    for (let pixel = 0; pixel < count; pixel += 1) {
      const offset = pixel * 4
      const encoded =
        source[offset] * 65536 +
        source[offset + 1] * 256 +
        source[offset + 2]

      heights[pixel] =
        (-10000 + encoded * 0.1) * heightModifier
    }

    return output
  },
}

export type { MapboxARCore } from './MapboxARCore.types'

export function getMapboxARCore(): MapboxARCore {
  return instance
}
