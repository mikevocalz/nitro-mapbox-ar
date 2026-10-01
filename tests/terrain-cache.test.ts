import assert from 'node:assert/strict'
import test from 'node:test'

import {
  estimateSatelliteGpuBytes,
  estimateTerrainGpuBytes,
} from '../src/terrain/cache/budget'
import { terrainTileNeighborhood } from '../src/terrain/cache/neighborhood'

test('GPU byte estimates reflect decoded texture and height storage', () => {
  assert.equal(estimateTerrainGpuBytes({ width: 512, height: 512 }), 512 * 512 * 8)
  assert.equal(estimateSatelliteGpuBytes({ width: 512, height: 512 }), 512 * 512 * 4)
})

test('radius one returns a 3x3 neighborhood away from world edges', () => {
  const tiles = terrainTileNeighborhood({ z: 5, x: 10, y: 10 }, 1)
  assert.equal(tiles.length, 9)
})

test('neighborhood wraps x across the antimeridian', () => {
  const tiles = terrainTileNeighborhood({ z: 2, x: 0, y: 1 }, 1)
  const xs = new Set(tiles.map((tile) => tile.x))

  assert.ok(xs.has(3))
  assert.ok(xs.has(0))
  assert.ok(xs.has(1))
})

test('neighborhood clamps y at the poles', () => {
  const tiles = terrainTileNeighborhood({ z: 2, x: 1, y: 0 }, 1)
  const ys = new Set(tiles.map((tile) => tile.y))

  assert.deepEqual([...ys].sort((a, b) => a - b), [0, 1])
})

test('large radii deduplicate wrapped low-zoom tiles', () => {
  const tiles = terrainTileNeighborhood({ z: 1, x: 0, y: 0 }, 5)
  const keys = new Set(tiles.map((tile) => `${tile.z}/${tile.x}/${tile.y}`))

  assert.equal(tiles.length, keys.size)
  assert.equal(tiles.length, 4)
})
