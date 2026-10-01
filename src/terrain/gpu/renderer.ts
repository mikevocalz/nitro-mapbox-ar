import {
  getGraphiteWebGPUContext,
  type NativeWebGPUTexture,
} from '../../rendering/graphite'
import { assertTerrainLodStride, terrainGridSize } from '../lod'
import type { GpuTerrainTile } from './tile'

const IDENTITY_MATRIX = new Float32Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
])

const TERRAIN_SHADER = `
struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  model: mat4x4<f32>,
}

struct TerrainUniforms {
  sourceWidth: u32,
  sourceHeight: u32,
  stride: u32,
  _padding0: u32,

  worldWidth: f32,
  worldDepth: f32,
  heightScale: f32,
  ambient: f32,

  lightDirection: vec4f,
  baseColor: vec4f,
}

@group(0) @binding(0) var<storage, read> heights: array<f32>;
@group(0) @binding(1) var<uniform> camera: CameraUniforms;
@group(0) @binding(2) var<uniform> terrain: TerrainUniforms;

fn heightAt(x: u32, y: u32) -> f32 {
  let safeX = min(x, terrain.sourceWidth - 1u);
  let safeY = min(y, terrain.sourceHeight - 1u);
  return heights[safeY * terrain.sourceWidth + safeX] * terrain.heightScale;
}

fn sourceCoord(vertexIndex: u32) -> vec2u {
  let cellColumns =
    (terrain.sourceWidth - 1u + terrain.stride - 1u) / terrain.stride;
  let cellIndex = vertexIndex / 6u;
  let cornerIndex = vertexIndex % 6u;
  let cellX = cellIndex % cellColumns;
  let cellY = cellIndex / cellColumns;

  var corner = vec2u(0u, 0u);

  switch cornerIndex {
    case 0u: {
      corner = vec2u(0u, 0u);
    }
    case 1u: {
      corner = vec2u(1u, 0u);
    }
    case 2u: {
      corner = vec2u(0u, 1u);
    }
    case 3u: {
      corner = vec2u(0u, 1u);
    }
    case 4u: {
      corner = vec2u(1u, 0u);
    }
    default: {
      corner = vec2u(1u, 1u);
    }
  }

  return vec2u(
    min((cellX + corner.x) * terrain.stride, terrain.sourceWidth - 1u),
    min((cellY + corner.y) * terrain.stride, terrain.sourceHeight - 1u),
  );
}

fn terrainNormal(x: u32, y: u32) -> vec3f {
  var leftX = 0u;
  var upY = 0u;

  if (x >= terrain.stride) {
    leftX = x - terrain.stride;
  }

  if (y >= terrain.stride) {
    upY = y - terrain.stride;
  }

  let rightX = min(x + terrain.stride, terrain.sourceWidth - 1u);
  let downY = min(y + terrain.stride, terrain.sourceHeight - 1u);

  let hLeft = heightAt(leftX, y);
  let hRight = heightAt(rightX, y);
  let hUp = heightAt(x, upY);
  let hDown = heightAt(x, downY);

  let meterStepX = max(
    f32(rightX - leftX) * terrain.worldWidth /
      f32(terrain.sourceWidth - 1u),
    0.0001,
  );
  let meterStepZ = max(
    f32(downY - upY) * terrain.worldDepth /
      f32(terrain.sourceHeight - 1u),
    0.0001,
  );

  let gradientX = (hRight - hLeft) / meterStepX;
  let gradientZ = (hDown - hUp) / meterStepZ;

  return normalize(vec3f(-gradientX, 1.0, -gradientZ));
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) uv: vec2f,
}

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let coord = sourceCoord(vertexIndex);
  let uv = vec2f(
    f32(coord.x) / f32(terrain.sourceWidth - 1u),
    f32(coord.y) / f32(terrain.sourceHeight - 1u),
  );

  let localPosition = vec3f(
    (uv.x - 0.5) * terrain.worldWidth,
    heightAt(coord.x, coord.y),
    (uv.y - 0.5) * terrain.worldDepth,
  );

  let localNormal = terrainNormal(coord.x, coord.y);
  let worldPosition = camera.model * vec4f(localPosition, 1.0);
  let worldNormal = normalize((camera.model * vec4f(localNormal, 0.0)).xyz);

  var output: VertexOutput;
  output.position = camera.viewProjection * worldPosition;
  output.normal = worldNormal;
  output.uv = uv;
  return output;
}

@fragment
fn fsMain(input: VertexOutput) -> @location(0) vec4f {
  let lightDirection = normalize(-terrain.lightDirection.xyz);
  let diffuse = max(dot(normalize(input.normal), lightDirection), 0.0);
  let light = terrain.ambient + (1.0 - terrain.ambient) * diffuse;

  return vec4f(terrain.baseColor.rgb * light, terrain.baseColor.a);
}
`

