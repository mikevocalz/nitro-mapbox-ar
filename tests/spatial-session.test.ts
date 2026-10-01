import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SpatialTileSession,
  type SpatialTileSessionCache,
} from '../src/session/spatialTileSession'
import type { TileId } from '../src/mapbox/tiles'
import type { GpuTileLease } from '../src/terrain/cache/residency'
import type { GpuSatelliteTile } from '../src/terrain/gpu/imagery'
import type { GpuTerrainTileResult } from '../src/terrain/gpu/tile'

function key(tile: TileId): string {
  return `${tile.z}/${tile.x}/${tile.y}`
}

function lease<T>(value: T, releases: string[], id: string): GpuTileLease<T> {
  let released = false
  return {
    value,
    release() {
      if (released) return
      released = true
      releases.push(id)
    },
  }
}

class FakeCache implements SpatialTileSessionCache {
  readonly releases: string[] = []
  readonly terrainAcquires: string[] = []
  readonly satelliteAcquires: string[] = []
  readonly prefetches: string[] = []

  async acquireTerrain(tile: TileId): Promise<GpuTileLease<GpuTerrainTileResult>> {
    const id = key(tile)
    this.terrainAcquires.push(id)
    return lease(
      { kind: 'water', tile },
      this.releases,
      `terrain:${id}`,
    )
  }

  async acquireSatellite(tile: TileId): Promise<GpuTileLease<GpuSatelliteTile>> {
    const id = key(tile)
    this.satelliteAcquires.push(id)
    return lease(
      { tile, width: 1, height: 1 } as unknown as GpuSatelliteTile,
      this.releases,
      `satellite:${id}`,
    )
  }

  async prefetchTerrainNeighborhood(center: TileId, radius: number): Promise<void> {
    this.prefetches.push(`terrain:${key(center)}:${radius}`)
  }

  async prefetchSatelliteNeighborhood(center: TileId, radius: number): Promise<void> {
    this.prefetches.push(`satellite:${key(center)}:${radius}`)
  }
}

test('session retains overlap and releases tiles that leave the visible set', async () => {
  const cache = new FakeCache()
  const session = new SpatialTileSession(cache, {
    visibleRadius: 0,
    prefetchRadius: 1,
  })

  const first = await session.updateCenter({ z: 4, x: 3, y: 5 })
  assert.equal(first.entries.length, 1)
  assert.equal(cache.terrainAcquires.length, 1)
  assert.equal(cache.satelliteAcquires.length, 1)

  await session.updateCenter({ z: 4, x: 4, y: 5 })

  assert.deepEqual(cache.releases.sort(), [
    'satellite:4/3/5',
    'terrain:4/3/5',
  ])
  assert.equal(session.residentCount, 1)
  assert.ok(cache.prefetches.includes('terrain:4/4/5:1'))

  session.dispose()
  assert.equal(session.residentCount, 0)
  assert.ok(cache.releases.includes('terrain:4/4/5'))
})

test('session can run terrain-only without acquiring imagery', async () => {
  const cache = new FakeCache()
  const session = new SpatialTileSession(cache, {
    visibleRadius: 0,
    prefetchRadius: 0,
    includeSatellite: false,
  })

  const snapshot = await session.updateCenter({ z: 3, x: 1, y: 2 })

  assert.equal(snapshot.entries.length, 1)
  assert.equal(snapshot.entries[0].satellite, undefined)
  assert.equal(cache.satelliteAcquires.length, 0)
  assert.equal(cache.prefetches.length, 0)

  session.dispose()
})
