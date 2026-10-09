import { getGraphiteWebGPUContext } from '../../rendering/graphite'
import {
  getTerrainGridLayout,
  tileMetersPerPixel,
  tileSampleSpacingMeters,
  type TerrainGridLayout,
} from './grid'
import type { GpuSatelliteTile } from './imagery'
import { TERRAIN_SHADER } from './shader'
import type { GpuTerrainTile } from './tile'

/**
 * A 4x4 matrix as 16 finite numbers in column-major order, the layout WGSL
 * `mat4x4<f32>` uses. Used by {@linkcode TerrainTileFrameOptions.mvp}.
 */
export type Matrix4 = Float32Array | readonly number[]
/**
 * Three-component vector. Used by
 * {@linkcode TerrainTileFrameOptions.lightDirection}.
 */
export type Vec3 = readonly [number, number, number]
/**
 * Four-component vector, RGBA in 0 to 1 when used as a color. Used by
 * {@linkcode TerrainTileFrameOptions.baseColor}.
 */
export type Vec4 = readonly [number, number, number, number]

/**
 * Pipeline formats and imagery for {@linkcode createTerrainTileRenderer}.
 */
export interface TerrainTileRendererOptions {
  /**
   * Color format of the pass this renderer draws into. Must match the color
   * attachment.
   * @default 'rgba8unorm'
   */
  readonly format?: GPUTextureFormat
  /**
   * Depth format of the pass this renderer draws into. Must match the depth
   * attachment.
   * @default 'depth24plus'
   */
  readonly depthFormat?: GPUTextureFormat
  /**
   * Optional satellite imagery decoded on the shared Graphite device.
   * The renderer borrows this texture; the caller owns its lifetime.
   */
  readonly imagery?: Pick<GpuSatelliteTile, 'texture'>
}

/**
 * Per-draw settings for {@linkcode TerrainTileRenderer.draw}. Validated on
 * every draw; invalid values throw `RangeError`.
 */
export interface TerrainTileFrameOptions {
  /**
   * Column-major model-view-projection matrix applied to vertices in
   * tile-local space: metres, origin at the tile center, +x east, +y up, +z
 * south. Must hold 16 finite values.
   */
  readonly mvp: Matrix4
  /**
   * Sample step between drawn vertices. 1 draws every height sample; 2 draws
   * every second one, and so on. Must be a positive safe integer.
   * @default 1
   */
  readonly lodStride?: number
  /**
   * Multiplier on elevations before drawing. Horizontal spacing stays in real
   * metres, so values above 1 exaggerate relief.
   * @default 1
   */
  readonly heightScale?: number
  /**
   * Direction toward the light in tile-local space. Normalized before use;
   * must not be the zero vector.
   * @default [0.35, 0.85, 0.4]
   */
  readonly lightDirection?: Vec3
  /**
   * Ambient light share, clamped to 0 to 1 in the shader. The rest of the
   * shading is Lambertian from `lightDirection`.
   * @default 0.28
   */
  readonly ambient?: number
  /**
   * RGBA albedo. Imagery is multiplied by its RGB; its alpha sets output
   * alpha. Defaults to white with imagery and to green
   * `[0.26, 0.58, 0.31, 1]` without.
   */
  readonly baseColor?: Vec4
  /**
   * Multiplier on output alpha, clamped to 0 to 1.
   * @default 1
   */
  readonly opacity?: number
  /**
   * Blend from `baseColor` (0) to imagery times `baseColor` (1), clamped to
   * 0 to 1. Defaults to 1 with imagery and 0 without.
   */
  readonly imageryOpacity?: number
  /**
   * Height in metres of the vertical skirt drawn down from each tile edge to
   * hide cracks between tiles at different strides. 0 draws no skirt. Must be
   * 0 or greater. Not multiplied by `heightScale`.
   * @default 0
   */
  readonly skirtDepth?: number
  /**
   * Overrides the tile's natural local sample spacing.
   *
   * Multi-tile batching uses this so every same-zoom tile shares one local
   * tangent-plane span and therefore meets its neighbors exactly.
   */
  readonly sampleSpacingMeters?: number
}

/**
 * Draws one decoded terrain tile into a render pass the caller owns. Created
 * by {@linkcode createTerrainTileRenderer}.
 *
 * The renderer owns two small uniform buffers and, when no imagery was given,
 * a 1x1 white fallback texture. It borrows the height buffer and imagery
 * texture. Call {@linkcode TerrainTileRenderer.dispose} before disposing the
 * terrain tile or imagery it draws.
 */
