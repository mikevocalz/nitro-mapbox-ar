import assert from 'node:assert/strict'
import test from 'node:test'

import { MapboxAR } from '../src/native/MapboxAR.web'
import {
  getBrowserRendererCapabilities,
} from '../src/web/capabilities'
import { selectRendererBackend } from '../src/rendering/backend'

test('web MapboxAR stores the token as given and clears it with an empty string', () => {
  MapboxAR.accessToken = 'pk.web'
  assert.equal(MapboxAR.accessToken, 'pk.web')
  MapboxAR.accessToken = ''
  assert.equal(MapboxAR.accessToken, '')
})

test('web CPU fallback decodes Terrain-RGB with the same formula', () => {
  const rgba = new Uint8Array([
    1, 134, 160, 255,
    1, 182, 217, 255,
  ])

  const heights = new Float32Array(
    MapboxAR.decodeTerrainRgb(rgba.buffer, 1),
  )

  assert.ok(Math.abs(heights[0] - 0) < 0.0001)
  assert.ok(Math.abs(heights[1] - 1234.5) < 0.001)
})

test('web decodeTerrainRgb rejects inputs above 1 MiB and names the async form', () => {
  const oversized = new ArrayBuffer(1024 * 1024 + 4)
  assert.throws(
    () => MapboxAR.decodeTerrainRgb(oversized, 1),
    (error: unknown) => error instanceof RangeError && error.message.includes('decodeTerrainRgbAsync'),
  )
})

test('web decodeTerrainRgbAsync decodes oversized input and keeps each result with its input', async () => {
  const pixels = (1024 * 1024) / 4 + 1
  const make = (g: number) => {
    const bytes = new Uint8Array(pixels * 4)
    for (let offset = 0; offset < bytes.length; offset += 4) {
      bytes[offset] = 1
      bytes[offset + 1] = g
    }
    return bytes.buffer
  }
  const [low, high] = await Promise.all([
    MapboxAR.decodeTerrainRgbAsync(make(134), 1),
    MapboxAR.decodeTerrainRgbAsync(make(182), 1),
  ])
  assert.ok(Math.abs(new Float32Array(low)[pixels - 1] - -16) < 0.001)
  assert.ok(Math.abs(new Float32Array(high)[pixels - 1] - 1212.8) < 0.001)
  await assert.rejects(MapboxAR.decodeTerrainRgbAsync(new ArrayBuffer(3), 1), RangeError)
})

test('auto renderer falls back to JS CPU when browser WebGPU is unavailable', () => {
  const capabilities = {
    ...getBrowserRendererCapabilities(),
    webgpu: false,
  }

  assert.equal(
    selectRendererBackend('auto', capabilities),
    'js-cpu',
  )
  assert.equal(
    selectRendererBackend('cpu', capabilities),
    'js-cpu',
  )
})
