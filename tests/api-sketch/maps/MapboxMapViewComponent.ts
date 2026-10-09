import type {
  HybridRef,
  ReactNativeView,
} from 'react-native-nitro-modules'

import type {
  MapboxMapViewMethods,
  MapboxMapViewProps,
} from './MapboxMapView.nitro'

/**
 * The host component for the native map, from `getHostComponent`. Pass
 * function props through Nitro's `callback(...)`.
 *
 * @see {@linkcode MapboxMapViewProps}
 */
export declare const MapboxMapView: ReactNativeView<
  MapboxMapViewProps,
  MapboxMapViewMethods
>

/**
 * The object `hybridRef` receives: props plus
 * {@linkcode MapboxMapViewMethods}.
 */
export type MapboxMapViewRef = HybridRef<
  MapboxMapViewProps,
  MapboxMapViewMethods
>
