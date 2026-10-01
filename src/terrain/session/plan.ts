import type { TileId } from '../../mapbox/tiles'

export interface TerrainNeighborhoodTransitionPlan {
  readonly retain: readonly string[]
  readonly acquire: readonly TileId[]
  readonly release: readonly string[]
}

export function terrainTileKey(tile: TileId): string {
  return `${tile.z}/${tile.x}/${tile.y}`
}

/**
 * Pure diff used by the runtime session so tile movement can be tested without
 * creating a graphics device.
 */
export function planTerrainNeighborhoodTransition(
  currentKeys: Iterable<string>,
  desiredTiles: readonly TileId[],
): TerrainNeighborhoodTransitionPlan {
  const current = new Set(currentKeys)
  const desired = new Set<string>()
  const retain: string[] = []
  const acquire: TileId[] = []

  for (const tile of desiredTiles) {
    const key = terrainTileKey(tile)
    if (desired.has(key)) {
      continue
    }

    desired.add(key)
    if (current.has(key)) {
      retain.push(key)
    } else {
      acquire.push(tile)
    }
  }

  const release = [...current].filter((key) => !desired.has(key))

  return {
    retain,
    acquire,
    release,
  }
}
