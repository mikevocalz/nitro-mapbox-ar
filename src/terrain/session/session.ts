import type {
  RasterTileSize,
  SatelliteFormat,
} from '../../mapbox/raster'
import type { TileId } from '../../mapbox/tiles'
import {
  type GpuTileLease,
  type GpuResidencyCacheStats,
  GpuTileResidencyCache,
} from '../cache/residency'
import { terrainTileNeighborhood } from '../cache/neighborhood'
import {
  createTerrainBatchRenderer,
  type RenderedTerrainBatchFrame,
  type TerrainBatchEntry,
  type TerrainBatchFrameOptions,
  type TerrainBatchRenderer,
} from '../gpu/batch'
import type { GpuSatelliteTile } from '../gpu/imagery'
import {
  createTerrainRenderTarget,
  type TerrainRenderTarget,
} from '../gpu/target'
import type { GpuTerrainTileResult } from '../gpu/tile'
import {
  planTerrainNeighborhoodTransition,
  terrainTileKey,
} from './plan'

/**
 * Construction options for {@linkcode TerrainNeighborhoodSession}. All values
 * are fixed for the session's lifetime.
 */
export interface TerrainNeighborhoodSessionOptions {
  /** Color and depth target width in pixels. Must be a positive safe integer. */
  readonly targetWidth: number
  /** Color and depth target height in pixels. Must be a positive safe integer. */
  readonly targetHeight: number
  /**
   * Neighborhood radius in tiles around the center; `1` keeps a 3×3 block.
   * Must be a non-negative safe integer.
   *
   * @default 1
   */
  readonly radius?: number
  /**
   * Whether to lease satellite imagery for each non-water terrain tile and
   * drape it over the terrain.
   *
   * @default true
   */
  readonly imagery?: boolean
  /**
   * Terrain and satellite tile edge in pixels.
   *
   * @default 512
   */
  readonly tileSize?: RasterTileSize
  /**
   * Encoded satellite format requested from Mapbox. Ignored when `imagery` is
   * `false`.
   *
   * @default 'webp'
   */
  readonly satelliteFormat?: SatelliteFormat
  /**
   * Dimensionless multiplier applied to every decoded height; `1` yields
   * metres. Must be finite.
   *
   * @default 1
   */
  readonly heightModifier?: number
  /**
   * Maximum tiles acquired at once during
   * {@linkcode TerrainNeighborhoodSession.setCenter}, and the default
   * concurrency for {@linkcode TerrainNeighborhoodSession.prefetchNextRing}.
   * Must be a positive safe integer.
   *
   * @default 4
   */
  readonly acquireConcurrency?: number
  /**
   * Color target texture format.
   *
   * @default 'rgba8unorm'
   */
  readonly format?: GPUTextureFormat
  /**
   * Depth target texture format.
   *
   * @default 'depth24plus'
   */
  readonly depthFormat?: GPUTextureFormat
}

/**
 * Options for one {@linkcode TerrainNeighborhoodSession.setCenter} call.
 */
export interface TerrainNeighborhoodUpdateOptions {
  /**
   * Aborts this update. The previous neighborhood stays active and the call
   * rejects with an `AbortError`.
   */
  readonly signal?: AbortSignal
}

/**
 * Options for {@linkcode TerrainNeighborhoodSession.prefetchNextRing}.
 */
export interface TerrainNeighborhoodPrefetchOptions {
  /**
   * Prefetch radius in tiles around the current center. Must be a
   * non-negative safe integer.
   *
   * @default the session radius + 1
   */
  readonly radius?: number
  /**
   * Maximum tiles loading at once.
   *
   * @default {@linkcode TerrainNeighborhoodSessionOptions.acquireConcurrency}
   */
  readonly concurrency?: number
  /** Cancels the prefetch; the call rejects with an `AbortError`. */
  readonly signal?: AbortSignal
}

/**
 * Snapshot returned by {@linkcode TerrainNeighborhoodSession.stats} and
 * {@linkcode TerrainNeighborhoodSession.setCenter}.
 */
export interface TerrainNeighborhoodSessionStats {
  /**
   * Center tile of the last successful
   * {@linkcode TerrainNeighborhoodSession.setCenter}; `undefined` before one
   * has succeeded.
   */
  readonly center?: TileId
  /** Neighborhood radius in tiles. */
  readonly radius: number
  /** Tiles currently leased, including water tiles. */
  readonly activeTiles: number
  /** Leased tiles with terrain geometry; water tiles are excluded. */
  readonly renderableTiles: number
  /** `true` while a {@linkcode TerrainNeighborhoodSession.setCenter} call is in flight. */
  readonly updating: boolean
  /** Stats of the shared residency cache at the time of the snapshot. */
  readonly cache: GpuResidencyCacheStats
}

interface ActiveTile {
  readonly tile: TileId
  readonly terrain: GpuTileLease<GpuTerrainTileResult>
  readonly imagery?: GpuTileLease<GpuSatelliteTile>
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
  return value
}

