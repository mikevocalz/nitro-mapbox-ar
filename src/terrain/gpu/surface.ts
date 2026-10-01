import { makeSkiaImageFromWebGPUTexture } from '../../rendering/graphite'
import { getGraphiteWebGPUContext } from '../../rendering/graphite'
import type { GpuTerrainTile } from './tile'
import {
  getTerrainGridLayout,
  tileMetersPerPixel,
  type TerrainGridLayout,
} from './grid'

const TERRAIN_SHADER = /* wgsl */ `
struct Frame {
  mvp: mat4x4<f32>,
  light: vec4<f32>,
  baseColor: vec4<f32>,
  params: vec4<f32>,
}

struct Grid {
  width: u32,
  height: u32,
  stride: u32,
  cellColumns: u32,
}

struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
}

@group(0) @binding(0) var<storage, read> heights: array<f32>;
@group(0) @binding(1) var<uniform> frame: Frame;
@group(0) @binding(2) var<uniform> grid: Grid;

fn terrainHeight(x: u32, y: u32) -> f32 {
  return heights[y * grid.width + x] * frame.params.y;
}

fn cornerForVertex(vertexInCell: u32) -> vec2<u32> {
  switch vertexInCell {
    case 0u: { return vec2<u32>(0u, 0u); }
    case 1u: { return vec2<u32>(1u, 0u); }
    case 2u: { return vec2<u32>(0u, 1u); }
    case 3u: { return vec2<u32>(0u, 1u); }
    case 4u: { return vec2<u32>(1u, 0u); }
    default: { return vec2<u32>(1u, 1u); }
  }
}

@vertex
fn vsMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  let cellIndex = vertexIndex / 6u;
  let vertexInCell = vertexIndex % 6u;
  let cellX = cellIndex % grid.cellColumns;
  let cellY = cellIndex / grid.cellColumns;
  let corner = cornerForVertex(vertexInCell);

  let x0 = cellX * grid.stride;
  let y0 = cellY * grid.stride;
  let x = min(x0 + corner.x * grid.stride, grid.width - 1u);
  let y = min(y0 + corner.y * grid.stride, grid.height - 1u);

  let leftX = select(0u, x - grid.stride, x >= grid.stride);
  let rightX = min(x + grid.stride, grid.width - 1u);
  let upY = select(0u, y - grid.stride, y >= grid.stride);
  let downY = min(y + grid.stride, grid.height - 1u);

  let h = terrainHeight(x, y);
  let hLeft = terrainHeight(leftX, y);
  let hRight = terrainHeight(rightX, y);
  let hUp = terrainHeight(x, upY);
  let hDown = terrainHeight(x, downY);

  let metersPerPixel = frame.params.x;
  let dx = max(f32(rightX - leftX) * metersPerPixel, 0.0001);
  let dz = max(f32(downY - upY) * metersPerPixel, 0.0001);

  let tangentX = vec3<f32>(dx, hRight - hLeft, 0.0);
  let tangentZ = vec3<f32>(0.0, hDown - hUp, dz);
  let normal = normalize(cross(tangentZ, tangentX));

  let spanX = f32(grid.width - 1u) * metersPerPixel;
  let spanZ = f32(grid.height - 1u) * metersPerPixel;
  let local = vec3<f32>(
    f32(x) * metersPerPixel - spanX * 0.5,
    h,
    f32(y) * metersPerPixel - spanZ * 0.5,
  );

  var out: VertexOut;
  out.position = frame.mvp * vec4<f32>(local, 1.0);
  out.normal = normal;
  return out;
}

@fragment
fn fsMain(input: VertexOut) -> @location(0) vec4<f32> {
  let lightDirection = normalize(frame.light.xyz);
  let lambert = max(dot(normalize(input.normal), lightDirection), 0.0);
  let ambient = clamp(frame.light.w, 0.0, 1.0);
  let shade = ambient + (1.0 - ambient) * lambert;

  return vec4<f32>(
    frame.baseColor.rgb * shade,
    frame.baseColor.a * clamp(frame.params.z, 0.0, 1.0),
  );
}
`

export type Matrix4 = Float32Array | readonly number[]
export type Vec3 = readonly [number, number, number]
export type Vec4 = readonly [number, number, number, number]

export interface TerrainSurfaceRendererOptions {
  readonly targetWidth: number
  readonly targetHeight: number
  readonly format?: GPUTextureFormat
  readonly depthFormat?: GPUTextureFormat
}

export interface TerrainFrameOptions {
  readonly mvp: Matrix4
  readonly lodStride?: number
  readonly heightScale?: number
  readonly lightDirection?: Vec3
  readonly ambient?: number
  readonly baseColor?: Vec4
  readonly opacity?: number
}

export interface RenderedTerrainFrame {
  readonly image: ReturnType<typeof makeSkiaImageFromWebGPUTexture>
  readonly layout: TerrainGridLayout
}

export interface TerrainSurfaceRenderer {
  readonly texture: GPUTexture
  readonly depthTexture: GPUTexture
  readonly format: GPUTextureFormat
  readonly metersPerPixel: number
  render(options: TerrainFrameOptions): RenderedTerrainFrame
  dispose(): void
}

function assertTargetDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
}

function assertFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`)
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

function createPipeline(
  device: GPUDevice,
  format: GPUTextureFormat,
  depthFormat: GPUTextureFormat,
): GPURenderPipeline {
  const shader = device.createShaderModule({
    label: 'Nitro Mapbox AR terrain surface shader',
    code: TERRAIN_SHADER,
  })

  return device.createRenderPipeline({
    label: 'Nitro Mapbox AR terrain surface pipeline',
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
      cullMode: 'back',
      frontFace: 'ccw',
    },
    depthStencil: {
      format: depthFormat,
      depthWriteEnabled: true,
      depthCompare: 'less',
    },
  })
}

/**
 * Creates a direct GPU terrain renderer for a decoded Terrain-RGB tile.
 *
 * The renderer owns only the render target/depth/uniform resources. It borrows
 * `terrain.heights.buffer`; keep the GpuTerrainTile alive until the renderer
 * and every SkImage returned by render() have been disposed.
 */
export function createTerrainSurfaceRenderer(
  terrain: Pick<GpuTerrainTile, 'tile' | 'heights' | 'width' | 'height'>,
  options: TerrainSurfaceRendererOptions,
): TerrainSurfaceRenderer {
  assertTargetDimension(options.targetWidth, 'targetWidth')
  assertTargetDimension(options.targetHeight, 'targetHeight')

  if (
    terrain.width !== terrain.heights.width ||
    terrain.height !== terrain.heights.height
  ) {
    throw new Error('terrain texture dimensions do not match the height field')
  }

  const { device } = getGraphiteWebGPUContext()
  const format = options.format ?? 'rgba8unorm'
  const depthFormat = options.depthFormat ?? 'depth24plus'
  const pipeline = createPipeline(device, format, depthFormat)

  const texture = device.createTexture({
    label: 'Nitro Mapbox AR terrain render target',
    size: {
      width: options.targetWidth,
      height: options.targetHeight,
      depthOrArrayLayers: 1,
    },
    format,
    usage:
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING |
      GPUTextureUsage.COPY_SRC,
  })

  const depthTexture = device.createTexture({
    label: 'Nitro Mapbox AR terrain depth target',
    size: {
      width: options.targetWidth,
      height: options.targetHeight,
      depthOrArrayLayers: 1,
    },
    format: depthFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  })

  // Frame = mat4 (64 bytes) + 3 vec4 values (48 bytes) = 112 bytes.
  const frameBuffer = device.createBuffer({
    label: 'Nitro Mapbox AR terrain frame uniforms',
    size: 112,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  // Grid = vec4<u32> = 16 bytes.
  const gridBuffer = device.createBuffer({
    label: 'Nitro Mapbox AR terrain grid uniforms',
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const bindGroup = device.createBindGroup({
    label: 'Nitro Mapbox AR terrain bind group',
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: terrain.heights.buffer,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: frameBuffer,
        },
      },
      {
        binding: 2,
        resource: {
          buffer: gridBuffer,
        },
      },
    ],
  })

  const metersPerPixel = tileMetersPerPixel(terrain.tile, terrain.width)
  let disposed = false

  return {
    texture,
    depthTexture,
    format,
    metersPerPixel,

    render(frameOptions) {
      if (disposed) {
        throw new Error('TerrainSurfaceRenderer has been disposed')
      }

      const layout = getTerrainGridLayout(
        terrain.width,
        terrain.height,
        frameOptions.lodStride ?? 1,
      )
      const mvp = validateMatrix(frameOptions.mvp)
      const heightScale = assertFinite(frameOptions.heightScale ?? 1, 'heightScale')
      const light = normalizeDirection(
        frameOptions.lightDirection ?? [0.35, 0.85, 0.4],
      )
      const ambient = assertFinite(frameOptions.ambient ?? 0.28, 'ambient')
      const baseColor = frameOptions.baseColor ?? [0.26, 0.58, 0.31, 1]
      const opacity = assertFinite(frameOptions.opacity ?? 1, 'opacity')

      for (let index = 0; index < baseColor.length; index += 1) {
        assertFinite(baseColor[index], `baseColor[${index}]`)
      }

      const frame = new Float32Array(28)
      frame.set(mvp, 0)
      frame.set([light[0], light[1], light[2], ambient], 16)
      frame.set(baseColor, 20)
      frame.set([metersPerPixel, heightScale, opacity, 0], 24)

      const grid = new Uint32Array([
        terrain.width,
        terrain.height,
        layout.stride,
        layout.cellColumns,
      ])

      device.queue.writeBuffer(frameBuffer, 0, frame)
      device.queue.writeBuffer(gridBuffer, 0, grid)

      const encoder = device.createCommandEncoder({
        label: 'Nitro Mapbox AR terrain frame encoder',
      })
      const pass = encoder.beginRenderPass({
        label: 'Nitro Mapbox AR terrain render pass',
        colorAttachments: [
          {
            view: texture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      })

      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw(layout.vertexCount)
      pass.end()

      device.queue.submit([encoder.finish()])

      return {
        image: makeSkiaImageFromWebGPUTexture(texture),
        layout,
      }
    },

    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      frameBuffer.destroy()
      gridBuffer.destroy()
      depthTexture.destroy()
      texture.destroy()
    },
  }
}
