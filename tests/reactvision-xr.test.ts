import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canShareColocationFrame,
  createSpatialContextSnapshot,
  normalizeReactVisionCapabilities,
} from '../packages/reactvision/src/xr'

test('co-location stays inside ReactVision same-family frames', () => {
  assert.equal(canShareColocationFrame('ios', 'android'), true)
  assert.equal(canShareColocationFrame('quest', 'quest'), true)
  assert.equal(canShareColocationFrame('visionos', 'visionos'), true)
  assert.equal(canShareColocationFrame('quest', 'ios'), false)
  assert.equal(canShareColocationFrame('web', 'web'), false)
})

test('visionOS defaults Graphite capability off until host validation', () => {
  const capabilities = normalizeReactVisionCapabilities({
    platform: 'visionos',
  })

  assert.equal(capabilities.immersive, true)
  assert.equal(capabilities.colocation, true)
  assert.equal(capabilities.graphiteOnVisionOS, false)
})

test('web context strips unsupported gaze and peer state', () => {
  const capabilities = normalizeReactVisionCapabilities({
    platform: 'web',
  })

  const snapshot = createSpatialContextSnapshot(capabilities, {
    visibleAnchorIds: ['a'],
    peerCount: 2,
    gaze: {
      origin: [0, 0, 0],
      direction: [0, 0, -1],
    },
  })

  assert.equal(snapshot.gaze, undefined)
  assert.equal(snapshot.peerCount, undefined)
})
