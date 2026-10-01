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

export interface TerrainNeighborhoodSessionOptions {
  readonly targetWidth: number
  readonly targetHeight: number
  readonly radius?: number
  readonly imagery?: boolean
  readonly tileSize?: RasterTileSize
  readonly satelliteFormat?: SatelliteFormat
  readonly heightModifier?: number
  readonly acquireConcurrency?: number
  readonly format?: GPUTextureFormat
  readonly depthFormat?: GPUTextureFormat
}

export interface TerrainNeighborhoodUpdateOptions {
  readonly signal?: AbortSignal
}

export interface TerrainNeighborhoodPrefetchOptions {
  readonly radius?: number
  readonly concurrency?: number
  readonly signal?: AbortSignal
}

export interface TerrainNeighborhoodSessionStats {
  readonly center?: TileId
  readonly radius: number
  readonly activeTiles: number
  readonly renderableTiles: number
  readonly updating: boolean
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

  render(
    options: TerrainBatchFrameOptions,
  ): RenderedTerrainBatchFrame {
    this.#assertAlive()

    if (!this.#batch) {
      throw new Error('terrain neighborhood has no renderable tiles')
    }

    return this.#batch.render(options)
  }

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
