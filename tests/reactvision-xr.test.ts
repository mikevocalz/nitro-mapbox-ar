import assert from 'node:assert/strict'
import test from 'node:test'

import { canShareColocationFrame } from '../packages/reactvision/src/canShareColocationFrame'
import { createSpatialContextSnapshot } from '../packages/reactvision/src/createSpatialContextSnapshot'
import { getSpatialHostCapabilities } from '../packages/reactvision/src/getSpatialHostCapabilities'
import type { SpatialHostCapabilities } from '../packages/reactvision/src/SpatialHostCapabilities'
import type { SpatialHostProbe } from '../packages/reactvision/src/SpatialHostProbe'
import { selectRendererBackend } from '../src/rendering/backend'

interface FakeHost {
  readonly isHeadMounted?: boolean
  readonly hasPassthroughLayer?: boolean
  readonly hasWebSocket?: boolean
  readonly arSupported?: boolean
  readonly geospatialSupported?: boolean
  readonly colocation?: boolean
  readonly deviceLocation?: boolean
  readonly graphite?: boolean
}

interface RecordingProbe extends SpatialHostProbe {
  readonly calls: string[]
}

function fakeProbe(host: FakeHost = {}): RecordingProbe {
  const calls: string[] = []
  return {
    calls,
    isHeadMounted: host.isHeadMounted ?? false,
    hasPassthroughLayer: host.hasPassthroughLayer ?? false,
    hasWebSocket: host.hasWebSocket ?? false,
    async isARSupported() {
      calls.push('isARSupported')
      return host.arSupported ?? false
    },
    async isGeospatialModeSupported() {
      calls.push('isGeospatialModeSupported')
      return { supported: host.geospatialSupported ?? false }
    },
    async isColocationAvailable() {
      calls.push('isColocationAvailable')
      return host.colocation ?? false
    },
    async hasDeviceLocation() {
      calls.push('hasDeviceLocation')
      return host.deviceLocation ?? false
    },
    isGraphiteAvailable() {
      calls.push('isGraphiteAvailable')
      return host.graphite ?? false
    },
  }
}

const NOTHING: SpatialHostCapabilities = {
  isImmersive: false,
  supportsGeospatialAnchors: false,
  supportsVps: false,
  supportsColocation: false,
  supportsGaze: false,
  isGraphiteAvailable: false,
  hasDeviceLocation: false,
  supportsPassthrough: false,
  supportsReplicatedState: false,
}

test('a host that answers no to everything reports nothing available', async () => {
  assert.deepEqual(await getSpatialHostCapabilities(fakeProbe()), NOTHING)
})

test('each probe answer turns on exactly its capability', async () => {
  assert.deepEqual(
    await getSpatialHostCapabilities(fakeProbe({ colocation: true })),
    { ...NOTHING, supportsColocation: true },
  )
  assert.deepEqual(
    await getSpatialHostCapabilities(fakeProbe({ graphite: true })),
    { ...NOTHING, isGraphiteAvailable: true },
  )
  assert.deepEqual(
    await getSpatialHostCapabilities(fakeProbe({ hasWebSocket: true })),
    { ...NOTHING, supportsReplicatedState: true },
  )
  assert.deepEqual(
    await getSpatialHostCapabilities(fakeProbe({ isHeadMounted: true })),
    { ...NOTHING, isImmersive: true, supportsGaze: true },
  )
})

test('passthrough comes from a headset layer or a camera AR session', async () => {
  const layer = await getSpatialHostCapabilities(
    fakeProbe({ hasPassthroughLayer: true }),
  )
  const camera = await getSpatialHostCapabilities(
    fakeProbe({ arSupported: true }),
  )

  assert.equal(layer.supportsPassthrough, true)
  assert.equal(camera.supportsPassthrough, true)
})

test('geospatial anchors and VPS need both the geospatial mode and device location', async () => {
  const both = await getSpatialHostCapabilities(
    fakeProbe({ deviceLocation: true, geospatialSupported: true }),
  )
  assert.equal(both.hasDeviceLocation, true)
  assert.equal(both.supportsGeospatialAnchors, true)
  assert.equal(both.supportsVps, true)

  const noMode = await getSpatialHostCapabilities(
    fakeProbe({ deviceLocation: true, geospatialSupported: false }),
  )
  assert.equal(noMode.hasDeviceLocation, true)
  assert.equal(noMode.supportsGeospatialAnchors, false)
  assert.equal(noMode.supportsVps, false)
})