export interface TerrainTileRenderer {
  /** Terrain tile this renderer reads. Borrowed, not owned. */
  readonly terrain: Pick<
    GpuTerrainTile,
    'tile' | 'heights' | 'width' | 'height'
  >
  /** Color format of the cached pipeline. */
  readonly format: GPUTextureFormat
  /** Depth format of the cached pipeline. */
  readonly depthFormat: GPUTextureFormat
  /**
   * Ground metres per decoded texel at the tile's center latitude, from the
   * tile's real width in texels.
   */
  readonly metersPerPixel: number
  /**
   * Default distance in metres between neighboring height samples, chosen so
   * the first and last samples land on the tile edges. Overridden per draw by
   * {@linkcode TerrainTileFrameOptions.sampleSpacingMeters}.
   */
  readonly sampleSpacingMeters: number
  /**
   * Writes this frame's uniforms and records one draw call into `pass`. The
   * caller begins, ends, and submits the pass.
   *
   * @returns The grid layout drawn at the requested stride.
   * @throws {RangeError} When an option is not finite, `lodStride` is not a
   * positive integer, `skirtDepth` is negative, or `mvp` does not hold 16
   * values.
   * @throws {Error} When the renderer has been disposed.
   */
  draw(
    pass: GPURenderPassEncoder,
    options: TerrainTileFrameOptions,
  ): TerrainGridLayout
  /**
   * Destroys the uniform buffers and the fallback imagery texture. Safe to
   * call more than once.
   */
  dispose(): void
}

const pipelineCache = new WeakMap<
  object,
  Map<string, GPURenderPipeline>
>()

function assertFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`)
  }
  return value
}

function assertFinitePositive(value: number, label: string): number {
  assertFinite(value, label)
  if (value <= 0) {
    throw new RangeError(`${label} must be > 0`)
  }
  return value
}

function normalizeDirection(direction: Vec3): Vec3 {
  const [x, y, z] = direction
  assertFinite(x, 'lightDirection[0]')
  assertFinite(y, 'lightDirection[1]')
  assertFinite(z, 'lightDirection[2]')

  const length = Math.hypot(x, y, z)
  if (length === 0) {
    throw new RangeError('lightDirection must not be the zero vector')
  }

  return [x / length, y / length, z / length]
}

function validateMatrix(matrix: Matrix4): Float32Array {
  if (matrix.length !== 16) {
    throw new RangeError('mvp must contain exactly 16 values')
  }

  const result = Float32Array.from(matrix)
  for (let index = 0; index < result.length; index += 1) {
    if (!Number.isFinite(result[index])) {
      throw new RangeError(`mvp[${index}] must be finite`)
    }
  }
  return result
}

function getPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  depthFormat: GPUTextureFormat,
): GPURenderPipeline {
  let deviceCache = pipelineCache.get(device as object)
  if (!deviceCache) {
    deviceCache = new Map()
    pipelineCache.set(device as object, deviceCache)
  }

  const key = `${format}|${depthFormat}`
  const existing = deviceCache.get(key)
  if (existing) {
    return existing
  }

  const shader = device.createShaderModule({
    label: 'Nitro Mapbox AR shared terrain shader',
    code: TERRAIN_SHADER,
  })

  const pipeline = device.createRenderPipeline({
    label: 'Nitro Mapbox AR shared terrain pipeline',
    layout: 'auto',
    vertex: {
      module: shader,
      entryPoint: 'vsMain',
    },
    fragment: {
      module: shader,
      entryPoint: 'fsMain',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
      // Terrain skirts intentionally render both sides.
      cullMode: 'none',
    },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
  })

  deviceCache.set(key, pipeline)
  return pipeline
}

/**
 * Creates the per-tile GPU resources needed to draw one decoded terrain tile.
 *
 * It allocates no color/depth target. Callers may therefore draw many tiles
 * into one shared render pass and submit one command buffer.
 */
export function createTerrainTileRenderer(
  terrain: Pick<GpuTerrainTile, 'tile' | 'heights' | 'width' | 'height'>,
  options: TerrainTileRendererOptions = {},
): TerrainTileRenderer {
  if (
    terrain.width !== terrain.heights.width ||
    terrain.height !== terrain.heights.height
  ) {
    throw new Error('terrain texture dimensions do not match the height field')
  }

  if (terrain.width < 2 || terrain.height < 2) {
    throw new RangeError('terrain width and height must both be at least 2')
  }

  const { device } = getGraphiteWebGPUContext()
  const format = options.format ?? 'rgba8unorm'
  const depthFormat = options.depthFormat ?? 'depth24plus'
  const pipeline = getPipeline(device, format, depthFormat)

  const frameBuffer = device.createBuffer({
    label: 'Nitro Mapbox AR terrain frame uniforms',
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const gridBuffer = device.createBuffer({
    label: 'Nitro Mapbox AR terrain grid uniforms',
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const fallbackImageryTexture = options.imagery
    ? undefined
    : device.createTexture({
        label: 'Nitro Mapbox AR fallback imagery',
        size: { width: 1, height: 1, depthOrArrayLayers: 1 },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      })

  if (fallbackImageryTexture) {
    device.queue.writeTexture(
      { texture: fallbackImageryTexture },
      new Uint8Array([255, 255, 255, 255]),
      {},
      { width: 1, height: 1, depthOrArrayLayers: 1 },
    )
  }

  const imageryTexture = options.imagery?.texture ?? fallbackImageryTexture
  if (!imageryTexture) {
    throw new Error('terrain imagery texture is unavailable')
  }

  const imagerySampler = device.createSampler({
    label: 'Nitro Mapbox AR terrain imagery sampler',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
    magFilter: 'linear',
    minFilter: 'linear',
    mipmapFilter: 'linear',
  })

  const bindGroup = device.createBindGroup({
    label: 'Nitro Mapbox AR terrain bind group',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: terrain.heights.buffer },
      },
      {
        binding: 1,
        resource: { buffer: frameBuffer },
      },
      {
        binding: 2,
        resource: { buffer: gridBuffer },
      },
      {
        binding: 3,
        resource: imageryTexture.createView(),
      },
      {
        binding: 4,
        resource: imagerySampler,
      },
    ],
  })

  const metersPerPixel = tileMetersPerPixel(terrain.tile, terrain.width)
  const defaultSampleSpacingMeters = tileSampleSpacingMeters(
    terrain.tile,
    terrain.width,
  )
  let disposed = false

  return {
    terrain,
    format,
    depthFormat,
    metersPerPixel,
    sampleSpacingMeters: defaultSampleSpacingMeters,

    draw(pass, frameOptions) {
      if (disposed) {
        throw new Error('TerrainTileRenderer has been disposed')
      }

      const layout = getTerrainGridLayout(
        terrain.width,
        terrain.height,
        frameOptions.lodStride ?? 1,
      )
      const mvp = validateMatrix(frameOptions.mvp)
      const heightScale = assertFinite(
        frameOptions.heightScale ?? 1,
        'heightScale',
      )
      const light = normalizeDirection(
        frameOptions.lightDirection ?? [0.35, 0.85, 0.4],
      )
      const ambient = assertFinite(frameOptions.ambient ?? 0.28, 'ambient')
      const baseColor =
        frameOptions.baseColor ??
        (options.imagery ? [1, 1, 1, 1] : [0.26, 0.58, 0.31, 1])
      const opacity = assertFinite(frameOptions.opacity ?? 1, 'opacity')
      const imageryOpacity = assertFinite(
        frameOptions.imageryOpacity ?? (options.imagery ? 1 : 0),
        'imageryOpacity',
      )
      const skirtDepth = assertFinite(
        frameOptions.skirtDepth ?? 0,
        'skirtDepth',
      )
      if (skirtDepth < 0) {
        throw new RangeError('skirtDepth must be >= 0')
      }

      const sampleSpacingMeters = assertFinitePositive(
        frameOptions.sampleSpacingMeters ?? defaultSampleSpacingMeters,
        'sampleSpacingMeters',
      )

      for (let index = 0; index < baseColor.length; index += 1) {
        assertFinite(baseColor[index], `baseColor[${index}]`)
      }

      const frame = new Float32Array(32)
      frame.set(mvp, 0)
      frame.set([light[0], light[1], light[2], ambient], 16)
      frame.set(baseColor, 20)
      frame.set(
        [sampleSpacingMeters, heightScale, opacity, imageryOpacity],
        24,
      )
      frame.set([skirtDepth, 0, 0, 0], 28)

      const grid = new Uint32Array([
        terrain.width,
        terrain.height,
        layout.stride,
        layout.cellColumns,
      ])

      device.queue.writeBuffer(frameBuffer, 0, frame)
      device.queue.writeBuffer(gridBuffer, 0, grid)

      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw(
        layout.vertexCount +
          (skirtDepth > 0 ? layout.skirtVertexCount : 0),
      )

      return layout
    },

    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      frameBuffer.destroy()
      gridBuffer.destroy()
      fallbackImageryTexture?.destroy()
    },
  }
}
