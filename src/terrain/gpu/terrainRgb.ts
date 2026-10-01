import tgpu, { d, std, type TgpuRoot } from 'typegpu'

import { getTerrainGpuRoot } from './root'

const TerrainParams = d.struct({
  width: d.u32,
  heightModifier: d.f32,
})

const terrainRgbLayout = tgpu.bindGroupLayout({
  source: {
    texture: d.texture2d(d.f32),
    sampleType: 'unfilterable-float',
  },
  heights: {
    storage: d.arrayOf(d.f32),
    access: 'mutable',
  },
  params: {
    uniform: TerrainParams,
  },
})

const pipelines = new WeakMap<object, ReturnType<TgpuRoot['createGuardedComputePipeline']>>()

function getTerrainRgbPipeline(root: TgpuRoot) {
  let pipeline = pipelines.get(root as object)
  if (pipeline) {
    return pipeline
  }

  pipeline = root.createGuardedComputePipeline((x, y) => {
    'use gpu'

    const rgba = std.textureLoad(
      terrainRgbLayout.$.source,
      d.vec2i(d.i32(x), d.i32(y)),
      0,
    )

    // rgba8unorm is exposed to WGSL as normalized floats. Reconstruct the
    // original 8-bit channel values before applying Mapbox's Terrain-RGB
    // elevation formula.
    const r = std.floor(rgba.x * 255 + 0.5)
    const g = std.floor(rgba.y * 255 + 0.5)
    const b = std.floor(rgba.z * 255 + 0.5)

    const encoded = r * 65536 + g * 256 + b
    const elevation =
      (-10000 + encoded * 0.1) * terrainRgbLayout.$.params.heightModifier

    const index = y * terrainRgbLayout.$.params.width + x
    terrainRgbLayout.$.heights[index] = elevation
  })

  pipelines.set(root as object, pipeline)
  return pipeline
}

function assertDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
}

export interface TerrainRgbDecodeOptions {
  /**
   * Source texture containing Mapbox Terrain-RGB pixels.
   *
   * The current compute path expects an rgba8unorm-compatible 2D texture
   * created on the shared Graphite WebGPU device.
   */
  source: GPUTexture
  width: number
  height: number
  heightModifier?: number
}

export interface GpuHeightField {
  readonly width: number
  readonly height: number
  readonly count: number
  readonly buffer: GPUBuffer
  dispose(): void
}

/**
 * Decodes Terrain-RGB entirely on the shared Graphite WebGPU device.
 *
 * The returned GPUBuffer contains one tightly packed Float32 elevation in
 * meters per source texel. No readback is performed.
 */
export function decodeTerrainRgbOnGpu(
  options: TerrainRgbDecodeOptions,
): GpuHeightField {
  const { source, width, height } = options
  const heightModifier = options.heightModifier ?? 1

  assertDimension(width, 'width')
  assertDimension(height, 'height')

  if (!Number.isFinite(heightModifier)) {
    throw new RangeError('heightModifier must be finite')
  }

  const count = width * height
  if (!Number.isSafeInteger(count)) {
    throw new RangeError('terrain dimensions are too large')
  }

  const root = getTerrainGpuRoot()
  const heights = root
    .createBuffer(d.arrayOf(d.f32, count))
    .$usage('storage')

  const params = root
    .createBuffer(TerrainParams, {
      width,
      heightModifier,
    })
    .$usage('uniform')

  const group = root.createBindGroup(terrainRgbLayout, {
    source: source.createView(),
    heights,
    params,
  })

  getTerrainRgbPipeline(root)
    .with(group)
    .dispatchThreads(width, height)

  const buffer = root.unwrap(heights)
  const paramsBuffer = root.unwrap(params)
  let disposed = false

  return {
    width,
    height,
    count,
    buffer,
    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      buffer.destroy()
      paramsBuffer.destroy()
    },
  }
}