test('a host without device location never sends the geospatial query', async () => {
  // A headset with no GPS whose AR stack would still claim geospatial mode.
  const probe = fakeProbe({
    isHeadMounted: true,
    hasPassthroughLayer: true,
    deviceLocation: false,
    geospatialSupported: true,
  })

  const host = await getSpatialHostCapabilities(probe)

  assert.equal(host.hasDeviceLocation, false)
  assert.equal(host.supportsGeospatialAnchors, false)
  assert.equal(host.supportsVps, false)
  assert.equal(probe.calls.includes('isGeospatialModeSupported'), false)
})

test('a failing probe query rejects with its name and keeps the cause', async () => {
  const cause = new Error('ReactVisionCCA is not linked')
  const probe: SpatialHostProbe = {
    ...fakeProbe(),
    isColocationAvailable: () => Promise.reject(cause),
  }

  await assert.rejects(getSpatialHostCapabilities(probe), (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.match(error.message, /SpatialHostProbe\.isColocationAvailable\(\)/)
    assert.match(error.message, /ReactVisionCCA is not linked/)
    assert.equal(error.cause, cause)
    return true
  })
})

test('a synchronous throw from the Graphite probe also rejects by name', async () => {
  const probe: SpatialHostProbe = {
    ...fakeProbe(),
    isGraphiteAvailable: () => {
      throw new Error('Skia Graphite is unavailable')
    },
  }

  await assert.rejects(
    getSpatialHostCapabilities(probe),
    /SpatialHostProbe\.isGraphiteAvailable\(\) failed: Skia Graphite is unavailable/,
  )
})

test('renderer selection follows the host Graphite answer', async () => {
  const select = (host: SpatialHostCapabilities) =>
    selectRendererBackend('auto', {
      graphite: host.isGraphiteAvailable,
      webgpu: true,
      sharedDawnDevice: host.isGraphiteAvailable,
      nitro: true,
    })

  const withGraphite = await getSpatialHostCapabilities(
    fakeProbe({ graphite: true }),
  )
  // A headset whose Skia build has no Graphite, as on visionOS today.
  const withoutGraphite = await getSpatialHostCapabilities(
    fakeProbe({ isHeadMounted: true, graphite: false }),
  )

  assert.equal(select(withGraphite), 'graphite-webgpu')
  assert.equal(select(withoutGraphite), 'webgpu')
  assert.throws(
    () =>
      selectRendererBackend('graphite', {
        graphite: withoutGraphite.isGraphiteAvailable,
        webgpu: true,
        sharedDawnDevice: withoutGraphite.isGraphiteAvailable,
        nitro: true,
      }),
    /Renderer "graphite" is unavailable/,
  )
})

test('co-location stays inside one frame family', () => {
  const peer = (platform: string) => ({ peerId: platform, platform })

  assert.equal(canShareColocationFrame(peer('ios'), peer('android')), true)
  assert.equal(canShareColocationFrame(peer('quest'), peer('quest')), true)
  assert.equal(canShareColocationFrame(peer('visionos'), peer('visionos')), true)
  assert.equal(canShareColocationFrame(peer('quest'), peer('ios')), false)
  assert.equal(canShareColocationFrame(peer('visionos'), peer('quest')), false)
  assert.equal(canShareColocationFrame(peer('web'), peer('web')), false)
  assert.equal(canShareColocationFrame(peer('ios'), peer('web')), false)
})

test('a platform the adapter does not know aligns only with itself', () => {
  const pico = { peerId: 'p', platform: 'pico' }

  assert.equal(canShareColocationFrame(pico, { peerId: 'q', platform: 'pico' }), true)
  assert.equal(canShareColocationFrame(pico, { peerId: 'q', platform: 'quest' }), false)
  assert.equal(canShareColocationFrame(pico, { peerId: 'q', platform: 'android' }), false)
})

test('an empty peer platform is rejected', () => {
  assert.throws(
    () =>
      canShareColocationFrame(
        { peerId: 'a', platform: '' },
        { peerId: 'b', platform: 'ios' },
      ),
    TypeError,
  )
})

test('context snapshot drops gaze and peers the host cannot produce', () => {
  const input = {
    visibleAnchorIds: ['a'],
    peerCount: 2,
    gaze: {
      origin: [0, 0, 0] as [number, number, number],
      direction: [0, 0, -1] as [number, number, number],
    },
  }

  const handheld = createSpatialContextSnapshot(NOTHING, input)
  assert.equal(handheld.gaze, undefined)
  assert.equal(handheld.peerCount, undefined)
  assert.deepEqual(handheld.visibleAnchorIds, ['a'])

  const headset = createSpatialContextSnapshot(
    { ...NOTHING, supportsGaze: true, supportsColocation: true },
    input,
  )
  assert.deepEqual(headset.gaze, input.gaze)
  assert.equal(headset.peerCount, 2)
})
