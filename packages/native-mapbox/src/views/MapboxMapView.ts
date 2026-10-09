import {
  getHostComponent,
  type HybridRef,
} from 'react-native-nitro-modules'

import MapboxMapViewConfig from '../../nitrogen/generated/shared/json/MapboxMapViewConfig.json'
import type {
  MapboxMapViewMethods,
  MapboxMapViewProps,
} from '../specs/MapboxMapView.nitro'

/**
 * The host component for the native map, from `getHostComponent`. Pass
 * function props, including `hybridRef`, through Nitro's `callback(...)`.
 *
 * @see {@linkcode MapboxMapViewProps}
 * @see {@linkcode MapboxMapViewMethods}
 */
export const MapboxMapView = getHostComponent<
  MapboxMapViewProps,
  MapboxMapViewMethods
>('MapboxMapView', () => MapboxMapViewConfig)

/**
 * The object `hybridRef` receives: props plus
 * {@linkcode MapboxMapViewMethods}.
 */
export type MapboxMapViewRef = HybridRef<
  MapboxMapViewProps,
  MapboxMapViewMethods
>