export type SharedTerrainTexture = GPUTexture & NativeWebGPUTexture

export interface TerrainRenderTarget {
  readonly texture: SharedTerrainTexture
  readonly view: GPUTextureView
  readonly depthTexture?: GPUTexture
  readonly depthView?: GPUTextureView
  readonly width: number
  readonly height: number
  readonly colorFormat: GPUTextureFormat
  readonly depthFormat?: GPUTextureFormat
  dispose(): void
}

export interface TerrainRendererOptions {
  colorFormat?: GPUTextureFormat
  depthFormat?: GPUTextureFormat
}

export interface TerrainDrawOptions {
  viewProjection: Float32Array | readonly number[]
  model?: Float32Array | readonly number[]
  lodStride?: number
  worldWidth?: number
  worldDepth?: number
  heightScale?: number
  lightDirection?: readonly [number, number, number]
  ambient?: number
  baseColor?: readonly [number, number, number, number]
}

export interface TerrainRenderOptions extends TerrainDrawOptions {
  clearColor?: GPUColor
  depthClearValue?: number
}

export interface TerrainGpuRenderer {
  readonly tile: GpuTerrainTile
  readonly colorFormat: GPUTextureFormat
  readonly depthFormat?: GPUTextureFormat
  draw(pass: GPURenderPassEncoder, options: TerrainDrawOptions): void
  render(target: TerrainRenderTarget, options: TerrainRenderOptions): void
  dispose(): void
}

function assertFinitePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number`)
  }
}

function assertMatrix(
  value: Float32Array | readonly number[],
  label: string,
): void {
  if (value.length !== 16) {
    throw new RangeError(`${label} must contain 16 values`)
  }

  for (const entry of value) {
    if (!Number.isFinite(entry)) {
      throw new RangeError(`${label} must contain only finite values`)
    }
  }
}

function clamp01(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`)
  }
  return Math.min(1, Math.max(0, value))
}

function createPipeline(
  device: GPUDevice,
  colorFormat: GPUTextureFormat,
  depthFormat?: GPUTextureFormat,
): GPURenderPipeline {
  const module = device.createShaderModule({
    label: 'nitro-mapbox-ar terrain shader',
    code: TERRAIN_SHADER,
  })

  return device.createRenderPipeline({
    label: 'nitro-mapbox-ar direct terrain pipeline',
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vsMain',
    },
    fragment: {
      module,
      entryPoint: 'fsMain',
      targets: [{ format: colorFormat }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'none',
    },
    depthStencil: depthFormat
      ? {
          format: depthFormat,
          depthWriteEnabled: true,
          depthCompare: 'less',
        }
      : undefined,
  })
}

function writeCameraUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  options: TerrainDrawOptions,
): void {
  assertMatrix(options.viewProjection, 'viewProjection')
  const model = options.model ?? IDENTITY_MATRIX
  assertMatrix(model, 'model')

  const data = new Float32Array(32)
  data.set(options.viewProjection, 0)
  data.set(model, 16)
  device.queue.writeBuffer(buffer, 0, data)
}

function writeTerrainUniforms(
  device: GPUDevice,
  buffer: GPUBuffer,
  tile: GpuTerrainTile,
  options: TerrainDrawOptions,
): number {
  const stride = options.lodStride ?? 1
  const worldWidth = options.worldWidth ?? 1
  const worldDepth = options.worldDepth ?? 1
  const heightScale = options.heightScale ?? 1
  const ambient = clamp01(options.ambient ?? 0.28, 'ambient')
  const lightDirection = options.lightDirection ?? [0.35, -1, 0.2]
  const baseColor = options.baseColor ?? [0.72, 0.76, 0.7, 1]

  assertTerrainLodStride(stride)
  assertFinitePositive(worldWidth, 'worldWidth')
  assertFinitePositive(worldDepth, 'worldDepth')

  if (!Number.isFinite(heightScale)) {
    throw new RangeError('heightScale must be finite')
  }

  if (lightDirection.some((value) => !Number.isFinite(value))) {
    throw new RangeError('lightDirection must contain finite values')
  }

  if (baseColor.some((value) => !Number.isFinite(value))) {
    throw new RangeError('baseColor must contain finite values')
  }

  const raw = new ArrayBuffer(64)
  const u32 = new Uint32Array(raw)
  const f32 = new Float32Array(raw)

  u32[0] = tile.width
  u32[1] = tile.height
  u32[2] = stride

  f32[4] = worldWidth
  f32[5] = worldDepth
  f32[6] = heightScale
  f32[7] = ambient

  f32[8] = lightDirection[0]
  f32[9] = lightDirection[1]
  f32[10] = lightDirection[2]
  f32[11] = 0

  f32[12] = baseColor[0]
  f32[13] = baseColor[1]
  f32[14] = baseColor[2]
  f32[15] = baseColor[3]

  device.queue.writeBuffer(buffer, 0, raw)

  return terrainGridSize(tile.width, tile.height, stride).vertexCount
}

