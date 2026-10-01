import { Skia } from '@shopify/react-native-skia'
import { adoptTexture, importDevice } from 'react-native-webgpu'

export type SharedGraphiteDevice = ReturnType<typeof importDevice>
export type AdoptedWebGPUTexture = ReturnType<typeof adoptTexture>

export interface NativeWebGPUTexture {
  readonly nativePointer: bigint
}

export interface GraphiteWebGPUContext {
  readonly nativeDevice: bigint
  readonly device: SharedGraphiteDevice
}

export interface DecodedGraphiteTexture {
  readonly texture: AdoptedWebGPUTexture
  readonly width: number
  readonly height: number
  dispose(): void
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

export function makeSkiaImageFromWebGPUTexture(texture: NativeWebGPUTexture) {
  if (texture.nativePointer === 0n) {
    throw new Error('Cannot wrap a WebGPU texture with an invalid native pointer')
  }

  return Skia.Image.MakeImageFromNativeTexture(texture.nativePointer)
}

/**
 * Decode an encoded raster (PNG/WebP/JPEG) with Skia, then expose the decoded
 * SkImage as a WebGPU texture on the same Graphite/Dawn device.
 *
 * The encoded bytes stay encoded across the JS/native boundary. Pixel
 * decompression happens in Skia and the resulting native image is uploaded to
 * Graphite without creating a JS-side RGBA array.
 */
export function makeWebGPUTextureFromEncodedBytes(
  bytes: ArrayBuffer | Uint8Array,
): DecodedGraphiteTexture {
  const sourceBytes =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const data = Skia.Data.fromBytes(sourceBytes)
  const image = Skia.Image.MakeImageFromEncoded(data)

  if (!image) {
    throw new Error('Skia could not decode the encoded tile image')
  }

  try {
    const width = image.width()
    const height = image.height()
    const nativeTexture = Skia.Image.MakeNativeTextureFromImage(image)
    const texture = adoptTexture(nativeTexture)
    let disposed = false

    return {
      texture,
      width,
      height,
      dispose() {
        if (disposed) {
          return
        }
        disposed = true
        texture.destroy()
      },
    }
  } finally {
    image.dispose()
  }
}
