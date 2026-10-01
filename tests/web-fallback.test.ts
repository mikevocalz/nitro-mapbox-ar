import assert from 'node:assert/strict'
import test from 'node:test'

import { getMapboxARCore } from '../src/native/MapboxARCore.web'
import {
  getBrowserRendererCapabilities,
} from '../src/web/capabilities'
import { selectRendererBackend } from '../src/rendering/backend'

test('web MapboxARCore preserves token semantics without Nitro', () => {
  const core = getMapboxARCore()
  core.setAccessToken('  pk.web  ')

  assert.equal(core.getAccessToken(), 'pk.web')
  assert.equal(core.hasAccessToken(), true)
  assert.doesNotThrow(() => core.assertAccessToken())
})

test('web CPU fallback decodes Terrain-RGB with the same formula', () => {
  const core = getMapboxARCore()
  const rgba = new Uint8Array([
    1, 134, 160, 255,
    1, 182, 217, 255,
  ])

  const heights = new Float32Array(
    core.decodeTerrainRgb(rgba.buffer, 1),
  )

  assert.ok(Math.abs(heights[0] - 0) < 0.0001)
  assert.ok(Math.abs(heights[1] - 1234.5) < 0.001)
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
