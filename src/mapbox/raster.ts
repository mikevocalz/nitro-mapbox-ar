import { assertMapboxToken, tilePath } from './request'
import type { TileId } from './tiles'

/**
 * Raster tile edge length in pixels. `512` requests the `@2x` variant.
 *
 * @see {@linkcode MapboxRasterClient.fetchTerrainRgb}
 */
export type RasterTileSize = 256 | 512
/**
 * Encoding of a Mapbox Satellite tile: WebP, or JPEG at quality 90.
 *
 * @see {@linkcode MapboxRasterClient.fetchSatellite}
 */
export type SatelliteFormat = 'webp' | 'jpg90'

/** Options for {@linkcode MapboxRasterClient}. */
export interface MapboxRasterClientOptions {
  /** Mapbox access token. Surrounding whitespace is trimmed; an empty token is rejected. */
  accessToken: string
  /** Fetch implementation; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch
}

/**
 * The raw, still-encoded body of a Mapbox raster tile.
 *
 * @see {@linkcode MapboxRasterClient.fetchSatellite}
 */
export interface MapboxTileBytes {
  /** Encoded image bytes (PNG, WebP or JPEG). */
  readonly bytes: ArrayBuffer
  /** The response's `Content-Type` header, or `null` when absent. */
  readonly contentType: string | null
}

/**
 * One Terrain-RGB tile, as {@linkcode MapboxRasterClient.fetchTerrainRgb}
 * returns it.
 */
export type TerrainTileResult =
  | {
      /** Mapbox returned the tile. */
      readonly kind: 'tile'
      /** The encoded `pngraw` tile. */
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

/**
 * The deepest zoom Terrain-RGB has source data for, capped at the requested
 * zoom: z15 for 256 px tiles, z14 for 512 px tiles. Requests deeper than this
 * only return upsampled data.
 *
 * @throws {RangeError} When `requestedZoom` is not a non-negative integer.
 */
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

/**
 * Fetches Mapbox Terrain-RGB and Satellite raster tiles from the v4 tile API
 * (`https://api.mapbox.com/v4`).
 *
 * @throws {Error} From the constructor when the token is empty or no fetch
 * implementation exists.
 */
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

  /**
   * Fetches one Terrain-RGB elevation tile from
   * `v4/mapbox.terrain-rgb/{z}/{x}/{y}[@2x].pngraw`.
   *
   * @param options.tileSize Tile size in pixels. Defaults to `512`.
   * @param options.signal Aborts the request.
   * @returns `{ kind: 'water' }` when Mapbox answers 404, which it does for
   * tiles fully covered by ocean.
   * @throws {RangeError} When the tile is outside its zoom's grid.
   * @throws {Error} When Mapbox answers with any status other than 2xx or 404.
   * @see {@linkcode terrainRgbSourceZoom}
   */
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

  /**
   * Fetches one Mapbox Satellite tile from
   * `v4/mapbox.satellite/{z}/{x}/{y}[@2x].{format}`. Concurrent calls for the
   * same URL without a `signal` share one request; calls with a `signal`
   * always make their own.
   *
   * @param options.tileSize Tile size in pixels. Defaults to `512`.
   * @param options.format Tile encoding. Defaults to `'webp'`.
   * @param options.signal Aborts this caller's request.
   * @throws {RangeError} When the tile is outside its zoom's grid.
   * @throws {Error} When Mapbox answers with a non-2xx status.
   * @see {@linkcode MapboxRasterClient.satelliteTileUrl}
   */
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