export function createTerrainRenderTarget(
  width: number,
  height: number,
  options: TerrainRendererOptions = {},
): TerrainRenderTarget {
  if (!Number.isSafeInteger(width) || width <= 0) {
    throw new RangeError('render target width must be a positive safe integer')
  }
  if (!Number.isSafeInteger(height) || height <= 0) {
    throw new RangeError('render target height must be a positive safe integer')
  }

  const { device } = getGraphiteWebGPUContext()
  const colorFormat = options.colorFormat ?? 'rgba8unorm'
  const depthFormat = options.depthFormat ?? 'depth24plus'

  const texture = device.createTexture({
    label: 'nitro-mapbox-ar terrain color target',
    size: [width, height, 1],
    format: colorFormat,
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC,
  }) as SharedTerrainTexture

  const depthTexture = depthFormat
    ? device.createTexture({
        label: 'nitro-mapbox-ar terrain depth target',
        size: [width, height, 1],
        format: depthFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
    : undefined

  const view = texture.createView()
  const depthView = depthTexture?.createView()
  let disposed = false

  return {
    texture,
    view,
    depthTexture,
    depthView,
    width,
    height,
    colorFormat,
    depthFormat,
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      depthTexture?.destroy()
      texture.destroy()
    },
  }
}

export function createTerrainGpuRenderer(
  tile: GpuTerrainTile,
  options: TerrainRendererOptions = {},
): TerrainGpuRenderer {
  if (tile.width < 2 || tile.height < 2) {
    throw new RangeError('terrain tiles must be at least 2x2')
  }

  const { device } = getGraphiteWebGPUContext()
  const colorFormat = options.colorFormat ?? 'rgba8unorm'
  const depthFormat = options.depthFormat ?? 'depth24plus'
  const pipeline = createPipeline(device, colorFormat, depthFormat)

  const cameraBuffer = device.createBuffer({
    label: 'nitro-mapbox-ar terrain camera uniforms',
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const terrainBuffer = device.createBuffer({
    label: 'nitro-mapbox-ar terrain draw uniforms',
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const bindGroup = device.createBindGroup({
    label: 'nitro-mapbox-ar terrain bind group',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: tile.heights.buffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: cameraBuffer,
        },
      },
      {
        binding: 2,
        resource: {
          buffer: terrainBuffer,
        },
      },
    ],
  })

  let disposed = false

  const assertAlive = () => {
    if (disposed) {
      throw new Error('terrain renderer has been disposed')
    }
  }

  const draw = (
    pass: GPURenderPassEncoder,
    drawOptions: TerrainDrawOptions,
  ): void => {
    assertAlive()
    writeCameraUniforms(device, cameraBuffer, drawOptions)
    const vertexCount = writeTerrainUniforms(
      device,
      terrainBuffer,
      tile,
      drawOptions,
    )

    pass.setPipeline(pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.draw(vertexCount)
  }

  return {
    tile,
    colorFormat,
    depthFormat,
    draw,
    render(target, renderOptions) {
      assertAlive()

      if (target.colorFormat !== colorFormat) {
        throw new Error(
          `render target color format ${target.colorFormat} does not match renderer ${colorFormat}`,
        )
      }

      if (target.depthFormat !== depthFormat) {
        throw new Error(
          `render target depth format ${String(target.depthFormat)} does not match renderer ${String(depthFormat)}`,
        )
      }

      const encoder = device.createCommandEncoder({
        label: 'nitro-mapbox-ar terrain command encoder',
      })

      const pass = encoder.beginRenderPass({
        label: 'nitro-mapbox-ar terrain render pass',
        colorAttachments: [
          {
            view: target.view,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: renderOptions.clearColor ?? {
              r: 0,
              g: 0,
              b: 0,
              a: 0,
            },
          },
        ],
        depthStencilAttachment:
          depthFormat && target.depthView
            ? {
                view: target.depthView,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                depthClearValue: renderOptions.depthClearValue ?? 1,
              }
            : undefined,
      })

      draw(pass, renderOptions)
      pass.end()

      device.queue.submit([encoder.finish()])
    },
    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      terrainBuffer.destroy()
      cameraBuffer.destroy()
    },
  }
}
