export { normalizeMapboxARConfig } from './core/config'
export { bboxCrossesAntimeridian, validateBBox } from './geo/bbox'
export {
  selectRendererBackend,
  type RendererBackend,
  type RendererCapabilities,
} from './rendering/backend'
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
