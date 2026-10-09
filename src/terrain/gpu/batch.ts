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

/**
 * One tile passed to {@linkcode createTerrainBatchRenderer}. The batch borrows
 * both resources; the caller keeps them alive until the batch is disposed.
 */
export interface TerrainBatchEntry {
  /**
   * Decoded terrain tile. Must share the origin tile's zoom and be square
   * (`width === height`).
   */
  readonly terrain: Pick<
    GpuTerrainTile,
    'tile' | 'heights' | 'width' | 'height'
  >
  /** Satellite imagery draped over this tile. Omit to draw `baseColor` only. */
  readonly imagery?: Pick<GpuSatelliteTile, 'texture'>
}

/**
 * Target size, formats, and origin for {@linkcode createTerrainBatchRenderer}.
 */
export interface TerrainBatchRendererOptions {
  /**
   * Render target width in pixels. Must equal `target.width` when `target` is
   * given.
   */
  readonly targetWidth: number
  /**
   * Render target height in pixels. Must equal `target.height` when `target`
   * is given.
   */
  readonly targetHeight: number
  /**
   * Color format. Must match `target.format` when both are given.
   * @default 'rgba8unorm'
   */
  readonly format?: GPUTextureFormat
  /**
   * Depth format. Must match `target.depthFormat` when both are given.
   * @default 'depth24plus'
   */
  readonly depthFormat?: GPUTextureFormat
  /**
   * Tile whose center is the origin of the batch's local tangent plane. Its
   * ground span sets the spacing for every tile in the batch. Defaults to the
   * first entry's tile.
   */
  readonly originTile?: TileId
  /**
   * Optional externally-owned target. This lets a moving neighborhood replace
   * tile draw resources without reallocating its large color/depth textures.
   */
  readonly target?: TerrainRenderTarget
}

/**
 * Argument to a {@linkcode TerrainBatchValue} callback, describing the tile
 * about to be drawn.
 */
export interface TerrainBatchItemContext {
  /** The entry being drawn. */
  readonly entry: TerrainBatchEntry
  /** Position of the entry in the array given to {@linkcode createTerrainBatchRenderer}. */
  readonly index: number
  /** Tile center relative to the origin tile's center, in metres. */
  readonly offset: LocalTileOffset
}

/**
 * A setting applied to every tile, or a callback that picks a value per tile,
 * for example a coarser {@linkcode TerrainBatchFrameOptions.lodStride} for
 * tiles far from the origin. Callbacks run once per tile per frame.
 */
export type TerrainBatchValue<T> =
  | T
  | ((context: TerrainBatchItemContext) => T)

/**
 * Per-frame settings for {@linkcode TerrainBatchRenderer.render}. Shading
 * options match {@linkcode TerrainTileFrameOptions} and apply to every tile;
 * `lodStride` and `skirtDepth` can vary per tile.
 */
export interface TerrainBatchFrameOptions {
  /**
   * Column-major view-projection matrix for the batch's local tangent plane:
   * metres, origin at the origin tile's center, +x east, +y up, +z south. Each
   * tile's offset is applied before this matrix.
   */
  readonly viewProjection: Matrix4
  /**
   * Multiplier on elevations.
   * @default 1
   */
  readonly heightScale?: number
  /**
   * Direction toward the light. Normalized before use.
   * @default [0.35, 0.85, 0.4]
   */
  readonly lightDirection?: Vec3
  /**
   * Ambient light share, clamped to 0 to 1.
   * @default 0.28
   */
  readonly ambient?: number
  /**
   * RGBA albedo. Defaults per tile to white with imagery and to green
   * `[0.26, 0.58, 0.31, 1]` without.
   */
  readonly baseColor?: Vec4
  /**
   * Multiplier on output alpha, clamped to 0 to 1.
   * @default 1
   */
  readonly opacity?: number
  /** Imagery blend, clamped to 0 to 1. Defaults per tile to 1 with imagery, 0 without. */
  readonly imageryOpacity?: number
  /**
   * Sample step between drawn vertices, fixed or per tile.
   * @default 1
   */
  readonly lodStride?: TerrainBatchValue<number>
  /**
   * Skirt height in metres, fixed or per tile. Use a positive value when
   * neighboring tiles draw at different strides.
   * @default 0
   */
  readonly skirtDepth?: TerrainBatchValue<number>
  /**
   * Color the target is cleared to before drawing.
   * @default { r: 0, g: 0, b: 0, a: 0 }
   */
  readonly clearColor?: GPUColor
}

/**
 * What one tile drew in a frame. Listed in
 * {@linkcode RenderedTerrainBatchFrame.items}.
 */
export interface RenderedTerrainBatchItem {
  /** The tile drawn. */
  readonly tile: TileId
  /** Tile center relative to the origin tile's center, in metres. */
  readonly offset: LocalTileOffset
  /** Grid layout drawn at the stride chosen for this tile. */
  readonly layout: TerrainGridLayout
}

/**
 * Output of {@linkcode TerrainBatchRenderer.render}.
 */
export interface RenderedTerrainBatchFrame {
  /**
   * Skia image wrapping the shared render target, with no CPU copy. A new
   * image is returned each frame; dispose the previous one after replacing it.
   */
  readonly image: ReturnType<TerrainRenderTarget['makeImage']>
  /** One item per entry, in entry order. */
  readonly items: readonly RenderedTerrainBatchItem[]
}

/**
 * Renders a same-zoom neighborhood of terrain tiles into one color and depth
 * target with one render pass and one queue submission per frame. Created by
 * {@linkcode createTerrainBatchRenderer}.
 *
 * The batch owns its per-tile uniforms and, unless `target` was passed in
 * {@linkcode TerrainBatchRendererOptions}, the render target. It borrows the
 * tiles and imagery. Call {@linkcode TerrainBatchRenderer.dispose} once no
 * image from it is drawn.
 */
export interface TerrainBatchRenderer {
  /** Color texture the batch draws into. */
  readonly texture: GPUTexture
  /** Depth texture paired with {@linkcode TerrainBatchRenderer.texture}. */
  readonly depthTexture: GPUTexture
  /** Color format of the target. */
  readonly format: GPUTextureFormat
  /** Tile at the origin of the local tangent plane. */
  readonly originTile: TileId
  /**
   * Ground width of the origin tile in metres at its center latitude. Every
   * tile in the batch is placed and spaced with this span.
   */
  readonly tileSpanMeters: number
  /**
   * Clears the target, draws every tile, and submits one command buffer.
   *
   * @throws {RangeError} When a frame option or per-tile value is invalid.
   * @throws {Error} When the batch has been disposed.
   */
  render(options: TerrainBatchFrameOptions): RenderedTerrainBatchFrame
  /**
   * Destroys per-tile uniforms, and the render target when the batch created
   * it. A `target` passed in options is left for its owner to dispose. Safe to
   * call more than once.
   */
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

  const ownsTarget = options.target === undefined
  const target =
    options.target ??
    createTerrainRenderTarget({
      width: options.targetWidth,
      height: options.targetHeight,
      format: options.format,
      depthFormat: options.depthFormat,
    })

  if (
    target.width !== options.targetWidth ||
    target.height !== options.targetHeight
  ) {
    throw new Error('external terrain target dimensions do not match batch options')
  }

  if (options.format && options.format !== target.format) {
    throw new Error('external terrain target color format does not match batch options')
  }

  if (options.depthFormat && options.depthFormat !== target.depthFormat) {
    throw new Error('external terrain target depth format does not match batch options')
  }

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
      if (ownsTarget) {
        target.dispose()
      }
    },
  }
}
