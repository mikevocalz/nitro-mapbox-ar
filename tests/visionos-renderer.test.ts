import assert from 'node:assert/strict'
import Module from 'node:module'
import test from 'node:test'

import { getSpatialHostCapabilities } from '../packages/reactvision/src/getSpatialHostCapabilities'
import type { SpatialHostProbe } from '../packages/reactvision/src/SpatialHostProbe'
import { selectRendererBackend } from '../src/rendering/backend'

// What @shopify/react-native-skia 2.14.0 throws at import when its native
// module is not linked (src/skia/NativeSetup.ts). Its podspec declares iOS,
// tvOS and macOS only, so a visionOS build never links it.
const SKIA_NATIVE_MISSING =
  'Native RNSkia Module cannot be found! Make sure you correctly installed native dependencies and rebuilt your app.'

type Load = (request: string, parent: unknown, isMain: boolean) => unknown
const loader = Module as unknown as { _load: Load }

async function withSkiaUnlinked<T>(
  run: (requested: string[]) => Promise<T>,
): Promise<T> {
  const original = loader._load
  const requested: string[] = []
  loader._load = function (request, parent, isMain) {
    if (request === '@shopify/react-native-skia' || request === 'react-native-webgpu') {
      requested.push(request)
    }
    if (request === '@shopify/react-native-skia') {
      throw new Error(SKIA_NATIVE_MISSING)
    }
    return original.call(this, request, parent, isMain)
  }
  try {
    return await run(requested)
  } finally {
    loader._load = original
  }
}

test('the Graphite probe reports false instead of failing the import when Skia is unlinked', async () => {
  await withSkiaUnlinked(async (requested) => {
    const graphite = await import('../src/rendering/graphite')
    assert.deepEqual(requested, [], 'importing the module must not load Skia or WebGPU')

    assert.equal(graphite.isGraphiteWebGPUAvailable(), false)
    assert.throws(
      () => graphite.getGraphiteWebGPUContext(),
      /Skia Graphite is unavailable[\s\S]*Native RNSkia Module cannot be found/,
    )
    assert.ok(
      !requested.includes('react-native-webgpu'),
      'WebGPU is not needed when there is no Graphite device to import',
    )
  })
})

function visionOSLikeProbe(isGraphiteAvailable: () => boolean): SpatialHostProbe {
  return {
    isHeadMounted: true,
    hasPassthroughLayer: false,
    hasWebSocket: true,
    isARSupported: async () => false,
    isGeospatialModeSupported: async () => ({ supported: false }),
    isColocationAvailable: async () => true,
    hasDeviceLocation: async () => false,
    isGraphiteAvailable,
  }
}

test('visionOS-like capabilities resolve the auto backend to webgpu', async () => {
  await withSkiaUnlinked(async () => {
    const { isGraphiteWebGPUAvailable } = await import('../src/rendering/graphite')
    const host = await getSpatialHostCapabilities(
      visionOSLikeProbe(isGraphiteWebGPUAvailable),
    )

    assert.equal(host.isImmersive, true)
    assert.equal(host.isGraphiteAvailable, false)

    // react-native-webgpu 0.13.0's podspec declares visionos 1.0.
    const capabilities = {
      graphite: host.isGraphiteAvailable,
      webgpu: true,
      sharedDawnDevice: host.isGraphiteAvailable,
      nitro: true,
    }
    assert.equal(selectRendererBackend('auto', capabilities), 'webgpu')
    assert.throws(
      () => selectRendererBackend('graphite', capabilities),
      /Renderer "graphite" is unavailable/,
    )
  })
})