function assertRadius(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('radius must be a non-negative safe integer')
  }
  return value
}

function abortError(): Error {
  const error = new Error('terrain neighborhood update was aborted')
  error.name = 'AbortError'
  return error
}

async function runWithConcurrency<T>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  const count = Math.min(
    assertPositiveInteger(concurrency, 'acquireConcurrency'),
    Math.max(1, values.length),
  )
  let next = 0

  await Promise.all(
    Array.from({ length: count }, async () => {
      while (next < values.length) {
        const index = next
        next += 1
        await worker(values[index])
      }
    }),
  )
}

function releaseActiveTile(active: ActiveTile): void {
  active.imagery?.release()
  active.terrain.release()
}

function toBatchEntry(active: ActiveTile): TerrainBatchEntry | undefined {
  if (active.terrain.value.kind !== 'tile') {
    return undefined
  }

  return {
    terrain: active.terrain.value.value,
    imagery: active.imagery?.value,
  }
}

/**
 * Keeps one moving local terrain neighborhood alive while reusing:
 *
 * - residency-cache leases for tiles that remain in range;
 * - one persistent color/depth target across center-tile changes;
 * - the batch renderer's shared Graphite/WebGPU pipeline cache.
 */
export class TerrainNeighborhoodSession {
  readonly #cache: GpuTileResidencyCache
  readonly #radius: number
  readonly #imagery: boolean
  readonly #tileSize: RasterTileSize
  readonly #satelliteFormat: SatelliteFormat
  readonly #heightModifier: number
  readonly #acquireConcurrency: number
  readonly #target: TerrainRenderTarget
  readonly #targetWidth: number
  readonly #targetHeight: number

  #active = new Map<string, ActiveTile>()
  #batch?: TerrainBatchRenderer
  #center?: TileId
  #updateController?: AbortController
  #disposed = false

