import { NitroModules } from 'react-native-nitro-modules'

import type { MapboxMaps as MapboxMapsSpec } from './specs/MapboxMaps.nitro'

/** The process-wide {@linkcode MapboxMapsSpec} root. */
export const MapboxMaps = NitroModules.createHybridObject<MapboxMapsSpec>('MapboxMaps')
/** Type of the {@linkcode MapboxMaps} root. */
export type MapboxMaps = MapboxMapsSpec

export type { MapboxMaps as MapboxMapsSpec } from './specs/MapboxMaps.nitro'
export { MapboxMapView, type MapboxMapViewRef } from './views/MapboxMapView'
export { MapStyles } from './MapStyles'
export type {
  MapboxMapView as MapboxMapViewSpec,
  MapboxMapViewMethods,
  MapboxMapViewProps,
} from './specs/MapboxMapView.nitro'
export type { MapStyle } from './specs/MapStyle.nitro'
export type { PointAnnotationManager } from './specs/PointAnnotationManager.nitro'
export type { RenderedFeature } from './specs/RenderedFeature.nitro'
export type { CameraAnimationEnd } from './types/CameraAnimationEnd'
export type { CameraAnimationOptions } from './types/CameraAnimationOptions'
export type { CameraState } from './types/CameraState'
export type { CameraTarget } from './types/CameraTarget'
export type { CoordinateBounds } from './types/CoordinateBounds'
export type { EdgeInsets } from './types/EdgeInsets'
export type { FitBoundsOptions } from './types/FitBoundsOptions'
export type { GeoJsonSource } from './types/GeoJsonSource'
export type { GeographicCoordinate } from './types/GeographicCoordinate'
export type { ListenerSubscription } from './types/ListenerSubscription'
export type { MapCapabilities } from './types/MapCapabilities'
export type { MapProjection } from './types/MapProjection'
export type { MapTapEvent } from './types/MapTapEvent'
export type { PointAnnotation } from './types/PointAnnotation'
export type { RasterDemSource } from './types/RasterDemSource'
export type { RenderedFeatureQuery } from './types/RenderedFeatureQuery'
export type { ScreenBox } from './types/ScreenBox'
export type { ScreenPoint } from './types/ScreenPoint'
export type { StandardLightPreset, StandardStyleConfig } from './types/StandardStyleConfig'
export type { StyleLayer, StyleLayerType } from './types/StyleLayer'
export type { TerrainOptions } from './types/TerrainOptions'
export type { VectorSource } from './types/VectorSource'
