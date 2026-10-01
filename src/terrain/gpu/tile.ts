import type { MapboxRasterClient } from '../../mapbox/raster'
import type { TileId } from '../../mapbox/tiles'
import {
  makeWebGPUTextureFromEncodedBytes,
  type AdoptedWebGPUTexture,
} from '../../rendering/graphite'
import {
  decodeTerrainRgbOnGpu,
  type GpuHeightField,
} from './terrainRgb'

export interface GpuTerrainTile {
  readonly tile: TileId
  readonly sourceTexture: AdoptedWebGPUTexture
  readonly heights: GpuHeightField
  readonly width: number
  readonly height: number
  dispose(): void
}

export type GpuTerrainTileResult =
  | {
      readonly kind: 'tile'
      readonly value: GpuTerrainTile
    }
  | {
      readonly kind: 'water'
      readonly tile: TileId
    }

/**
 * Fetches one Terrain-RGB tile, decodes the encoded PNG with Skia, adopts the
 * native texture into the shared WebGPU device, and dispatches the TypeGPU
 * elevation compute pass.
 *
 * No JS-side RGBA pixel array and no GPU readback are created.
 */
export async function loadTerrainTileOnGpu(
  client: MapboxRasterClient,
  tile: TileId,
  options: {
    tileSize?: 256 | 512
    heightModifier?: number
    signal?: AbortSignal
  } = {},
): Promise<GpuTerrainTileResult> {
  const response = await client.fetchTerrainRgb(tile, {
    tileSize: options.tileSize,
    signal: options.signal,
  })

  if (response.kind === 'water') {
    return {
      kind: 'water',
      tile,
    }
  }

  const decoded = makeWebGPUTextureFromEncodedBytes(response.value.bytes)

  try {
    const heights = decodeTerrainRgbOnGpu({
      source: decoded.texture,
      width: decoded.width,
      height: decoded.height,
      heightModifier: options.heightModifier,
    })

    let disposed = false

    return {
      kind: 'tile',
      value: {
        tile,
        sourceTexture: decoded.texture,
        heights,
        width: decoded.width,
        height: decoded.height,
        dispose() {
          if (disposed) {
            return
          }

          disposed = true
          heights.dispose()
          decoded.dispose()
        },
      },
    }
  } catch (error) {
    decoded.dispose()
    throw error
  }
}
