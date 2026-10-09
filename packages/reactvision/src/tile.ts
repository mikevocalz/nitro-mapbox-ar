/**
 * An XYZ Web Mercator tile. Structurally identical to `TileId` in
 * `@mikevocalz/nitro-mapbox-ar`, so tiles from `tilesForBBox` can be
 * passed straight in.
 *
 * @see {@linkcode tilePointToLngLat}
 */
export interface XyzTile {
  readonly z: number
  readonly x: number
  readonly y: number
}

/**
 * @throws {RangeError} When the zoom is outside 0..30 or x/y fall outside the
 * zoom's tile grid.
 */
export function validateTile(tile: XyzTile): void {
  if (!Number.isSafeInteger(tile.z) || tile.z < 0 || tile.z > 30) {
    throw new RangeError('tile.z must be an integer between 0 and 30')
  }
  const n = 2 ** tile.z
  if (
    !Number.isSafeInteger(tile.x) ||
    !Number.isSafeInteger(tile.y) ||
    tile.x < 0 ||
    tile.y < 0 ||
    tile.x >= n ||
    tile.y >= n
  ) {
    throw new RangeError(`tile x/y must be within [0, ${n - 1}] for zoom ${tile.z}`)
  }
}

/** `z/x/y` key of a tile, for React keys and caches. */
export function tileKey(tile: XyzTile): string {
  return `${tile.z}/${tile.x}/${tile.y}`
}

/**
 * Converts a point inside a tile, in tile units where the tile spans
 * `0..extent` on both axes with y pointing south, to WGS84 degrees.
 * Points outside `0..extent` (vector tile buffers) are allowed.
 */
export function tilePointToLngLat(
  tile: XyzTile,
  px: number,
  py: number,
  extent: number,
): { readonly longitude: number; readonly latitude: number } {
  const n = 2 ** tile.z
  const x = (tile.x + px / extent) / n
  const y = (tile.y + py / extent) / n
  return {
    longitude: x * 360 - 180,
    latitude: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
  }
}
