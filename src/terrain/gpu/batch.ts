import { getGraphiteWebGPUContext } from '../../rendering/graphite'
import type { TileId } from '../../mapbox/tiles'
import {
  createTerrainTileRenderer,
  type Matrix4,
  type TerrainTileFrameOptions,
  type TerrainTileRenderer,
  type Vec3,
  type Vec4,
} from './draw'
import { tileGroundSpanMeters, type TerrainGridLayout } from './grid'
import type { GpuSatelliteTile } from './imagery'
import {
  getLocalTileOffset,
  makeTranslationMatrix,
  multiplyMatrix4,
  type LocalTileOffset,
} from './multitile'
import {
  createTerrainRenderTarget,
  type TerrainRenderTarget,
} from './target'
import type { GpuTerrainTile } from './tile'

export interface TerrainBatchEntry {
  readonly terrain: Pick<
    GpuTerrainTile,
    'tile' | 'heights' | 'width' | 'height'
  >
  readonly imagery?: Pick<GpuSatelliteTile, 'texture'>
}

export interface TerrainBatchRendererOptions {
  readonly targetWidth: number
  readonly targetHeight: number
  readonly format?: GPUTextureFormat
  readonly depthFormat?: GPUTextureFormat
  readonly originTile?: TileId
}

export interface TerrainBatchItemContext {
  readonly entry: TerrainBatchEntry
  readonly index: number
  readonly offset: LocalTileOffset
}

export type TerrainBatchValue<T> =
  | T
  | ((context: TerrainBatchItemContext) => T)

export interface TerrainBatchFrameOptions {
  readonly viewProjection: Matrix4
  readonly heightScale?: number
  readonly lightDirection?: Vec3
  readonly ambient?: number
  readonly baseColor?: Vec4
  readonly opacity?: number
  readonly imageryOpacity?: number
  readonly lodStride?: TerrainBatchValue<number>
  readonly skirtDepth?: TerrainBatchValue<number>
  readonly clearColor?: GPUColor
}

export interface RenderedTerrainBatchItem {
  readonly tile: TileId
  readonly offset: LocalTileOffset
  readonly layout: TerrainGridLayout
}

export interface RenderedTerrainBatchFrame {
  readonly image: ReturnType<TerrainRenderTarget['makeImage']>
  readonly items: readonly RenderedTerrainBatchItem[]
}

export interface TerrainBatchRenderer {
  readonly texture: GPUTexture
  readonly depthTexture: GPUTexture
  readonly format: GPUTextureFormat
  readonly originTile: TileId
  readonly tileSpanMeters: number
  render(options: TerrainBatchFrameOptions): RenderedTerrainBatchFrame
  dispose(): void
}

function resolveBatchValue<T>(
  value: TerrainBatchValue<T> | undefined,
  context: TerrainBatchItemContext,
): T | undefined {
  return typeof value === 'function'
    ? (value as (context: TerrainBatchItemContext) => T)(context)
    : value
}

function validateEntries(
  entries: readonly TerrainBatchEntry[],
  originTile: TileId,
): void {
  if (entries.length === 0) {
    throw new RangeError('multi-tile terrain requires at least one tile')
  }

  for (const { terrain } of entries) {
    if (terrain.tile.z !== originTile.z) {
      throw new RangeError(
        `all terrain tiles must use zoom ${originTile.z}; got ${terrain.tile.z}`,
      )
    }
    if (terrain.width !== terrain.height) {
      throw new RangeError(
        'multi-tile terrain currently requires square decoded tiles',
      )
    }
  }
}

/**
 * Creates one shared-target renderer for a local same-zoom terrain neighborhood.
 *
 * Every tile keeps its own height/imagery bind group, but all tiles:
 *
 * - share one cached shader pipeline;
 * - render into one color/depth target;
 * - encode into one render pass;
 * - submit as one command buffer.
 */
export function createTerrainBatchRenderer(
  entries: readonly TerrainBatchEntry[],
  options: TerrainBatchRendererOptions,
): TerrainBatchRenderer {
  if (entries.length === 0) {
    throw new RangeError('multi-tile terrain requires at least one tile')
  }

  const originTile = options.originTile ?? entries[0].terrain.tile
  validateEntries(entries, originTile)

  const target = createTerrainRenderTarget({
    width: options.targetWidth,
    height: options.targetHeight,
    format: options.format,
    depthFormat: options.depthFormat,
  })

  const tileRenderers = entries.map((entry) =>
    createTerrainTileRenderer(entry.terrain, {
      format: target.format,
      depthFormat: target.depthFormat,
      imagery: entry.imagery,
    }),
  )

  const tileSpanMeters = tileGroundSpanMeters(originTile)
  const offsets = entries.map((entry) =>
    getLocalTileOffset(originTile, entry.terrain.tile, tileSpanMeters),
  )
  const { device } = getGraphiteWebGPUContext()
  let disposed = false

  return {
    texture: target.texture,
    depthTexture: target.depthTexture,
    format: target.format,
    originTile,
    tileSpanMeters,

    render(frameOptions) {
      if (disposed) {
        throw new Error('TerrainBatchRenderer has been disposed')
      }

      const encoder = device.createCommandEncoder({
        label: 'Nitro Mapbox AR multi-tile terrain encoder',
      })
      const pass = encoder.beginRenderPass({
        label: 'Nitro Mapbox AR multi-tile terrain pass',
        colorAttachments: [
          {
            view: target.view,
            clearValue: frameOptions.clearColor ?? {
              r: 0,
              g: 0,
              b: 0,
              a: 0,
            },
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

      const items: RenderedTerrainBatchItem[] = []

      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index]
        const renderer: TerrainTileRenderer = tileRenderers[index]
        const offset = offsets[index]
        const context: TerrainBatchItemContext = {
          entry,
          index,
          offset,
        }

        const translation = makeTranslationMatrix(offset.x, 0, offset.z)
        const mvp = multiplyMatrix4(frameOptions.viewProjection, translation)

        const drawOptions: TerrainTileFrameOptions = {
          mvp,
          heightScale: frameOptions.heightScale,
          lightDirection: frameOptions.lightDirection,
          ambient: frameOptions.ambient,
          baseColor: frameOptions.baseColor,
          opacity: frameOptions.opacity,
          imageryOpacity: frameOptions.imageryOpacity,
          lodStride: resolveBatchValue(frameOptions.lodStride, context),
          skirtDepth: resolveBatchValue(frameOptions.skirtDepth, context),
          // All same-zoom batch tiles use one local tangent-plane span.
          sampleSpacingMeters:
            tileSpanMeters / (entry.terrain.width - 1),
        }

        const layout = renderer.draw(pass, drawOptions)
        items.push({
          tile: entry.terrain.tile,
          offset,
          layout,
        })
      }

      pass.end()
      device.queue.submit([encoder.finish()])

      return {
        image: target.makeImage(),
        items,
      }
    },

    dispose() {
      if (disposed) {
        return
      }

      disposed = true
      for (const renderer of tileRenderers) {
        renderer.dispose()
      }
      target.dispose()
    },
  }
}
