import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertTerrainLodStride,
  terrainGridSize,
} from '../src/terrain/lod'

test('full-resolution grid emits two triangles per source cell', () => {
  const grid = terrainGridSize(4, 3, 1)

  assert.deepEqual(grid, {
    cellsX: 3,
    cellsY: 2,
    samplesX: 4,
    samplesY: 3,
    vertexCount: 36,
  })
})

test('LOD stride reduces draw vertices without dropping the final tile edge', () => {
  const grid = terrainGridSize(512, 512, 4)

  assert.equal(grid.cellsX, 128)
  assert.equal(grid.cellsY, 128)
  assert.equal(grid.samplesX, 129)
  assert.equal(grid.samplesY, 129)
  assert.equal(grid.vertexCount, 128 * 128 * 6)
})

test('LOD handles dimensions that are not divisible by stride', () => {
  const grid = terrainGridSize(10, 7, 4)

  assert.deepEqual(grid, {
    cellsX: 3,
    cellsY: 2,
    samplesX: 4,
    samplesY: 3,
    vertexCount: 36,
  })
})

test('invalid LOD strides fail before a draw is encoded', () => {
  assert.throws(() => assertTerrainLodStride(0), /positive safe integer/)
  assert.throws(() => assertTerrainLodStride(1.5), /positive safe integer/)
})
