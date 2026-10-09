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

/**
 * A satellite raster tile decoded by Skia and resident as a texture on the
 * shared Graphite WebGPU device. Returned by {@linkcode loadSatelliteTileOnGpu}.
 *
 * The caller owns the texture and must call {@linkcode GpuSatelliteTile.dispose}
 * once no renderer samples it. Renderers that take it as `imagery` borrow the
 * texture and never destroy it.
 */
export interface GpuSatelliteTile {
  /** XYZ tile this imagery covers. */
  readonly tile: TileId
  /** Decoded imagery texture on the shared Graphite device. */
  readonly texture: AdoptedWebGPUTexture
  /** Decoded width in pixels. */
  readonly width: number
  /** Decoded height in pixels. */
  readonly height: number
  /** Destroys {@linkcode GpuSatelliteTile.texture}. Safe to call more than once. */
  dispose(): void
}

/**
 * Fetches one Mapbox satellite tile and decodes it into a GPU texture on the
 * shared Graphite device. The encoded bytes go to Skia without a JS-side RGBA
 * array, and nothing is read back.
 *
 * @param client Raster client that performs the request.
 * @param tile XYZ tile to fetch.
 * @param options `tileSize` and `format` are forwarded to the satellite
 * request; `signal` cancels the fetch.
 * @returns A {@linkcode GpuSatelliteTile} the caller must dispose.
 * @throws {Error} When the request fails, Skia cannot decode the bytes, or
 * Skia Graphite is unavailable.
 */
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
