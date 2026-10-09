import {
  getGraphiteWebGPUContext,
  makeSkiaImageFromWebGPUTexture,
} from '../../rendering/graphite'

/**
 * Size and formats for {@linkcode createTerrainRenderTarget}.
 */
export interface TerrainRenderTargetOptions {
  /** Target width in pixels. Must be a positive safe integer. */
  readonly width: number
  /** Target height in pixels. Must be a positive safe integer. */
  readonly height: number
  /**
   * Color texture format.
   * @default 'rgba8unorm'
   */
  readonly format?: GPUTextureFormat
  /**
   * Depth texture format.
   * @default 'depth24plus'
   */
  readonly depthFormat?: GPUTextureFormat
}

/**
 * A color and depth texture pair on the shared Graphite WebGPU device that
 * terrain passes draw into. Created by {@linkcode createTerrainRenderTarget}.
 *
 * Whoever creates the target owns it and must call
 * {@linkcode TerrainRenderTarget.dispose}. Keep it alive while any image from
 * {@linkcode TerrainRenderTarget.makeImage} is still drawn.
 */
export interface TerrainRenderTarget {
  /**
   * Color texture. Usage is `RENDER_ATTACHMENT | TEXTURE_BINDING | COPY_SRC`.
   */
  readonly texture: GPUTexture
  /** Default view of {@linkcode TerrainRenderTarget.texture}, used as the color attachment. */
  readonly view: GPUTextureView
  /** Depth texture. Usage is `RENDER_ATTACHMENT` only. */
  readonly depthTexture: GPUTexture
  /** Default view of {@linkcode TerrainRenderTarget.depthTexture}, used as the depth attachment. */
  readonly depthView: GPUTextureView
  /** Width in pixels. */
  readonly width: number
  /** Height in pixels. */
  readonly height: number
  /** Resolved color format. */
  readonly format: GPUTextureFormat
  /** Resolved depth format. */
  readonly depthFormat: GPUTextureFormat
  /**
   * Wraps the color texture as a Skia image without a CPU copy. Each call
   * returns a new image that the caller disposes.
   *
   * @throws {Error} When the target has been disposed.
   */
  makeImage(): ReturnType<typeof makeSkiaImageFromWebGPUTexture>
  /** Destroys both textures. Safe to call more than once. */
  dispose(): void
}

function assertDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
}

/**
 * Allocates a color and depth texture of the same size on the shared Graphite
 * WebGPU device.
 *
 * @returns A {@linkcode TerrainRenderTarget} the caller must dispose.
 * @throws {RangeError} When `width` or `height` is not a positive safe integer.
 * @throws {Error} When Skia Graphite is unavailable.
 */
export function createTerrainRenderTarget(
  options: TerrainRenderTargetOptions,
): TerrainRenderTarget {
  assertDimension(options.width, 'width')
  assertDimension(options.height, 'height')

  const { device } = getGraphiteWebGPUContext()
  const format = options.format ?? 'rgba8unorm'
  const depthFormat = options.depthFormat ?? 'depth24plus'

  const texture = device.createTexture({
    label: 'Nitro Mapbox AR shared terrain render target',
    size: {
      width: options.width,
      height: options.height,
      depthOrArrayLayers: 1,
    },
    format,
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC,
  })

  const depthTexture = device.createTexture({
    label: 'Nitro Mapbox AR shared terrain depth target',
    size: {
      width: options.width,
      height: options.height,
      depthOrArrayLayers: 1,
    },
    format: depthFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })

  const view = texture.createView()
  const depthView = depthTexture.createView()
  let disposed = false

  return {
    texture,
    view,
    depthTexture,
    depthView,
    width: options.width,
    height: options.height,
    format,
    depthFormat,
    makeImage() {
      if (disposed) {
        throw new Error('TerrainRenderTarget has been disposed')
      }
      return makeSkiaImageFromWebGPUTexture(texture)
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      depthTexture.destroy()
      texture.destroy()
    },
  }
}
