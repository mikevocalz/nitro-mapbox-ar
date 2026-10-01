import {
  getGraphiteWebGPUContext,
  makeSkiaImageFromWebGPUTexture,
} from '../../rendering/graphite'

export interface TerrainRenderTargetOptions {
  readonly width: number
  readonly height: number
  readonly format?: GPUTextureFormat
  readonly depthFormat?: GPUTextureFormat
}

export interface TerrainRenderTarget {
  readonly texture: GPUTexture
  readonly view: GPUTextureView
  readonly depthTexture: GPUTexture
  readonly depthView: GPUTextureView
  readonly width: number
  readonly height: number
  readonly format: GPUTextureFormat
  readonly depthFormat: GPUTextureFormat
  makeImage(): ReturnType<typeof makeSkiaImageFromWebGPUTexture>
  dispose(): void
}

function assertDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
}

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
