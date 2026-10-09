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

/**
 * One Terrain-RGB tile decoded on the GPU: the source texture plus the
 * elevation buffer computed from it. Produced by
 * {@linkcode loadTerrainTileOnGpu}.
 *
 * The caller owns both resources and must call
 * {@linkcode GpuTerrainTile.dispose} after every renderer drawing this tile
 * has been disposed.
 */
export interface GpuTerrainTile {
  /** XYZ tile this elevation covers. */
  readonly tile: TileId
  /** Decoded Terrain-RGB texture (`rgba8unorm`) on the shared Graphite device. */
  readonly sourceTexture: AdoptedWebGPUTexture
  /** Per-texel elevations in metres, one `f32` per source texel. */
  readonly heights: GpuHeightField
  /** Decoded width in texels. Matches `heights.width`. */
  readonly width: number
  /** Decoded height in texels. Matches `heights.height`. */
  readonly height: number
  /**
   * Destroys the height buffer and the source texture. Safe to call more than
   * once.
   */
  dispose(): void
}

/**
 * Result of {@linkcode loadTerrainTileOnGpu}. Mapbox answers HTTP 404 for
 * Terrain-RGB tiles that are entirely ocean; that case comes back as
 * `kind: 'water'` with no GPU resources.
 */
export type GpuTerrainTileResult =
  | {
      /** The tile decoded. */
      readonly kind: 'tile'
      /** Decoded tile. The caller must dispose it. */
      readonly value: GpuTerrainTile
    }
  | {
      /** Mapbox has no elevation for this tile (HTTP 404). */
      readonly kind: 'water'
      /** The requested tile. */
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
