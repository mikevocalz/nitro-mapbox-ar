import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeMapboxARConfig } from '../src/core/config.ts'
import { selectRendererBackend } from '../src/rendering/backend.ts'
import type { RendererPreference } from '../src/types.ts'

const jsCpuOnly = { graphite: false, webgpu: false, sharedDawnDevice: false, nitro: false, jsCpu: true }

test('config accepts every renderer preference that selectRendererBackend resolves', () => {
  const preferences: RendererPreference[] = ['auto', 'graphite', 'webgpu', 'nitro', 'cpu']
  for (const renderer of preferences) {
    assert.equal(normalizeMapboxARConfig({ accessToken: 'pk.test', renderer }).renderer, renderer)
  }
})

test("'cpu' passes config and resolves to the JS CPU path without Nitro", () => {
  const { renderer } = normalizeMapboxARConfig({ accessToken: 'pk.test', renderer: 'cpu' })
  assert.equal(selectRendererBackend(renderer, jsCpuOnly), 'js-cpu')
})

test('config still rejects unknown renderers and empty tokens', () => {
  assert.throws(
    () => normalizeMapboxARConfig({ accessToken: 'pk.test', renderer: 'metal' as RendererPreference }),
    /Unsupported renderer preference: metal/,
  )
  assert.throws(() => normalizeMapboxARConfig({ accessToken: '  ' }), /access token is required/)
})
