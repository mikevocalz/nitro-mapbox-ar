import {
  getHostComponent,
  type HybridRef,
  type ViewConfig,
} from 'react-native-nitro-modules'

import type {
  MapboxMapViewMethods,
  MapboxMapViewProps,
} from '../specs/MapboxMapView.nitro'

const config: ViewConfig<MapboxMapViewProps> = {
  uiViewClassName: 'MapboxMapView',
  supportsRawText: false,
  bubblingEventTypes: {},
  directEventTypes: {},
  validAttributes: {
    accessToken: true,
    styleURI: true,
    camera: true,
    hybridRef: true,
  },
}

export const MapboxMapView = getHostComponent<
  MapboxMapViewProps,
  MapboxMapViewMethods
>('MapboxMapView', () => config)

export type MapboxMapViewRef = HybridRef<
  MapboxMapViewProps,
  MapboxMapViewMethods
>
