import type { TileId } from './tiles'

/**
 * Trims a Mapbox access token and rejects an empty one.
 *
 * @throws {Error} When the token is empty after trimming.
 */
export function assertMapboxToken(token: string): string {
  const value = token.trim()
  if (value.length === 0) {
    throw new Error('A Mapbox access token is required')
  }
  return value
}

/**
 * The `z/x/y` path of an XYZ tile.
 *
 * @throws {RangeError} When the zoom is outside 0..30 or x/y fall outside the
 * zoom's tile grid.
 */
export function tilePath(tile: TileId): string {
  if (!Number.isSafeInteger(tile.z) || tile.z < 0 || tile.z > 30) {
    throw new RangeError('tile.z must be an integer between 0 and 30')
  }

  const extent = 2 ** tile.z
  if (
    !Number.isSafeInteger(tile.x) ||
    !Number.isSafeInteger(tile.y) ||
    tile.x < 0 ||
    tile.y < 0 ||
    tile.x >= extent ||
    tile.y >= extent
  ) {
    throw new RangeError(
      `tile x/y must be within [0, ${extent - 1}] for zoom ${tile.z}`,
    )
  }
  return `${tile.z}/${tile.x}/${tile.y}`
}
