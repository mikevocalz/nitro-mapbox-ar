import type { TileId } from '../../mapbox/tiles'

/**
 * Diff between the current and desired tile sets, produced by
 * {@linkcode planTerrainNeighborhoodTransition}. Keys use the
 * {@linkcode terrainTileKey} format.
 */
export interface TerrainNeighborhoodTransitionPlan {
  /** Keys present in both sets, in desired-tile order. Their leases are kept. */
  readonly retain: readonly string[]
  /** Desired tiles not currently held, deduplicated, in desired-tile order. */
  readonly acquire: readonly TileId[]
  /** Currently held keys that fall outside the desired set. */
  readonly release: readonly string[]
}

/**
 * Builds the `z/x/y` string key that identifies a tile in
 * {@linkcode TerrainNeighborhoodTransitionPlan}.
 */
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
