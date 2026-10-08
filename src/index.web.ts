export { normalizeMapboxARConfig } from './core/config'
export { bboxCrossesAntimeridian, validateBBox } from './geo/bbox'
export {
  getMapboxARCore,
  type MapboxARCore,
} from './native/MapboxARCore.web'
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
  selectRendererBackend,
  type RendererBackend,
  type RendererCapabilities,
} from './rendering/backend'
export {
  getBrowserRendererCapabilities,
  isBrowserWebGPUAvailable,
} from './web/capabilities'
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
export {
  MapboxNavigationClient,
  type DirectionsAnnotation,
  type DirectionsOptions,
  type DirectionsResponse,
  type MapboxNavigationClientOptions,
  type MapMatchingOptions,
  type MapMatchingResponse,
  type NavigationCoordinate,
  type NavigationProfile,
  type NavigationRoute,
  type NavigationRouteLeg,
  type RouteGeometryCoordinate,
  type RouteLegAnnotation,
  routeGeometryToCoordinates,
} from './navigation/client'
export {
  summarizeRouteTraffic,
  type RouteTrafficSummary,
} from './navigation/traffic'
export type {
  ElectronicHorizonEdge,
  ElectronicHorizonSnapshot,
  NativeNavigationCapabilities,
  NativeNavigationProvider,
  NavigationProgressSnapshot,
} from './navigation/contracts'
export {
  NavigationSession,
  type NavigationSessionOptions,
  type PlannedRoute,
} from './navigation/session'
export {
  SpatialAgentRuntime,
  type SpatialAgentRuntimeOptions,
} from './agent/runtime'
export type {
  MapboxAgentToolkitBridge,
  SpatialAgentAction,
  SpatialAgentAuditEvent,
  SpatialAgentContext,
  SpatialAgentEffects,
  SpatialAgentPermissionPolicy,
} from './agent/types'
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
  MapboxAdvancedNavigationClient,
  type AdvancedNavigationClientOptions,
  type EvRouteOptions,
  type IsochroneOptions,
  type MatrixOptions,
  type OptimizationV1Options,
  type OptimizationV2Response,
  type OptimizationV2Submission,
} from './navigation/advanced'
export type {
  IndoorAnchor,
  IndoorLevel,
  IndoorNavigationHandoff,
  IndoorProvider,
  IndoorRoute,
  IndoorTransition,
  IndoorVenue,
} from './indoor/contracts'

export {
  createFeatureSet,
  getMapboxFeature,
  listMapboxFeatures,
  type EnabledFeatureSet,
  type MapboxFeatureDescriptor,
  type MapboxFeatureId,
  type MapboxFeatureStatus,
} from './experimental/registry'
