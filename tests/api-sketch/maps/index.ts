// Sketch of the `@mikevocalz/nitro-mapbox-ar-maps` entry.
import type { MapboxMaps as MapboxMapsSpec } from './MapboxMaps.nitro'

export { MapboxMapView, type MapboxMapViewRef } from './MapboxMapViewComponent'
export type {
  MapboxMapView as MapboxMapViewSpec,
  MapboxMapViewMethods,
  MapboxMapViewProps,
} from './MapboxMapView.nitro'
export type { MapStyle } from './MapStyle.nitro'
export type { PointAnnotationManager } from './PointAnnotationManager.nitro'
export type { RenderedFeature } from './RenderedFeature.nitro'
export type { CameraAnimationEnd } from './CameraAnimationEnd'
export type { CameraAnimationOptions } from './CameraAnimationOptions'
export type { CameraState } from './CameraState'
export type { CameraTarget } from './CameraTarget'
export type { CoordinateBounds } from './CoordinateBounds'
export type { EdgeInsets } from './EdgeInsets'
export type { FitBoundsOptions } from './FitBoundsOptions'
export type { MapCapabilities } from './MapCapabilities'
export type { MapProjection } from './MapProjection'
export type { MapTapEvent } from './MapTapEvent'
export type { PointAnnotation } from './PointAnnotation'
export type { RenderedFeatureQuery } from './RenderedFeatureQuery'
export type { ScreenBox } from './ScreenBox'
export type { ScreenPoint } from './ScreenPoint'
export type { StandardLightPreset, StandardStyleConfig } from './StandardStyleConfig'
export type { StyleLayer, StyleLayerType } from './StyleLayer'
export type { GeoJsonSource } from './GeoJsonSource'
export type { RasterDemSource } from './RasterDemSource'
export type { VectorSource } from './VectorSource'
export type { TerrainOptions } from './TerrainOptions'
export { MapStyles } from './MapStyles'
/** The process-wide {@linkcode MapboxMapsSpec} root. */
export declare const MapboxMaps: MapboxMapsSpec
/** Type of the {@linkcode MapboxMaps} root. */
export type MapboxMaps = MapboxMapsSpec
