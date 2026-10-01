import {
  getHostComponent,
  type HybridRef,
} from 'react-native-nitro-modules'

import MapboxMapViewConfig from '../../nitrogen/generated/shared/json/MapboxMapViewConfig.json'
import type {
  MapboxMapViewMethods,
  MapboxMapViewProps,
} from '../specs/MapboxMapView.nitro'

export const MapboxMapView = getHostComponent<
  MapboxMapViewProps,
  MapboxMapViewMethods
>('MapboxMapView', () => MapboxMapViewConfig)

export type MapboxMapViewRef = HybridRef<
  MapboxMapViewProps,
  MapboxMapViewMethods
>
