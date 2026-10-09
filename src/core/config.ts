import type {
  MapboxAROptions,
  NormalizedMapboxARConfig,
  RendererPreference,
} from '../types'

const DEFAULT_MEMORY_CACHE_BYTES = 96 * 1024 * 1024
const DEFAULT_DISK_CACHE_BYTES = 512 * 1024 * 1024

const rendererPreferences = new Set<RendererPreference>([
  'auto',
  'graphite',
  'webgpu',
  'nitro',
  'cpu',
])

function normalizeByteBudget(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback
  }

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`)
  }

  return value
}

/**
 * Validates {@linkcode MapboxAROptions} and fills in defaults: renderer
 * `'auto'`, a 96 MiB memory cache and a 512 MiB disk cache.
 *
 * @throws {Error} When the access token is empty after trimming, or the
 * renderer is not one of the {@linkcode RendererPreference} values.
 * @throws {RangeError} When a cache budget is not a non-negative safe integer.
 * @see {@linkcode NormalizedMapboxARConfig}
 */
export function normalizeMapboxARConfig(
  options: MapboxAROptions,
): NormalizedMapboxARConfig {
  const accessToken = options.accessToken.trim()
  if (accessToken.length === 0) {
    throw new Error('A Mapbox access token is required')
  }

  const renderer = options.renderer ?? 'auto'
  if (!rendererPreferences.has(renderer)) {
    throw new Error(`Unsupported renderer preference: ${renderer}`)
  }

  return {
    accessToken,
    renderer,
    cache: {
      memoryBytes: normalizeByteBudget(
        options.cache?.memoryBytes,
        DEFAULT_MEMORY_CACHE_BYTES,
        'cache.memoryBytes',
      ),
      diskBytes: normalizeByteBudget(
        options.cache?.diskBytes,
        DEFAULT_DISK_CACHE_BYTES,
        'cache.diskBytes',
      ),
    },
  }
}
