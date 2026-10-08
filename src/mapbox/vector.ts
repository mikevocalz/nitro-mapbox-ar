import { assertMapboxToken, tilePath } from './request'
import type { TileId } from './tiles'

/** Options for {@linkcode MapboxVectorClient}. */
export interface MapboxVectorClientOptions {
  /** Mapbox access token. A public `pk.` token is enough for vector tiles. */
  readonly accessToken: string
  /** Fetch implementation; defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch
}

/**
 * One Mapbox Vector Tile, as {@linkcode MapboxVectorClient.fetchVectorTile}
 * returns it.
 */
export type VectorTileResult =
  | {
      readonly kind: 'tile'
      /** The tile's protobuf bytes (Mapbox Vector Tile 2.1). */
      readonly bytes: ArrayBuffer
    }
  | {
      /**
       * Mapbox answered 404: the tileset has no data at this tile. Callers
       * should treat it as a tile with no features.
       */
      readonly kind: 'empty'
    }

/** The Mapbox Streets v8 tileset, which carries the `building` layer. */
export const MAPBOX_STREETS_V8 = 'mapbox.mapbox-streets-v8'

const MAPBOX_V4 = 'https://api.mapbox.com/v4'
const TILESET_ID = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

/**
 * Fetches Mapbox Vector Tiles (`.vector.pbf`) from the v4 tile API. Decoding
 * is left to the caller, for example `extrudeBuildings` in
 * `@mapbox/react-native-mapbox-ar-reactvision`.
 */
export class MapboxVectorClient {
  readonly #accessToken: string
  readonly #fetch: typeof fetch

  /**
   * @throws {Error} When the token is empty or no fetch implementation exists.
   */
  constructor(options: MapboxVectorClientOptions) {
    this.#accessToken = assertMapboxToken(options.accessToken)
    this.#fetch = options.fetchImpl ?? globalThis.fetch
    if (!this.#fetch) {
      throw new Error('No fetch implementation is available')
    }
  }

  /**
   * Fetches one vector tile.
   *
   * Mapbox Streets v8 holds source data through z16; Mapbox serves deeper
   * zooms by overzooming z16, so z16 is the most detailed useful request for
   * buildings.
   *
   * @throws {RangeError} When the tile is outside its zoom's grid or the
   * tileset id is not `account.tileset`.
   * @throws {Error} When Mapbox answers with any status other than 2xx or 404.
   */
  async fetchVectorTile(
    tile: TileId,
    options: {
      /** @default {@linkcode MAPBOX_STREETS_V8} */
      readonly tilesetId?: string
      readonly signal?: AbortSignal
    } = {},
  ): Promise<VectorTileResult> {
    const tilesetId = options.tilesetId ?? MAPBOX_STREETS_V8
    if (!TILESET_ID.test(tilesetId)) {
      throw new RangeError(`tilesetId must look like account.tileset, got ${tilesetId}`)
    }
    const path = tilePath(tile)
    const url = `${MAPBOX_V4}/${tilesetId}/${path}.vector.pbf?access_token=${encodeURIComponent(this.#accessToken)}`
    const response = await this.#fetch(url, { signal: options.signal })
    if (response.status === 404) {
      return { kind: 'empty' }
    }
    if (!response.ok) {
      throw new Error(
        `Mapbox vector tile request failed for ${tilesetId} ${path} with HTTP ${response.status}`,
      )
    }
    return { kind: 'tile', bytes: await response.arrayBuffer() }
  }
}
