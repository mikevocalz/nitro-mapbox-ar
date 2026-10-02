export {
  MapboxViroRoute,
  type MapboxViroRouteProps,
} from './MapboxViroRoute'
export {
  createReactVisionSpatialBridge,
  type ReactVisionSpatialBridge,
} from './bridge'
export {
  validateCoordinate,
  validateSurfaceOffset,
} from './geo'
export {
  chunkWorldRoute,
  projectRouteToWorld,
  type GeoProjector,
  type RouteProjectionOptions,
} from './route'
export type {
  GeoCoordinate,
  GeoWorldPosition,
  GeospatialAnchor,
  GeospatialAnchorResult,
  GeospatialEnableResult,
  ReactVisionGeospatialNavigator,
  SpatialAnchorRequest,
  ViroGeospatialPose,
  ViroQuaternion,
} from './types'

export {
  canShareColocationFrame,
  createSpatialContextSnapshot,
  getColocationFamily,
  normalizeReactVisionCapabilities,
  type ColocationFamily,
  type ReactVisionPlatform,
  type ReactVisionRuntimeCapabilities,
  type SpatialContextSnapshot,
  type SpatialRay,
} from './xr'
