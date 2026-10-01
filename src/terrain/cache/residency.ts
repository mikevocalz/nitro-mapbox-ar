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

export interface GpuTileLease<T> {
  readonly value: T
  release(): void
}

export interface GpuResidencyCacheOptions {
  readonly maxBytes: number
  readonly maxEntries?: number
}

export interface GpuResidencyCacheStats {
  readonly maxBytes: number
  readonly maxEntries: number
  readonly residentBytes: number
  readonly entries: number
  readonly residentEntries: number
  readonly loadingEntries: number
  readonly pinnedEntries: number
  readonly overBudget: boolean
}

export interface TerrainAcquireOptions {
  readonly tileSize?: RasterTileSize
  readonly heightModifier?: number
  readonly signal?: AbortSignal
}

export interface SatelliteAcquireOptions {
  readonly tileSize?: RasterTileSize
  readonly format?: SatelliteFormat
  readonly signal?: AbortSignal
}

export interface NeighborhoodPrefetchOptions {
  readonly concurrency?: number
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

  prune(): void {
    this.#assertAlive()
    this.#prune()
  }

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