  constructor(
    cache: GpuTileResidencyCache,
    options: TerrainNeighborhoodSessionOptions,
  ) {
    this.#cache = cache
    this.#radius = assertRadius(options.radius ?? 1)
    this.#imagery = options.imagery ?? true
    this.#tileSize = options.tileSize ?? 512
    this.#satelliteFormat = options.satelliteFormat ?? 'webp'
    this.#heightModifier = options.heightModifier ?? 1
    this.#acquireConcurrency = assertPositiveInteger(
      options.acquireConcurrency ?? 4,
      'acquireConcurrency',
    )
    this.#targetWidth = assertPositiveInteger(
      options.targetWidth,
      'targetWidth',
    )
    this.#targetHeight = assertPositiveInteger(
      options.targetHeight,
      'targetHeight',
    )

    if (!Number.isFinite(this.#heightModifier)) {
      throw new RangeError('heightModifier must be finite')
    }

    this.#target = createTerrainRenderTarget({
      width: this.#targetWidth,
      height: this.#targetHeight,
      format: options.format,
      depthFormat: options.depthFormat,
    })
  }

  /** Current session and cache counters. Each read builds a new snapshot. */
  get stats(): TerrainNeighborhoodSessionStats {
    return {
      center: this.#center,
      radius: this.#radius,
      activeTiles: this.#active.size,
      renderableTiles: [...this.#active.values()].filter(
        (active) => active.terrain.value.kind === 'tile',
      ).length,
      updating: this.#updateController !== undefined,
      cache: this.#cache.stats,
    }
  }

  /**
   * Moves the neighborhood to `center` as one transaction: keeps leases on
   * overlapping tiles, acquires only new terrain and imagery, builds the
   * replacement batch against the existing render target, swaps it in, then
   * releases tiles that left the neighborhood.
   *
   * Starting a new call aborts the previous in-flight one. On failure or
   * abort, newly acquired leases are released and the previous neighborhood
   * stays active.
   *
   * @returns A promise of the post-update {@linkcode TerrainNeighborhoodSessionStats}.
   * It rejects with an `AbortError` when superseded or when `options.signal`
   * aborts, with an `Error` when the session has been disposed, and with any
   * tile acquisition error.
   */
  async setCenter(
    center: TileId,
    options: TerrainNeighborhoodUpdateOptions = {},
  ): Promise<TerrainNeighborhoodSessionStats> {
    this.#assertAlive()

    this.#updateController?.abort()
    const controller = new AbortController()
    this.#updateController = controller

    const onCallerAbort = () => controller.abort()
    if (options.signal?.aborted) {
      controller.abort()
    } else {
      options.signal?.addEventListener('abort', onCallerAbort, {
        once: true,
      })
    }

    const desiredTiles = terrainTileNeighborhood(center, this.#radius)
    const plan = planTerrainNeighborhoodTransition(
      this.#active.keys(),
      desiredTiles,
    )
    const next = new Map<string, ActiveTile>()

    for (const key of plan.retain) {
      const active = this.#active.get(key)
      if (active) {
        next.set(key, active)
      }
    }

    const newlyAcquired: ActiveTile[] = []

    try {
      await runWithConcurrency(
        plan.acquire,
        this.#acquireConcurrency,
        async (tile) => {
          if (controller.signal.aborted) {
            throw abortError()
          }

          const terrain = await this.#cache.acquireTerrain(tile, {
            tileSize: this.#tileSize,
            heightModifier: this.#heightModifier,
            signal: controller.signal,
          })

          let imagery: GpuTileLease<GpuSatelliteTile> | undefined

          try {
            if (this.#imagery && terrain.value.kind === 'tile') {
              imagery = await this.#cache.acquireSatellite(tile, {
                tileSize: this.#tileSize,
                format: this.#satelliteFormat,
                signal: controller.signal,
              })
            }
          } catch (error) {
            terrain.release()
            throw error
          }

          const active: ActiveTile = {
            tile,
            terrain,
            imagery,
          }

          newlyAcquired.push(active)
          next.set(terrainTileKey(tile), active)
        },
      )

      if (controller.signal.aborted) {
        throw abortError()
      }

      const entries = desiredTiles
        .map((tile) => next.get(terrainTileKey(tile)))
        .filter((active): active is ActiveTile => active !== undefined)
        .map(toBatchEntry)
        .filter((entry): entry is TerrainBatchEntry => entry !== undefined)

      const nextBatch =
        entries.length > 0
          ? createTerrainBatchRenderer(entries, {
              targetWidth: this.#targetWidth,
              targetHeight: this.#targetHeight,
              format: this.#target.format,
              depthFormat: this.#target.depthFormat,
              originTile: center,
              target: this.#target,
            })
          : undefined

      const oldBatch = this.#batch
      this.#batch = nextBatch
      oldBatch?.dispose()

      for (const key of plan.release) {
        const active = this.#active.get(key)
        if (active) {
          releaseActiveTile(active)
        }
      }

      this.#active = next
      this.#center = center

      return this.stats
    } catch (error) {
      for (const active of newlyAcquired) {
        releaseActiveTile(active)
      }
      throw error
    } finally {
      options.signal?.removeEventListener('abort', onCallerAbort)
      if (this.#updateController === controller) {
        this.#updateController = undefined
      }
    }
  }

  /**
   * Draws the current neighborhood into the session's persistent color and
   * depth target.
   *
   * @throws {Error} When the session has been disposed, or when there are no
   * renderable tiles: before the first successful
   * {@linkcode TerrainNeighborhoodSession.setCenter}, or when every tile in
   * the neighborhood is water.
   */
  render(
    options: TerrainBatchFrameOptions,
  ): RenderedTerrainBatchFrame {
    this.#assertAlive()

    if (!this.#batch) {
      throw new Error('terrain neighborhood has no renderable tiles')
    }

    return this.#batch.render(options)
  }

  /**
   * Warms the shared cache with terrain, and imagery when enabled, for a
   * larger ring around the current center. Prefetched tiles are not leased by
   * the session, so they stay subject to LRU eviction until a later
   * {@linkcode TerrainNeighborhoodSession.setCenter} acquires them.
   *
   * @returns A promise that rejects with an `Error` when the session has been
   * disposed or no {@linkcode TerrainNeighborhoodSession.setCenter} call has
   * succeeded yet, with a `RangeError` for an invalid radius or concurrency,
   * and with an `AbortError` when `options.signal` aborts.
   */
  async prefetchNextRing(
    options: TerrainNeighborhoodPrefetchOptions = {},
  ): Promise<void> {
    this.#assertAlive()

    if (!this.#center) {
      throw new Error('setCenter() must succeed before prefetching')
    }

    const radius = assertRadius(options.radius ?? this.#radius + 1)
    const concurrency = options.concurrency ?? this.#acquireConcurrency

    await this.#cache.prefetchTerrainNeighborhood(
      this.#center,
      radius,
      {
        tileSize: this.#tileSize,
        heightModifier: this.#heightModifier,
        concurrency,
        signal: options.signal,
      },
    )

    if (this.#imagery) {
      await this.#cache.prefetchSatelliteNeighborhood(
        this.#center,
        radius,
        {
          tileSize: this.#tileSize,
          format: this.#satelliteFormat,
          concurrency,
          signal: options.signal,
        },
      )
    }
  }

  /**
   * Aborts any in-flight {@linkcode TerrainNeighborhoodSession.setCenter},
   * disposes the batch renderer and render target, and releases every lease
   * the session holds. The shared cache is not disposed; dispose it after its
   * sessions. Later calls to other methods throw. Calling it twice is a no-op.
   */
  dispose(): void {
    if (this.#disposed) {
      return
    }

    this.#disposed = true
    this.#updateController?.abort()
    this.#updateController = undefined

    this.#batch?.dispose()
    this.#batch = undefined

    for (const active of this.#active.values()) {
      releaseActiveTile(active)
    }
    this.#active.clear()

    this.#target.dispose()
  }

  #assertAlive(): void {
    if (this.#disposed) {
      throw new Error('TerrainNeighborhoodSession has been disposed')
    }
  }
}
