import type { TileId } from '../../mapbox/tiles'

function assertTile(tile: TileId): void {
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
    throw new RangeError('tile x/y are outside the zoom extent')
  }
}

/**
 * Returns a square same-zoom XYZ neighborhood with x wrapping and y clamping.
 *
 * Duplicate tiles are removed at low zoom levels where the requested radius
 * may wrap around the world more than once.
 */
export function terrainTileNeighborhood(
  center: TileId,
  radius: number,
): TileId[] {
  assertTile(center)

  if (!Number.isSafeInteger(radius) || radius < 0) {
    throw new RangeError('radius must be a non-negative safe integer')
  }

  const extent = 2 ** center.z
  const seen = new Set<string>()
  const tiles: TileId[] = []

  for (let dy = -radius; dy <= radius; dy += 1) {
    const y = center.y + dy
    if (y < 0 || y >= extent) {
      continue
    }

    for (let dx = -radius; dx <= radius; dx += 1) {
      const x = ((center.x + dx) % extent + extent) % extent
      const key = `${center.z}/${x}/${y}`

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      tiles.push({
        z: center.z,
        x,
        y,
      })
    }
  }

  return tiles
}
