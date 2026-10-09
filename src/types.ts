/**
 * A geographic bounding box in WGS84 degrees, ordered
 * `[west, south, east, north]` (longitude before latitude).
 *
 * `west > east` describes a box that crosses the antimeridian. Latitudes must
 * stay inside the Web Mercator limit of ±85.05112878°.
 *
 * @see {@linkcode TerrainLoadOptions.bbox}
 */
export type BBox = readonly [
  west: number,
  south: number,
  east: number,
  north: number,
]

/**
 * The renderer a caller asks for in {@linkcode MapboxAROptions.renderer}.
 *
 * - `'auto'` picks the first available backend in the order Graphite + WebGPU,
 *   WebGPU, Nitro CPU, JS CPU.
 * - `'graphite'` requires Skia Graphite sharing one Dawn device with WebGPU.
 * - `'webgpu'` requires WebGPU.
 * - `'nitro'` requires the Nitro C++ CPU path.
 * - `'cpu'` uses Nitro CPU when present, otherwise the JS CPU path.
 *
 * Every value other than `'auto'` is a requirement: `selectRendererBackend`
 * throws when that backend is unavailable. `normalizeMapboxARConfig` does not
 * accept `'cpu'` and throws for it.
 *
 * @see {@linkcode NormalizedMapboxARConfig.renderer}
 */
export type RendererPreference =
  | 'auto'
  | 'graphite'
  | 'webgpu'
  | 'nitro'
  | 'cpu'
/**
 * Terrain detail preset, from cheapest (`'performance'`) to most detailed
 * (`'quality'`).
 *
 * @see {@linkcode TerrainLoadOptions.quality}
 */
export type TerrainQuality = 'performance' | 'balanced' | 'quality'
/**
 * Surface texture for loaded terrain: `'satellite'` drapes Mapbox Satellite
 * imagery, `'none'` renders the bare elevation surface.
 *
 * @see {@linkcode TerrainLoadOptions.imagery}
 */
export type ImageryMode = 'satellite' | 'none'

/**
 * Tile cache budgets, in bytes.
 *
 * @see {@linkcode MapboxAROptions.cache}
 */
export interface CacheOptions {
  /**
   * In-memory cache budget in bytes. Must be a non-negative safe integer.
   *
   * @default 100663296 (96 MiB)
   */
  memoryBytes?: number
  /**
   * On-disk cache budget in bytes. Must be a non-negative safe integer.
   *
   * @default 536870912 (512 MiB)
   */
  diskBytes?: number
}

/**
 * Options a caller passes to configure Nitro Mapbox AR. The normalized form
 * with defaults applied is {@linkcode NormalizedMapboxARConfig}.
 */
export interface MapboxAROptions {
  /** Mapbox access token. Surrounding whitespace is trimmed; an empty token is rejected. */
  accessToken: string
  /**
   * Requested rendering backend.
   *
   * @default 'auto'
   */
  renderer?: RendererPreference
  /** Tile cache budgets. Omitted fields take the defaults on {@linkcode CacheOptions}. */
  cache?: CacheOptions
}

/**
 * {@linkcode MapboxAROptions} after validation, with the token trimmed and
 * every default filled in.
 */
export interface NormalizedMapboxARConfig {
  /** Trimmed, non-empty Mapbox access token. */
  accessToken: string
  /** Requested rendering backend, `'auto'` when the caller gave none. */
  renderer: RendererPreference
  /** Resolved tile cache budgets. */
  cache: {
    /** In-memory cache budget in bytes. */
    memoryBytes: number
    /** On-disk cache budget in bytes. */
    diskBytes: number
  }
}

/** Describes the terrain area to load and how to render it. */
export interface TerrainLoadOptions {
  /** Area to load, `[west, south, east, north]` in WGS84 degrees. */
  bbox: BBox
  /** Surface texture draped over the terrain. */
  imagery?: ImageryMode
  /** Vertical scale multiplier for elevations; `1` keeps true scale. */
  exaggeration?: number
  /** Terrain detail preset. */
  quality?: TerrainQuality
}
