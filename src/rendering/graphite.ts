import { Skia } from '@shopify/react-native-skia'
import { importDevice } from 'react-native-webgpu'

export type SharedGraphiteDevice = ReturnType<typeof importDevice>

export interface NativeWebGPUTexture {
  readonly nativePointer: bigint
}

export interface GraphiteWebGPUContext {
  readonly nativeDevice: bigint
  readonly device: SharedGraphiteDevice
}

let sharedContext: GraphiteWebGPUContext | undefined

function getNativeGraphiteDevice(): bigint {
  let pointer: bigint

  try {
    pointer = Skia.getNativeDevice()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      'Skia Graphite is unavailable. Install an m154-compatible Graphite build ' +
        'of @shopify/react-native-skia before enabling the Graphite renderer. ' +
        `Native error: ${message}`,
    )
  }

  if (pointer === 0n) {
    throw new Error('Skia Graphite returned an invalid native WebGPU device')
  }

  return pointer
}

/**
 * Returns one process-lifetime WebGPU wrapper around Skia Graphite's own
 * wgpu::Device. The imported device takes its own native reference but the
 * underlying device is owned by Skia, so callers must not replace it with a
 * separately requested navigator.gpu device for zero-copy resources.
 */
export function getGraphiteWebGPUContext(): GraphiteWebGPUContext {
  if (sharedContext) {
    return sharedContext
  }

  const nativeDevice = getNativeGraphiteDevice()
  const device = importDevice(nativeDevice)

  sharedContext = {
    nativeDevice,
    device,
  }

  return sharedContext
}

export function isGraphiteWebGPUAvailable(): boolean {
  try {
    getGraphiteWebGPUContext()
    return true
  } catch {
    return false
  }
}

/**
 * Wraps a WebGPU texture created on the shared Graphite device as an SkImage.
 * This is a zero-copy operation. Keep the GPUTexture alive for at least as long
 * as the returned SkImage references it.
 */
export function makeSkiaImageFromWebGPUTexture(texture: NativeWebGPUTexture) {
  if (texture.nativePointer === 0n) {
    throw new Error('Cannot wrap a WebGPU texture with an invalid native pointer')
  }

  return Skia.Image.MakeImageFromNativeTexture(texture.nativePointer)
}
