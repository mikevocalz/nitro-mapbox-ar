import type {
  MapboxRasterClient,
  RasterTileSize,
  SatelliteFormat,
} from '../../mapbox/raster'
import type { TileId } from '../../mapbox/tiles'
import {
  loadSatelliteTileOnGpu,
  type GpuSatelliteTile,
} from '../gpu/imagery'
import {
  loadTerrainTileOnGpu,
  type GpuTerrainTileResult,
} from '../gpu/tile'
import {
  estimateSatelliteGpuBytes,
  estimateTerrainGpuBytes,
} from './budget'
import { terrainTileNeighborhood } from './neighborhood'

/**
 * A pinned reference to a GPU resource held by {@linkcode GpuTileResidencyCache}.
 *
 * While at least one lease on an entry is unreleased, the cache will not
 * evict or dispose that entry. Call {@linkcode GpuTileLease.release} when the
 * renderer no longer reads {@linkcode GpuTileLease.value}.
 *
 * @see {@linkcode GpuTileResidencyCache.acquireTerrain}
 * @see {@linkcode GpuTileResidencyCache.acquireSatellite}
 */
export interface GpuTileLease<T> {
  /**
   * The cached GPU resource. The cache owns it: do not call `dispose()` on it
   * directly, and do not read it after {@linkcode GpuTileLease.release}.
   */
  readonly value: T
  /**
   * Drops this lease's pin on the entry. Once no leases remain, the entry
   * becomes eligible for LRU eviction. Calling it more than once is a no-op.
   */
  release(): void
}

/**
 * Budget configuration for a {@linkcode GpuTileResidencyCache}.
 *
 * @see {@linkcode GpuTileResidencyCache.stats}
 */
export interface GpuResidencyCacheOptions {
  /**
   * Upper bound, in bytes, on the estimated GPU memory of resident entries.
   * The estimate excludes driver alignment and allocator overhead, so set it
   * below the memory you actually want to reserve. Must be a positive safe
   * integer.
   */
  readonly maxBytes: number
  /**
   * Upper bound on the number of entries, counting both resident and loading
   * ones. Must be a positive safe integer.
   *
   * @default 256
   */
  readonly maxEntries?: number
}

/**
 * Point-in-time counters returned by {@linkcode GpuTileResidencyCache.stats}.
 */
export interface GpuResidencyCacheStats {
  /** Configured byte budget from {@linkcode GpuResidencyCacheOptions.maxBytes}. */
  readonly maxBytes: number
  /** Configured entry limit from {@linkcode GpuResidencyCacheOptions.maxEntries}. */
  readonly maxEntries: number
  /** Estimated GPU bytes held by entries whose load has finished. */
  readonly residentBytes: number
  /** Total entries, resident plus loading. */
  readonly entries: number
  /** Entries whose GPU resource has finished loading. */
  readonly residentEntries: number
  /** Entries whose load is still in flight. */
  readonly loadingEntries: number
  /** Entries with at least one unreleased {@linkcode GpuTileLease}. */
  readonly pinnedEntries: number
  /**
   * `true` when `residentBytes` exceeds `maxBytes` or `entries` exceeds
   * `maxEntries`. This happens when every candidate for eviction is pinned or
   * still loading; releasing leases triggers pruning back under budget.
   */
  readonly overBudget: boolean
}

/**
 * Options for {@linkcode GpuTileResidencyCache.acquireTerrain} and
 * {@linkcode GpuTileResidencyCache.prefetchTerrainNeighborhood}.
 *
 * `tileSize` and `heightModifier` are part of the cache key: requests that
 * differ in either load and cache separate entries.
 */
export interface TerrainAcquireOptions {
  /**
   * Terrain-RGB tile edge in pixels.
   *
   * @default 512
   */
  readonly tileSize?: RasterTileSize
  /**
   * Dimensionless multiplier applied to every decoded height; `1` yields
   * metres. Must be finite.
   *
   * @default 1
   */
  readonly heightModifier?: number
  /**
   * Cancels this caller's wait. The shared load is aborted only when no other
   * caller is still waiting on it.
   */
  readonly signal?: AbortSignal
}

/**
 * Options for {@linkcode GpuTileResidencyCache.acquireSatellite} and
 * {@linkcode GpuTileResidencyCache.prefetchSatelliteNeighborhood}.
 *
 * `tileSize` and `format` are part of the cache key.
 */
export interface SatelliteAcquireOptions {
  /**
   * Satellite tile edge in pixels.
   *
   * @default 512
   */
  readonly tileSize?: RasterTileSize
  /**
   * Encoded image format requested from Mapbox.
   *
   * @default 'webp'
   */
  readonly format?: SatelliteFormat
  /**
   * Cancels this caller's wait. The shared load is aborted only when no other
   * caller is still waiting on it.
   */
  readonly signal?: AbortSignal
}

