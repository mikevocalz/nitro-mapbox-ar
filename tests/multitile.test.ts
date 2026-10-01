import assert from 'node:assert/strict'
import test from 'node:test'

import { tileGroundSpanMeters } from '../src/terrain/gpu/grid'
import {
  getLocalTileOffset,
  makeTranslationMatrix,
  multiplyMatrix4,
  wrappedTileDeltaX,
} from '../src/terrain/gpu/multitile'

test('east and south neighbors are exactly one local tile span away', () => {
  const origin = { z: 8, x: 75, y: 96 }
  const span = tileGroundSpanMeters(origin)

  assert.deepEqual(getLocalTileOffset(origin, { ...origin, x: 76 }, span), {
    x: span,
    z: 0,
  })
  assert.deepEqual(getLocalTileOffset(origin, { ...origin, y: 97 }, span), {
    x: 0,
    z: span,
  })
})

test('antimeridian wrapping treats x=0 as the east neighbor of the last tile', () => {
  const zoom = 3
  const extent = 2 ** zoom
  const origin = { z: zoom, x: extent - 1, y: 3 }

  assert.equal(
    wrappedTileDeltaX(origin, { z: zoom, x: 0, y: 3 }),
    1,
  )
  assert.equal(
    wrappedTileDeltaX(
      { z: zoom, x: 0, y: 3 },
      { z: zoom, x: extent - 1, y: 3 },
    ),
    -1,
  )
})

test('multi-tile placement rejects mixed zoom levels', () => {
  assert.throws(
    () =>
      getLocalTileOffset(
        { z: 8, x: 10, y: 10 },
        { z: 9, x: 20, y: 20 },
      ),
    /one zoom level/,
  )
})

test('matrix multiplication preserves translation under identity view projection', () => {
  const identity = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ])
  const translation = makeTranslationMatrix(10, 2, -4)
  const result = multiplyMatrix4(identity, translation)

  assert.deepEqual(Array.from(result), Array.from(translation))
})
