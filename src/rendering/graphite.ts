import type * as SkiaPackage from '@shopify/react-native-skia'
import type * as WebGPUPackage from 'react-native-webgpu'

/**
 * The WebGPU device imported from Skia Graphite's native Dawn device, shared
 * by Skia and `react-native-webgpu`.
 *
 * @see {@linkcode GraphiteWebGPUContext.device}
 */
export type SharedGraphiteDevice = ReturnType<typeof WebGPUPackage.importDevice>
/**
 * A WebGPU texture adopted from a native Skia texture, living on the shared
 * Graphite device.
 *
 * @see {@linkcode DecodedGraphiteTexture.texture}
 */
export type AdoptedWebGPUTexture = ReturnType<typeof WebGPUPackage.adoptTexture>

// Both packages are optional peers and load on first use, not at import.
// Skia's entry installs its JSI bindings at module scope and throws "Native
// RNSkia Module cannot be found!" when the native module is not linked
// (node_modules/@shopify/react-native-skia/src/skia/NativeSetup.ts). Its
// 2.14.0 podspec declares only iOS, tvOS and macOS, so on visionOS a static
// import here would take the whole package down before
// isGraphiteWebGPUAvailable() could report false.
function loadSkia(): typeof SkiaPackage.Skia {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('@shopify/react-native-skia') as typeof SkiaPackage).Skia
}

function loadWebGPU(): typeof WebGPUPackage {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-webgpu') as typeof WebGPUPackage
}

/**
 * A WebGPU texture identified by its native pointer, as passed to
 * {@linkcode makeSkiaImageFromWebGPUTexture}.
 */
export interface NativeWebGPUTexture {
  /** Native `wgpu::Texture` pointer. `0n` is invalid. */
  readonly nativePointer: bigint
}

/**
 * The one Dawn device Skia Graphite and WebGPU share, returned by
 * {@linkcode getGraphiteWebGPUContext}.
 */
export interface GraphiteWebGPUContext {
  /** Native pointer to Skia Graphite's Dawn device. Never `0n`. */
  readonly nativeDevice: bigint
  /** WebGPU device wrapping {@linkcode GraphiteWebGPUContext.nativeDevice}. */
  readonly device: SharedGraphiteDevice
}

/**
 * A decoded raster uploaded as a texture on the shared Graphite device,
 * returned by {@linkcode makeWebGPUTextureFromEncodedBytes}. The caller owns
 * the texture and must call {@linkcode DecodedGraphiteTexture.dispose} when
 * done.
 */
export interface DecodedGraphiteTexture {
  /** The GPU texture holding the decoded pixels. */
  readonly texture: AdoptedWebGPUTexture
  /** Image width in pixels. */
  readonly width: number
  /** Image height in pixels. */
  readonly height: number
  /** Destroys the texture. Safe to call more than once. */
  dispose(): void
}

let sharedContext: GraphiteWebGPUContext | undefined

function getNativeGraphiteDevice(): bigint {
  let pointer: bigint

  try {
    pointer = loadSkia().getNativeDevice()
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
 * Returns the WebGPU device shared with Skia Graphite, importing Skia's
 * native Dawn device on the first call and caching it for the process
 * lifetime. Use this device, not one from `navigator.gpu.requestDevice()`, for
 * resources that need zero-copy Skia interop.
 *
 * Native only: requires an m154 Graphite build of
 * `@shopify/react-native-skia` and `react-native-webgpu`. The browser
 * entrypoint does not export this function.
 *
 * @throws {Error} When Skia Graphite is not installed or returns an invalid
 * native device.
 * @platform ios, android. Not on visionOS or web.
 * @see {@linkcode isGraphiteWebGPUAvailable}
 */
export function getGraphiteWebGPUContext(): GraphiteWebGPUContext {
  if (sharedContext) {
    return sharedContext
  }

  const nativeDevice = getNativeGraphiteDevice()
  const device = loadWebGPU().importDevice(nativeDevice)

  sharedContext = {
    nativeDevice,
    device,
  }

  return sharedContext
}

/**
 * Reports whether {@linkcode getGraphiteWebGPUContext} succeeds. A `true`
 * result leaves the shared context created and cached.
 *
 * Returns `false` where Skia Graphite is not linked, for example a Ganesh
 * Skia build or visionOS.
 *
 * @platform ios, android. Always `false` on visionOS.
 */
export function isGraphiteWebGPUAvailable(): boolean {
  try {
    getGraphiteWebGPUContext()
    return true
  } catch {
    return false
  }
}

/**
 * Wraps a texture on the shared Graphite device as a Skia image without
 * copying pixels. The texture keeps ownership of the pointer: keep it alive
 * while the image is in use, and dispose the image when the frame is replaced.
 *
 * @throws {Error} When `texture.nativePointer` is `0n`.
 * @see {@linkcode getGraphiteWebGPUContext}
 */
export function makeSkiaImageFromWebGPUTexture(texture: NativeWebGPUTexture) {
  if (texture.nativePointer === 0n) {
    throw new Error('Cannot wrap a WebGPU texture with an invalid native pointer')
  }

  return loadSkia().Image.MakeImageFromNativeTexture(texture.nativePointer)
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
  const Skia = loadSkia()
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
    const texture = loadWebGPU().adoptTexture(nativeTexture)
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
