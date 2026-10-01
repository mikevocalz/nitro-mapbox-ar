import type { TileId } from '../mapbox/tiles'
import type {
  GpuTileLease,
  NeighborhoodPrefetchOptions,
  SatelliteAcquireOptions,
  TerrainAcquireOptions,
} from '../terrain/cache/residency'
import { terrainTileNeighborhood } from '../terrain/cache/neighborhood'
import type { GpuSatelliteTile } from '../terrain/gpu/imagery'
import type { GpuTerrainTileResult } from '../terrain/gpu/tile'

export interface SpatialTileSessionCache {
  acquireTerrain(
    tile: TileId,
    options?: TerrainAcquireOptions,
  ): Promise<GpuTileLease<GpuTerrainTileResult>>
  acquireSatellite(
    tile: TileId,
    options?: SatelliteAcquireOptions,
  ): Promise<GpuTileLease<GpuSatelliteTile>>
  prefetchTerrainNeighborhood(
    center: TileId,
    radius: number,
    options?: TerrainAcquireOptions & NeighborhoodPrefetchOptions,
  ): Promise<void>
  prefetchSatelliteNeighborhood(
    center: TileId,
    radius: number,
    options?: SatelliteAcquireOptions & NeighborhoodPrefetchOptions,
  ): Promise<void>
}

export interface SpatialTileSessionOptions {
  readonly visibleRadius?: number
  readonly prefetchRadius?: number
  readonly includeSatellite?: boolean
  readonly terrain?: Omit<TerrainAcquireOptions, 'signal'>
  readonly satellite?: Omit<SatelliteAcquireOptions, 'signal'>
  readonly prefetchConcurrency?: number
  readonly onPrefetchError?: (error: unknown) => void
}

export interface SpatialTileSessionEntry {
  readonly tile: TileId
  readonly terrain: GpuTerrainTileResult
  readonly satellite?: GpuSatelliteTile
}

export interface SpatialTileSessionSnapshot {
  readonly center: TileId
  readonly entries: readonly SpatialTileSessionEntry[]
}

interface ResidentEntry {
  readonly tile: TileId
  readonly terrainLease: GpuTileLease<GpuTerrainTileResult>
  readonly satelliteLease?: GpuTileLease<GpuSatelliteTile>
}

function tileKey(tile: TileId): string {
  return `${tile.z}/${tile.x}/${tile.y}`
}

function assertRadius(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`)
  }
  return value
}

function assertConcurrency(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError('prefetchConcurrency must be a positive safe integer')
  }
  return value
}

export class SpatialTileSession {
  readonly #cache: SpatialTileSessionCache
  readonly #visibleRadius: number
  readonly #prefetchRadius: number
  readonly #includeSatellite: boolean
  readonly #terrain: Omit<TerrainAcquireOptions, 'signal'>
  readonly #satellite: Omit<SatelliteAcquireOptions, 'signal'>
  readonly #prefetchConcurrency: number
  readonly #onPrefetchError?: (error: unknown) => void

  readonly #resident = new Map<string, ResidentEntry>()
  #generation = 0
  #disposed = false
  #prefetchController?: AbortController

  constructor(
    cache: SpatialTileSessionCache,
    options: SpatialTileSessionOptions = {},
  ) {
    this.#cache = cache
    this.#visibleRadius = assertRadius(options.visibleRadius ?? 1, 'visibleRadius')
    this.#prefetchRadius = assertRadius(
      options.prefetchRadius ?? 2,
      'prefetchRadius',
    )

    if (this.#prefetchRadius < this.#visibleRadius) {
      throw new RangeError('prefetchRadius cannot be smaller than visibleRadius')
    }

    this.#includeSatellite = options.includeSatellite ?? true
    this.#terrain = options.terrain ?? {}
    this.#satellite = options.satellite ?? {}
    this.#prefetchConcurrency = assertConcurrency(
      options.prefetchConcurrency ?? 4,
    )
    this.#onPrefetchError = options.onPrefetchError
  }

  get residentCount(): number {
    return this.#resident.size
  }

  async updateCenter(
    center: TileId,
    signal?: AbortSignal,
  ): Promise<SpatialTileSessionSnapshot> {
    this.#assertAlive()

    const generation = ++this.#generation
    const desiredTiles = terrainTileNeighborhood(center, this.#visibleRadius)
    const desiredKeys = new Set(desiredTiles.map(tileKey))
    const acquired = new Map<string, ResidentEntry>()

    try {
      await Promise.all(
        desiredTiles.map(async (tile) => {
          const key = tileKey(tile)
          if (this.#resident.has(key)) {
            return
          }

          const terrainLease = await this.#cache.acquireTerrain(tile, {
            ...this.#terrain,
            signal,
          })

          try {
            const satelliteLease = this.#includeSatellite
              ? await this.#cache.acquireSatellite(tile, {
                  ...this.#satellite,
                  signal,
                })
              : undefined

            acquired.set(key, {
              tile,
              terrainLease,
              satelliteLease,
            })
          } catch (error) {
            terrainLease.release()
            throw error
          }
        }),
      )
    } catch (error) {
      for (const entry of acquired.values()) {
        entry.satelliteLease?.release()
        entry.terrainLease.release()
      }
      throw error
    }

    if (generation !== this.#generation || this.#disposed) {
      for (const entry of acquired.values()) {
        entry.satelliteLease?.release()
        entry.terrainLease.release()
      }
      throw new Error('Spatial tile session update was superseded')
    }

    for (const [key, entry] of this.#resident) {
      if (!desiredKeys.has(key)) {
        entry.satelliteLease?.release()
        entry.terrainLease.release()
        this.#resident.delete(key)
      }
    }

    for (const [key, entry] of acquired) {
      this.#resident.set(key, entry)
    }

    this.#startPrefetch(center)

    return {
      center,
      entries: desiredTiles.flatMap((tile) => {
        const resident = this.#resident.get(tileKey(tile))
        if (!resident) {
          return []
        }

        return [{
          tile: resident.tile,
          terrain: resident.terrainLease.value,
          satellite: resident.satelliteLease?.value,
        }]
      }),
    }
  }

  dispose(): void {
    if (this.#disposed) {
      return
    }

    this.#disposed = true
    this.#generation += 1
    this.#prefetchController?.abort()
    this.#prefetchController = undefined

    for (const entry of this.#resident.values()) {
      entry.satelliteLease?.release()
      entry.terrainLease.release()
    }

    this.#resident.clear()
  }

  #startPrefetch(center: TileId): void {
    this.#prefetchController?.abort()

    if (this.#prefetchRadius === this.#visibleRadius) {
      this.#prefetchController = undefined
      return
    }

    const controller = new AbortController()
    this.#prefetchController = controller
    const common = {
      concurrency: this.#prefetchConcurrency,
      signal: controller.signal,
    }

    const work = [
      this.#cache.prefetchTerrainNeighborhood(center, this.#prefetchRadius, {
        ...this.#terrain,
        ...common,
      }),
    ]

    if (this.#includeSatellite) {
      work.push(
        this.#cache.prefetchSatelliteNeighborhood(center, this.#prefetchRadius, {
          ...this.#satellite,
          ...common,
        }),
      )
    }

    void Promise.all(work).catch((error) => {
      if (
        controller.signal.aborted ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return
      }
      this.#onPrefetchError?.(error)
    })
  }

  #assertAlive(): void {
    if (this.#disposed) {
      throw new Error('SpatialTileSession has been disposed')
    }
  }
}
