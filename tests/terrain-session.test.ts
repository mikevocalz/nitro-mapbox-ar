import assert from 'node:assert/strict'
import test from 'node:test'

import {
  planTerrainNeighborhoodTransition,
  terrainTileKey,
} from '../src/terrain/session/plan'

test('neighborhood transition retains overlap and acquires only new tiles', () => {
  const current = [
    '8/10/10',
    '8/11/10',
    '8/10/11',
  ]
  const desired = [
    { z: 8, x: 11, y: 10 },
    { z: 8, x: 12, y: 10 },
    { z: 8, x: 10, y: 11 },
  ]

  const plan = planTerrainNeighborhoodTransition(current, desired)

  assert.deepEqual(plan.retain, ['8/11/10', '8/10/11'])
  assert.deepEqual(plan.acquire, [{ z: 8, x: 12, y: 10 }])
  assert.deepEqual(plan.release, ['8/10/10'])
})

test('transition plan deduplicates repeated desired tiles', () => {
  const tile = { z: 4, x: 2, y: 3 }
  const plan = planTerrainNeighborhoodTransition([], [tile, tile])

  assert.deepEqual(plan.acquire, [tile])
})

test('terrainTileKey is stable XYZ notation', () => {
  assert.equal(terrainTileKey({ z: 12, x: 1205, y: 1538 }), '12/1205/1538')
})
