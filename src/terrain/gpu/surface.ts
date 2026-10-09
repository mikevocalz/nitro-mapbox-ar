import { getGraphiteWebGPUContext } from '../../rendering/graphite'
import type { TerrainGridLayout } from './grid'
import type { GpuSatelliteTile } from './imagery'
import {
  createTerrainTileRenderer,
  type TerrainTileFrameOptions,
  type TerrainTileRenderer,
} from './draw'
import {
  createTerrainRenderTarget,
  type TerrainRenderTarget,
} from './target'
import type { GpuTerrainTile } from './tile'

export type { Matrix4, Vec3, Vec4 } from './draw'

/**
 * Target size, formats, and imagery for {@linkcode createTerrainSurfaceRenderer}.
 */
export interface TerrainSurfaceRendererOptions {
  /** Render target width in pixels. Must be a positive safe integer. */
  readonly targetWidth: number
  /** Render target height in pixels. Must be a positive safe integer. */
  readonly targetHeight: number
  /**
   * Color format of the render target.
   * @default 'rgba8unorm'
   */
  readonly format?: GPUTextureFormat
  /**
   * Depth format of the render target.
   * @default 'depth24plus'
   */
  readonly depthFormat?: GPUTextureFormat
  /**
   * Satellite imagery to drape over the terrain. Borrowed; the caller keeps it
   * alive until the renderer is disposed.
   */
  readonly imagery?: Pick<GpuSatelliteTile, 'texture'>
}

/**
 * Per-frame settings for {@linkcode TerrainSurfaceRenderer.render}. Same shape
 * as {@linkcode TerrainTileFrameOptions}.
 */
export type TerrainFrameOptions = TerrainTileFrameOptions

/**
 * Output of {@linkcode TerrainSurfaceRenderer.render}.
 */
export interface RenderedTerrainFrame {
  /**
   * Skia image wrapping the render target, with no CPU copy. A new image is
   * returned each frame; dispose the previous one after replacing it.
   */
  readonly image: ReturnType<TerrainRenderTarget['makeImage']>
  /** Grid layout drawn this frame. */
  readonly layout: TerrainGridLayout
}

/**
 * Renders one terrain tile into its own color and depth target. Created by
 * {@linkcode createTerrainSurfaceRenderer}. For several tiles in one target,
 * use the batch renderer.
 *
 * The renderer owns its target and per-tile uniforms. It borrows the terrain
 * tile and imagery. Call {@linkcode TerrainSurfaceRenderer.dispose} once no
 * image from it is drawn, then dispose the tile and imagery.
 */
export interface TerrainSurfaceRenderer {
  /** Color texture the terrain is drawn into. */
  readonly texture: GPUTexture
  /** Depth texture paired with {@linkcode TerrainSurfaceRenderer.texture}. */
  readonly depthTexture: GPUTexture
  /** Color format of the target. */
  readonly format: GPUTextureFormat
  /** Ground metres per decoded texel at the tile's center latitude. */
  readonly metersPerPixel: number
  /** Distance in metres between neighboring height samples. */
  readonly sampleSpacingMeters: number
  /**
   * Clears the target to transparent black, draws the tile, and submits one
   * command buffer.
   *
   * @throws {RangeError} When a frame option is invalid.
   * @throws {Error} When the renderer has been disposed.
   */
  render(options: TerrainFrameOptions): RenderedTerrainFrame
  /** Destroys the tile uniforms and the render target. Safe to call more than once. */
  dispose(): void
}

/**
 * Compatibility wrapper for the original single-tile surface renderer.
 *
 * The actual tile drawing logic is shared with the multi-tile batch renderer.
 */
export function createTerrainSurfaceRenderer(
  terrain: Pick<GpuTerrainTile, 'tile' | 'heights' | 'width' | 'height'>,
  options: TerrainSurfaceRendererOptions,
): TerrainSurfaceRenderer {
  const target = createTerrainRenderTarget({
    width: options.targetWidth,
    height: options.targetHeight,
    format: options.format,
    depthFormat: options.depthFormat,
  })

  const tileRenderer: TerrainTileRenderer = createTerrainTileRenderer(
    terrain,
    {
      format: target.format,
      depthFormat: target.depthFormat,
      imagery: options.imagery,
    },
  )

  const { device } = getGraphiteWebGPUContext()
  let disposed = false

  return {
    texture: target.texture,
    depthTexture: target.depthTexture,
    format: target.format,
    metersPerPixel: tileRenderer.metersPerPixel,
    sampleSpacingMeters: tileRenderer.sampleSpacingMeters,

    render(frameOptions) {
      if (disposed) {
        throw new Error('TerrainSurfaceRenderer has been disposed')
      }

      const encoder = device.createCommandEncoder({
        label: 'Nitro Mapbox AR terrain frame encoder',
      })
      const pass = encoder.beginRenderPass({
        label: 'Nitro Mapbox AR terrain render pass',
        colorAttachments: [
          {
            view: target.view,
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
        depthStencilAttachment: {
          view: target.depthView,
          depthClearValue: 1,
          depthLoadOp: 'clear',
          depthStoreOp: 'store',
        },
      })

      const layout = tileRenderer.draw(pass, frameOptions)
      pass.end()
      device.queue.submit([encoder.finish()])

      return {
        image: target.makeImage(),
        layout,
      }
    },

    dispose() {
      if (disposed) {
        return
      }
      disposed = true
      tileRenderer.dispose()
      target.dispose()
    },
  }
}
