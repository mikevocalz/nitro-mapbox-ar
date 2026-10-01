import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createFeatureSet,
  getMapboxFeature,
  listMapboxFeatures,
} from '../src/experimental/registry'

test('preview features never become default-enabled accidentally', () => {
  for (const feature of listMapboxFeatures()) {
    if (feature.status !== 'stable') {
      assert.equal(feature.defaultEnabled, false)
    }
  }
})

test('Vulkan remains explicitly Android-only preview', () => {
  const feature = getMapboxFeature('android-vulkan')
  assert.equal(feature.status, 'public-preview')
  assert.deepEqual(feature.platform, ['android'])
})

test('Mapbox Standard indoor and HD roads are modeled as opt-in stable style features', () => {
  assert.equal(getMapboxFeature('standard-indoor').status, 'stable')
  assert.equal(getMapboxFeature('standard-hd-roads').status, 'stable')

  const set = createFeatureSet(['standard-indoor', 'standard-hd-roads'])
  assert.equal(set.enabled.has('standard-indoor'), true)
  assert.equal(set.enabled.has('standard-hd-roads'), true)
})

test('visionOS Graphite requires host validation', () => {
  assert.equal(
    getMapboxFeature('graphite-visionos').status,
    'host-validation',
  )
})
