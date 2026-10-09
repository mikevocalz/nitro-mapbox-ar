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

/**
 * The cache surface {@linkcode SpatialTileSession} depends on.
 * `GpuTileResidencyCache` satisfies it; tests can pass a fake.
 */
export interface SpatialTileSessionCache {
  /**
   * Leases the terrain tile for `tile`. The session releases the lease when
   * the tile leaves the visible neighborhood or the session is disposed.
   */
  acquireTerrain(
    tile: TileId,
    options?: TerrainAcquireOptions,
  ): Promise<GpuTileLease<GpuTerrainTileResult>>
  /**
   * Leases the satellite texture for `tile`. Called only when
   * {@linkcode SpatialTileSessionOptions.includeSatellite} is `true`.
   */
  acquireSatellite(
    tile: TileId,
    options?: SatelliteAcquireOptions,
  ): Promise<GpuTileLease<GpuSatelliteTile>>
  /**
   * Loads terrain within `radius` tiles of `center` without keeping leases.
   * Called with {@linkcode SpatialTileSessionOptions.prefetchRadius}.
   */
  prefetchTerrainNeighborhood(
    center: TileId,
    radius: number,
    options?: TerrainAcquireOptions & NeighborhoodPrefetchOptions,
  ): Promise<void>
  /**
   * Loads satellite imagery within `radius` tiles of `center` without keeping
   * leases. Called only when satellite imagery is enabled.
   */
  prefetchSatelliteNeighborhood(
    center: TileId,
    radius: number,
    options?: SatelliteAcquireOptions & NeighborhoodPrefetchOptions,
  ): Promise<void>
}

/**
 * Construction options for {@linkcode SpatialTileSession}.
 */
export interface SpatialTileSessionOptions {
  /**
   * Radius in tiles of the leased, visible neighborhood; `1` is a 3×3 block.
   * Must be a non-negative safe integer.
   *
   * @default 1
   */
  readonly visibleRadius?: number
  /**
   * Radius in tiles of the prefetched ring. Must be a non-negative safe
   * integer no smaller than `visibleRadius`; when equal, no prefetch runs.
   *
   * @default 2
   */
  readonly prefetchRadius?: number
  /**
   * Whether to lease and prefetch satellite imagery alongside terrain.
   *
   * @default true
   */
  readonly includeSatellite?: boolean
  /** Terrain acquisition options applied to every visible and prefetched tile. */
  readonly terrain?: Omit<TerrainAcquireOptions, 'signal'>
  /** Satellite acquisition options applied to every visible and prefetched tile. */
  readonly satellite?: Omit<SatelliteAcquireOptions, 'signal'>
  /**
   * Maximum tiles loading at once per prefetch layer. Must be a positive safe
   * integer. Visible tiles are acquired without this limit.
   *
   * @default 4
   */
  readonly prefetchConcurrency?: number
  /**
   * Receives prefetch failures other than aborts. Prefetch runs in the
   * background, so without this callback those failures are dropped.
   */
  readonly onPrefetchError?: (error: unknown) => void
}

/**
 * One visible tile in a {@linkcode SpatialTileSessionSnapshot}. The GPU
 * resources stay valid until the tile leaves the visible neighborhood or the
 * session is disposed.
 */
export interface SpatialTileSessionEntry {
  /** The tile's XYZ address. */
  readonly tile: TileId
  /** Leased terrain; `kind: 'water'` for ocean tiles with no geometry. */
  readonly terrain: GpuTerrainTileResult
  /**
   * Leased satellite texture; `undefined` when
   * {@linkcode SpatialTileSessionOptions.includeSatellite} is `false`.
   */
  readonly satellite?: GpuSatelliteTile
}

/**
 * Result of {@linkcode SpatialTileSession.updateCenter}: the visible
 * neighborhood after the move.
 */
export interface SpatialTileSessionSnapshot {
  /** The center tile passed to {@linkcode SpatialTileSession.updateCenter}. */
  readonly center: TileId
  /** Visible tiles, row by row from north-west, deduplicated at low zoom. */
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

/**
 * Movement-aware tile controller for map, navigation and AR/XR scenes.
 *
 * Holds leases on the visible neighborhood around the current center tile,
 * keeps leases on tiles that stay in range as the center moves, releases
 * tiles as soon as they leave it, and prefetches a larger ring in the
 * background. It does not render or own camera state; feed
 * {@linkcode SpatialTileSessionSnapshot} entries to a renderer.
 *
 * The cache is externally owned. Call {@linkcode SpatialTileSession.dispose}
 * before disposing the cache.
 *
 * @throws {RangeError} From the constructor when a radius or
 * `prefetchConcurrency` is invalid, or `prefetchRadius` is smaller than
 * `visibleRadius`.
 */
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

  /** Number of visible tiles the session currently holds leases on. */
  get residentCount(): number {
    return this.#resident.size
  }

  /**
   * Moves the visible neighborhood to `center`. Acquires leases for tiles not
   * already held, releases tiles that fell out of range, then restarts the
   * background prefetch for the new center, aborting the previous one.
   *
   * If any acquisition fails, the leases this call acquired are released and
   * the previous neighborhood stays held.
   *
   * @param signal Cancels this call's tile acquisitions.
   * @returns A promise of the visible {@linkcode SpatialTileSessionSnapshot}.
   * It rejects with an `Error` when the session is disposed or a newer
   * `updateCenter` call supersedes this one, with an `AbortError` when
   * `signal` aborts, and with any tile acquisition error.
   */
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

  /**
   * Aborts the background prefetch, invalidates in-flight
   * {@linkcode SpatialTileSession.updateCenter} calls, and releases every
   * lease the session holds. The cache is not disposed. Later
   * `updateCenter` calls reject. Calling it twice is a no-op.
   */
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
