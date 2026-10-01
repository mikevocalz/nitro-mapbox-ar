export { normalizeMapboxARConfig } from './core/config'
export { bboxCrossesAntimeridian, validateBBox } from './geo/bbox'
export { getMapboxARCore, type MapboxARCore } from './native/MapboxARCore'
export {
  getGraphiteWebGPUContext,
  isGraphiteWebGPUAvailable,
  makeSkiaImageFromWebGPUTexture,
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
  decodeTerrainRgbOnGpu,
  type GpuHeightField,
  type TerrainRgbDecodeOptions,
} from './terrain/gpu/terrainRgb'
export { getTerrainGpuRoot } from './terrain/gpu/root'
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
