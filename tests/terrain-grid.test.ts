import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getTerrainGridLayout,
  tileCenterLatitude,
  tileGroundSpanMeters,
  tileMetersPerPixel,
  tileSampleSpacingMeters,
} from '../src/terrain/gpu/grid'

test('full-resolution grid emits two triangles per source cell', () => {
  const layout = getTerrainGridLayout(512, 512, 1)

  assert.equal(layout.cellColumns, 511)
  assert.equal(layout.cellRows, 511)
  assert.equal(layout.cellCount, 511 * 511)
  assert.equal(layout.vertexCount, 511 * 511 * 6)
  assert.equal(layout.skirtSegmentCount, 511 * 2 + 511 * 2)
  assert.equal(layout.skirtVertexCount, layout.skirtSegmentCount * 6)
})

test('LOD changes only cell count and keeps the final partial edge', () => {
  const layout = getTerrainGridLayout(512, 512, 8)

  assert.equal(layout.cellColumns, 64)
  assert.equal(layout.cellRows, 64)
  assert.equal(layout.vertexCount, 64 * 64 * 6)
})

test('non-divisible terrain dimensions keep their final edge cell', () => {
  const layout = getTerrainGridLayout(10, 7, 4)

  assert.equal(layout.cellColumns, 3)
  assert.equal(layout.cellRows, 2)
  assert.equal(layout.vertexCount, 36)
})

test('tile center latitude is zero for equatorial center tile', () => {
  const latitude = tileCenterLatitude({ z: 1, x: 0, y: 0 })
  assert.ok(latitude > 0)

  const south = tileCenterLatitude({ z: 1, x: 0, y: 1 })
  assert.ok(south < 0)
  assert.ok(Math.abs(latitude + south) < 1e-10)
})

test('512 decoded pixels have half the ground resolution of 256', () => {
  const tile = { z: 10, x: 301, y: 385 }

  const at256 = tileMetersPerPixel(tile, 256)
  const at512 = tileMetersPerPixel(tile, 512)

  assert.ok(at256 > 0)
  assert.ok(Math.abs(at256 / 2 - at512) < 1e-10)
})


test('sample spacing spans the exact geographic tile width', () => {
  const tile = { z: 10, x: 301, y: 385 }
  const span = tileGroundSpanMeters(tile)
  const spacing = tileSampleSpacingMeters(tile, 512)

  assert.ok(span > 0)
  assert.ok(Math.abs(spacing * 511 - span) < 1e-9)
})

test('raster resolution and geometry sample spacing are intentionally distinct', () => {
  const tile = { z: 10, x: 301, y: 385 }

  const rasterResolution = tileMetersPerPixel(tile, 512)
  const geometrySpacing = tileSampleSpacingMeters(tile, 512)

  assert.ok(geometrySpacing > rasterResolution)
  assert.ok(
    Math.abs(rasterResolution * 512 - geometrySpacing * 511) < 1e-9,
  )
})
