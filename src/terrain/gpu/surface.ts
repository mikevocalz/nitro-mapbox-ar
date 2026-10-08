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

export interface TerrainSurfaceRendererOptions {
  readonly targetWidth: number
  readonly targetHeight: number
  readonly format?: GPUTextureFormat
  readonly depthFormat?: GPUTextureFormat
  readonly imagery?: Pick<GpuSatelliteTile, 'texture'>
}

export type TerrainFrameOptions = TerrainTileFrameOptions

export interface RenderedTerrainFrame {
  readonly image: ReturnType<TerrainRenderTarget['makeImage']>
  readonly layout: TerrainGridLayout
}

export interface TerrainSurfaceRenderer {
  readonly texture: GPUTexture
  readonly depthTexture: GPUTexture
  readonly format: GPUTextureFormat
  readonly metersPerPixel: number
  readonly sampleSpacingMeters: number
  render(options: TerrainFrameOptions): RenderedTerrainFrame
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
