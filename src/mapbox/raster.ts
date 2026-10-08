import { assertMapboxToken, tilePath } from './request'
import type { TileId } from './tiles'

export type RasterTileSize = 256 | 512
export type SatelliteFormat = 'webp' | 'jpg90'

export interface MapboxRasterClientOptions {
  accessToken: string
  fetchImpl?: typeof fetch
}

export interface MapboxTileBytes {
  readonly bytes: ArrayBuffer
  readonly contentType: string | null
}

export type TerrainTileResult =
  | {
      readonly kind: 'tile'
      readonly value: MapboxTileBytes
    }
  | {
      /**
       * Mapbox intentionally returns 404 for Terrain-RGB tiles fully covered by
       * ocean. Callers should interpret this as zero elevation.
       */
      readonly kind: 'water'
    }

const MAPBOX_V4 = 'https://api.mapbox.com/v4'

function scaleSuffix(tileSize: RasterTileSize): string {
  return tileSize === 512 ? '@2x' : ''
}

export function terrainRgbSourceZoom(
  requestedZoom: number,
  tileSize: RasterTileSize,
): number {
  if (!Number.isSafeInteger(requestedZoom) || requestedZoom < 0) {
    throw new RangeError('requestedZoom must be a non-negative integer')
  }

  // Mapbox Terrain-RGB has source data through z15 for 256px tiles and the
  // equivalent z14 source resolution when requesting @2x/512px tiles.
  return Math.min(requestedZoom, tileSize === 512 ? 14 : 15)
}

export class MapboxRasterClient {
  readonly #accessToken: string
  readonly #fetch: typeof fetch
  readonly #inflight = new Map<string, Promise<MapboxTileBytes>>()

  constructor(options: MapboxRasterClientOptions) {
    this.#accessToken = assertMapboxToken(options.accessToken)
    this.#fetch = options.fetchImpl ?? globalThis.fetch

    if (!this.#fetch) {
      throw new Error('No fetch implementation is available')
    }
  }

  #withToken(path: string): string {
    return `${MAPBOX_V4}/${path}?access_token=${encodeURIComponent(this.#accessToken)}`
  }

  #terrainUrl(tile: TileId, tileSize: RasterTileSize): string {
    return this.#withToken(
      `mapbox.terrain-rgb/${tilePath(tile)}${scaleSuffix(tileSize)}.pngraw`,
    )
  }

  #satelliteUrl(
    tile: TileId,
    tileSize: RasterTileSize,
    format: SatelliteFormat,
  ): string {
    return this.#withToken(
      `mapbox.satellite/${tilePath(tile)}${scaleSuffix(tileSize)}.${format}`,
    )
  }

  async #fetchBytes(
    url: string,
    signal?: AbortSignal,
  ): Promise<MapboxTileBytes> {
    // Shared requests are coalesced only when no caller-specific AbortSignal is
    // supplied; aborting one consumer must not cancel every consumer.
    if (!signal) {
      const existing = this.#inflight.get(url)
      if (existing) {
        return existing
      }
    }

    const request = (async () => {
      const response = await this.#fetch(url, { signal })
      if (!response.ok) {
        throw new Error(`Mapbox tile request failed with HTTP ${response.status}`)
      }

      return {
        bytes: await response.arrayBuffer(),
        contentType: response.headers.get('content-type'),
      }
    })()

    if (!signal) {
      this.#inflight.set(url, request)
    }

    try {
      return await request
    } finally {
      if (!signal) {
        this.#inflight.delete(url)
      }
    }
  }

  async fetchTerrainRgb(
    tile: TileId,
    options: {
      tileSize?: RasterTileSize
      signal?: AbortSignal
    } = {},
  ): Promise<TerrainTileResult> {
    const tileSize = options.tileSize ?? 512
    const url = this.#terrainUrl(tile, tileSize)

    const response = await this.#fetch(url, { signal: options.signal })
    if (response.status === 404) {
      return { kind: 'water' }
    }

    if (!response.ok) {
      throw new Error(
        `Mapbox Terrain-RGB request failed for ${tilePath(tile)} with HTTP ${response.status}`,
      )
    }

    return {
      kind: 'tile',
      value: {
        bytes: await response.arrayBuffer(),
        contentType: response.headers.get('content-type'),
      },
    }
  }

  /**
   * The URL of a Mapbox Satellite tile, access token included, for image
   * loaders that fetch by URI (a Viro material's `diffuseTexture`, an
   * `<Image>`). {@linkcode MapboxRasterClient.fetchSatellite} requests the
   * same URL.
   *
   * @throws {RangeError} When the tile is outside its zoom's grid.
   */
  satelliteTileUrl(
    tile: TileId,
    options: {
      /** @default 512 */
      tileSize?: RasterTileSize
      /** @default 'webp' */
      format?: SatelliteFormat
    } = {},
  ): string {
    return this.#satelliteUrl(
      tile,
      options.tileSize ?? 512,
      options.format ?? 'webp',
    )
  }

  fetchSatellite(
    tile: TileId,
    options: {
      tileSize?: RasterTileSize
      format?: SatelliteFormat
      signal?: AbortSignal
    } = {},
  ): Promise<MapboxTileBytes> {
    const tileSize = options.tileSize ?? 512
    const format = options.format ?? 'webp'

    return this.#fetchBytes(
      this.#satelliteUrl(tile, tileSize, format),
      options.signal,
    )
  }
}
