import type {
  MapboxRasterClient,
  RasterTileSize,
  SatelliteFormat,
} from '../../mapbox/raster'
import type { TileId } from '../../mapbox/tiles'
import {
  makeWebGPUTextureFromEncodedBytes,
  type AdoptedWebGPUTexture,
} from '../../rendering/graphite'

export interface GpuSatelliteTile {
  readonly tile: TileId
  readonly texture: AdoptedWebGPUTexture
  readonly width: number
  readonly height: number
  dispose(): void
}

export async function loadSatelliteTileOnGpu(
  client: MapboxRasterClient,
  tile: TileId,
  options: {
    tileSize?: RasterTileSize
    format?: SatelliteFormat
    signal?: AbortSignal
  } = {},
): Promise<GpuSatelliteTile> {
  const response = await client.fetchSatellite(tile, {
    tileSize: options.tileSize,
    format: options.format,
    signal: options.signal,
  })

  const decoded = makeWebGPUTextureFromEncodedBytes(response.bytes)
  let disposed = false

  return {
    tile,
    texture: decoded.texture,
    width: decoded.width,
    height: decoded.height,
    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      decoded.dispose()
    },
  }
}