/**
 * Scheduling options for
 * {@linkcode GpuTileResidencyCache.prefetchTerrainNeighborhood} and
 * {@linkcode GpuTileResidencyCache.prefetchSatelliteNeighborhood}.
 */
export interface NeighborhoodPrefetchOptions {
  /**
   * Maximum number of tiles loading at once. Must be a positive safe integer.
   *
   * @default 4
   */
  readonly concurrency?: number
  /**
   * Cancels the prefetch. Each pending tile acquisition rejects with an
   * `AbortError`, and the returned promise rejects with it.
   */
  readonly signal?: AbortSignal
}

interface CacheEntry<T> {
  readonly key: string
  readonly controller: AbortController
  readonly disposeValue: (value: T) => void
  promise: Promise<T>
  value?: T
  bytes: number
  refs: number
  lastUsed: number
  cancelled: boolean
}

type UnknownEntry = CacheEntry<unknown>

function tileKey(tile: TileId): string {
  return `${tile.z}/${tile.x}/${tile.y}`
}

function makeAbortError(): Error {
  const error = new Error('GPU tile acquisition was aborted')
  error.name = 'AbortError'
  return error
}

function assertPositiveSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
  return value
}

async function runWithConcurrency<T>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  const count = Math.min(
    assertPositiveSafeInteger(concurrency, 'concurrency'),
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

/**
 * Byte-budgeted LRU cache of decoded terrain and satellite tiles that live on
 * the GPU.
 *
 * Callers get resources through leases ({@linkcode GpuTileLease}). A leased
 * entry is pinned and never evicted; unleased resident entries are evicted
 * least-recently-used first once {@linkcode GpuResidencyCacheOptions.maxBytes}
 * or {@linkcode GpuResidencyCacheOptions.maxEntries} is exceeded. Concurrent
 * acquisitions of the same layer, tile and options share one load.
 *
 * The cache owns every resource it loads. Call
 * {@linkcode GpuTileResidencyCache.dispose} when the owning scene is torn down,
 * after disposing any session that holds leases on it.
 *
 * @throws {RangeError} From the constructor when `maxBytes` or `maxEntries`
 * is not a positive safe integer.
 */
export class GpuTileResidencyCache {
  readonly #client: MapboxRasterClient
  readonly #maxBytes: number
  readonly #maxEntries: number
  readonly #entries = new Map<string, UnknownEntry>()

  #residentBytes = 0
  #clock = 0
  #disposed = false

  constructor(
    client: MapboxRasterClient,
    options: GpuResidencyCacheOptions,
  ) {
    this.#client = client

    if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0) {
      throw new RangeError('maxBytes must be a positive safe integer')
    }

    this.#maxBytes = options.maxBytes
    this.#maxEntries = assertPositiveSafeInteger(
      options.maxEntries ?? 256,
      'maxEntries',
    )
  }

  /**
   * Current occupancy counters. Each read builds a new snapshot by walking
   * every entry.
   */
  get stats(): GpuResidencyCacheStats {
    let residentEntries = 0
    let loadingEntries = 0
    let pinnedEntries = 0

    for (const entry of this.#entries.values()) {
      if (entry.value !== undefined) {
        residentEntries += 1
      } else {
        loadingEntries += 1
      }
      if (entry.refs > 0) {
        pinnedEntries += 1
      }
    }

    return {
      maxBytes: this.#maxBytes,
      maxEntries: this.#maxEntries,
      residentBytes: this.#residentBytes,
      entries: this.#entries.size,
      residentEntries,
      loadingEntries,
      pinnedEntries,
      overBudget:
        this.#residentBytes > this.#maxBytes ||
        this.#entries.size > this.#maxEntries,
    }
  }

  /**
   * Leases the decoded Terrain-RGB tile for `tile`, loading it onto the GPU if
   * it is not already resident or loading.
   *
   * Ocean tiles resolve with a `kind: 'water'` value that holds no GPU memory.
   * Release the returned lease with {@linkcode GpuTileLease.release}.
   *
   * @throws {RangeError} Synchronously when `heightModifier` is not finite.
   * @throws {Error} Synchronously when the cache has been disposed.
   * @returns A promise that rejects with an `AbortError` when
   * `options.signal` aborts or the cache is disposed before the load finishes,
   * and with the load error when fetching or decoding fails.
   */
  acquireTerrain(
    tile: TileId,
    options: TerrainAcquireOptions = {},
  ): Promise<GpuTileLease<GpuTerrainTileResult>> {
    const tileSize = options.tileSize ?? 512
    const heightModifier = options.heightModifier ?? 1

    if (!Number.isFinite(heightModifier)) {
      throw new RangeError('heightModifier must be finite')
    }

    return this.#acquire(
      `terrain|${tileKey(tile)}|${tileSize}|${heightModifier}`,
      options.signal,
      (signal) =>
        loadTerrainTileOnGpu(this.#client, tile, {
          tileSize,
          heightModifier,
          signal,
        }),
      (value) =>
        value.kind === 'tile'
          ? estimateTerrainGpuBytes(value.value)
          : 0,
      (value) => {
        if (value.kind === 'tile') {
          value.value.dispose()
        }
      },
    )
  }

  /**
   * Leases the decoded rgba8 satellite texture for `tile`, loading it onto the
   * GPU if it is not already resident or loading. Release the returned lease
   * with {@linkcode GpuTileLease.release}.
   *
   * @throws {Error} Synchronously when the cache has been disposed.
   * @returns A promise that rejects with an `AbortError` when
   * `options.signal` aborts or the cache is disposed before the load finishes,
   * and with the load error when fetching or decoding fails.
   */
  acquireSatellite(
    tile: TileId,
    options: SatelliteAcquireOptions = {},
  ): Promise<GpuTileLease<GpuSatelliteTile>> {
    const tileSize = options.tileSize ?? 512
    const format = options.format ?? 'webp'

    return this.#acquire(
      `satellite|${tileKey(tile)}|${tileSize}|${format}`,
      options.signal,
      (signal) =>
        loadSatelliteTileOnGpu(this.#client, tile, {
          tileSize,
          format,
          signal,
        }),
      estimateSatelliteGpuBytes,
      (value) => value.dispose(),
    )
  }

  /**
   * Loads every terrain tile within `radius` tiles of `center` (a
   * `(2 * radius + 1)²` square, wrapped at the antimeridian, with rows past the
   * Mercator poles skipped) and releases each lease immediately, leaving the tiles
   * resident but unpinned. They remain subject to LRU eviction.
   *
   * @param radius Ring radius in tiles; must be a non-negative safe integer.
   * @returns A promise that resolves once every tile has loaded, and rejects
   * with the first acquisition error, an `AbortError` from `options.signal`,
   * or a `RangeError` for an invalid `radius`, `concurrency` or
   * `heightModifier`.
   */
  async prefetchTerrainNeighborhood(
    center: TileId,
    radius: number,
    options: TerrainAcquireOptions & NeighborhoodPrefetchOptions = {},
  ): Promise<void> {
    const tiles = terrainTileNeighborhood(center, radius)
    const concurrency = options.concurrency ?? 4

    await runWithConcurrency(tiles, concurrency, async (tile) => {
      const lease = await this.acquireTerrain(tile, options)
      lease.release()
    })
  }

  /**
   * Satellite counterpart of
   * {@linkcode GpuTileResidencyCache.prefetchTerrainNeighborhood}: loads every
   * satellite tile within `radius` tiles of `center` and leaves them resident
   * but unpinned.
   *
   * @param radius Ring radius in tiles; must be a non-negative safe integer.
   * @returns A promise that resolves once every tile has loaded, and rejects
   * with the first acquisition error, an `AbortError` from `options.signal`,
   * or a `RangeError` for an invalid `radius` or `concurrency`.
   */
  async prefetchSatelliteNeighborhood(
    center: TileId,
    radius: number,
    options: SatelliteAcquireOptions & NeighborhoodPrefetchOptions = {},
  ): Promise<void> {
    const tiles = terrainTileNeighborhood(center, radius)
    const concurrency = options.concurrency ?? 4

    await runWithConcurrency(tiles, concurrency, async (tile) => {
      const lease = await this.acquireSatellite(tile, options)
      lease.release()
    })
  }

  /**
   * Evicts unleased resident entries, least recently used first, until the
   * cache is back under budget or nothing else can be evicted. The cache
   * already prunes after every load and release, so most callers never need
   * this.
   *
   * @throws {Error} When the cache has been disposed.
   */
  prune(): void {
    this.#assertAlive()
    this.#prune()
  }

  /**
   * Drops every entry with no live lease, regardless of budget. Resident
   * entries are disposed; loads that no caller is waiting on are aborted.
   * Pinned entries stay.
   *
   * @throws {Error} When the cache has been disposed.
   */
  clearUnused(): void {
    this.#assertAlive()

    for (const entry of [...this.#entries.values()]) {
      if (entry.refs !== 0) {
        continue
      }

      if (entry.value === undefined) {
        entry.cancelled = true
        entry.controller.abort()
        this.#entries.delete(entry.key)
        continue
      }

      this.#evict(entry)
    }
  }

  /**
   * Terminal teardown. Aborts every in-flight load and disposes every cached
   * resource, including pinned ones, so outstanding leases point at destroyed
   * GPU objects afterwards. Dispose sessions that hold leases first. Later
   * calls to acquire, prune or clear throw. Calling it twice is a no-op.
   */
  dispose(): void {
    if (this.#disposed) {
      return
    }

    this.#disposed = true

    for (const entry of this.#entries.values()) {
      entry.cancelled = true
      entry.controller.abort()

      if (entry.value !== undefined) {
        entry.disposeValue(entry.value)
      }
    }

    this.#entries.clear()
    this.#residentBytes = 0
  }

  #assertAlive(): void {
    if (this.#disposed) {
      throw new Error('GpuTileResidencyCache has been disposed')
    }
  }

  #acquire<T>(
    key: string,
    callerSignal: AbortSignal | undefined,
    loader: (signal: AbortSignal) => Promise<T>,
    estimateBytes: (value: T) => number,
    disposeValue: (value: T) => void,
  ): Promise<GpuTileLease<T>> {
    this.#assertAlive()

    let entry = this.#entries.get(key) as CacheEntry<T> | undefined

    if (!entry) {
      const controller = new AbortController()
      entry = {
        key,
        controller,
        disposeValue,
        promise: Promise.resolve(undefined as T),
        bytes: 0,
        refs: 0,
        lastUsed: ++this.#clock,
        cancelled: false,
      }

      this.#entries.set(key, entry as UnknownEntry)

      entry.promise = (async () => {
        try {
          const value = await loader(controller.signal)

          if (
            entry?.cancelled ||
            this.#entries.get(key) !== (entry as UnknownEntry)
          ) {
            disposeValue(value)
            throw makeAbortError()
          }

          const bytes = estimateBytes(value)
          if (!Number.isSafeInteger(bytes) || bytes < 0) {
            disposeValue(value)
            throw new RangeError('estimated GPU bytes must be a safe integer')
          }

          entry.value = value
          entry.bytes = bytes
          entry.lastUsed = ++this.#clock
          this.#residentBytes += bytes
          this.#prune()

          return value
        } catch (error) {
          if (this.#entries.get(key) === (entry as UnknownEntry)) {
            this.#entries.delete(key)
          }
          throw error
        }
      })()
    }

    entry.refs += 1
    entry.lastUsed = ++this.#clock

    return this.#waitForLease(entry, callerSignal)
  }

  #waitForLease<T>(
    entry: CacheEntry<T>,
    signal?: AbortSignal,
  ): Promise<GpuTileLease<T>> {
    if (signal?.aborted) {
      this.#releaseEntry(entry)
      return Promise.reject(makeAbortError())
    }

    return new Promise<GpuTileLease<T>>((resolve, reject) => {
      let finished = false

      const cleanup = () => {
        signal?.removeEventListener('abort', onAbort)
      }

      const onAbort = () => {
        if (finished) {
          return
        }

        finished = true
        cleanup()
        this.#releaseEntry(entry)
        reject(makeAbortError())
      }

      signal?.addEventListener('abort', onAbort, { once: true })

      entry.promise.then(
        (value) => {
          if (finished) {
            return
          }

          finished = true
          cleanup()

          let released = false
          resolve({
            value,
            release: () => {
              if (released) {
                return
              }
              released = true
              this.#releaseEntry(entry)
            },
          })
        },
        (error) => {
          if (finished) {
            return
          }

          finished = true
          cleanup()
          reject(error)
        },
      )
    })
  }

  #releaseEntry<T>(entry: CacheEntry<T>): void {
    if (entry.refs > 0) {
      entry.refs -= 1
    }
    entry.lastUsed = ++this.#clock

    if (entry.refs === 0 && entry.value === undefined) {
      entry.cancelled = true
      entry.controller.abort()

      if (this.#entries.get(entry.key) === (entry as UnknownEntry)) {
        this.#entries.delete(entry.key)
      }
      return
    }

    this.#prune()
  }

  #prune(): void {
    while (
      this.#residentBytes > this.#maxBytes ||
      this.#entries.size > this.#maxEntries
    ) {
      let candidate: UnknownEntry | undefined

      for (const entry of this.#entries.values()) {
        if (entry.refs !== 0 || entry.value === undefined) {
          continue
        }

        if (!candidate || entry.lastUsed < candidate.lastUsed) {
          candidate = entry
        }
      }

      if (!candidate) {
        break
      }

      this.#evict(candidate)
    }
  }

  #evict(entry: UnknownEntry): void {
    if (entry.value === undefined || entry.refs !== 0) {
      return
    }

    if (this.#entries.get(entry.key) !== entry) {
      return
    }

    this.#entries.delete(entry.key)
    this.#residentBytes -= entry.bytes
    entry.disposeValue(entry.value)
  }
}
