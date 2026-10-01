export { normalizeMapboxARConfig } from './core/config'
export { bboxCrossesAntimeridian, validateBBox } from './geo/bbox'
export { getMapboxARCore, type MapboxARCore } from './native/MapboxARCore'
export {
  MapboxRasterClient,
  terrainRgbSourceZoom,
  type MapboxRasterClientOptions,
  type MapboxTileBytes,
  type RasterTileSize,
  type SatelliteFormat,
  type TerrainTileResult,
} from './mapbox/raster'
export {
  latToTileY,
  lonToTileX,
  tilesForBBox,
  type TileId,
} from './mapbox/tiles'
export {
  getGraphiteWebGPUContext,
  isGraphiteWebGPUAvailable,
  makeSkiaImageFromWebGPUTexture,
  makeWebGPUTextureFromEncodedBytes,
  type AdoptedWebGPUTexture,
  type DecodedGraphiteTexture,
  type GraphiteWebGPUContext,
  type NativeWebGPUTexture,
  type SharedGraphiteDevice,
} from './rendering/graphite'
export {
  selectRendererBackend,
  type RendererBackend,
  type RendererCapabilities,
} from './rendering/backend'
export {
  estimateSatelliteGpuBytes,
  estimateTerrainGpuBytes,
  type TerrainGpuFootprint,
} from './terrain/cache/budget'
export {
  terrainTileNeighborhood,
} from './terrain/cache/neighborhood'
export {
  GpuTileResidencyCache,
  type GpuResidencyCacheOptions,
  type GpuResidencyCacheStats,
  type GpuTileLease,
  type NeighborhoodPrefetchOptions,
  type SatelliteAcquireOptions,
  type TerrainAcquireOptions,
} from './terrain/cache/residency'
export {
  loadTerrainTileOnGpu,
  type GpuTerrainTile,
  type GpuTerrainTileResult,
} from './terrain/gpu/tile'
export {
  decodeTerrainRgbOnGpu,
  type GpuHeightField,
  type TerrainRgbDecodeOptions,
} from './terrain/gpu/terrainRgb'
export { getTerrainGpuRoot } from './terrain/gpu/root'
export {
  loadSatelliteTileOnGpu,
  type GpuSatelliteTile,
} from './terrain/gpu/imagery'
export {
  getTerrainGridLayout,
  tileCenterLatitude,
  tileGroundSpanMeters,
  tileMetersPerPixel,
  tileSampleSpacingMeters,
  type TerrainGridLayout,
} from './terrain/gpu/grid'
export {
  createTerrainTileRenderer,
  type TerrainTileFrameOptions,
  type TerrainTileRenderer,
  type TerrainTileRendererOptions,
} from './terrain/gpu/draw'
export {
  createTerrainRenderTarget,
  type TerrainRenderTarget,
  type TerrainRenderTargetOptions,
} from './terrain/gpu/target'
export {
  getLocalTileOffset,
  makeTranslationMatrix,
  multiplyMatrix4,
  wrappedTileDeltaX,
  type LocalTileOffset,
  type Matrix4Like,
} from './terrain/gpu/multitile'
export {
  createTerrainBatchRenderer,
  type RenderedTerrainBatchFrame,
  type RenderedTerrainBatchItem,
  type TerrainBatchEntry,
  type TerrainBatchFrameOptions,
  type TerrainBatchItemContext,
  type TerrainBatchRenderer,
  type TerrainBatchRendererOptions,
  type TerrainBatchValue,
} from './terrain/gpu/batch'
export {
  createTerrainSurfaceRenderer,
  type Matrix4,
  type RenderedTerrainFrame,
  type TerrainFrameOptions,
  type TerrainSurfaceRenderer,
  type TerrainSurfaceRendererOptions,
  type Vec3,
  type Vec4,
} from './terrain/gpu/surface'
export type {
  BBox,
  CacheOptions,
  ImageryMode,
  MapboxAROptions,
  NormalizedMapboxARConfig,
  RendererPreference,
  TerrainLoadOptions,
  TerrainQuality,
} from './types'

export {
  SpatialTileSession,
  type SpatialTileSessionCache,
  type SpatialTileSessionEntry,
  type SpatialTileSessionOptions,
  type SpatialTileSessionSnapshot,
} from './session/spatialTileSession'

export {
  MapboxSearchClient,
  type ForwardSearchOptions,
  type GeocodeOptions,
  type LngLat,
  type MapboxSearchClientOptions,
  type RetrieveOptions,
  type SearchFeature,
  type SearchFeatureCollection,
  type SearchSuggestion,
  type SuggestOptions,
} from './search/client'
export {
  getSpatialSearchAnchor,
  type SpatialSearchAnchor,
} from './search/anchor'
