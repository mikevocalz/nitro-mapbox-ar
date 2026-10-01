import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules'

export interface MapCamera {
  latitude: number
  longitude: number
  zoom: number
  bearing: number
  pitch: number
}

export interface MapboxMapViewProps extends HybridViewProps {
  accessToken: string
  styleURI: string
  camera: MapCamera
}

export interface MapboxMapViewMethods extends HybridViewMethods {
  setCamera(camera: MapCamera): void
  getCamera(): MapCamera
  loadStyle(styleURI: string): void
}

export type MapboxMapView = HybridView<
  MapboxMapViewProps,
  MapboxMapViewMethods
>
