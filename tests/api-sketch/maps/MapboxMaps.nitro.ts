import type { HybridObject } from 'react-native-nitro-modules'

import type { MapboxMapView } from './MapboxMapView.nitro'

/**
 * The root of `@mikevocalz/nitro-mapbox-ar-maps`. Reports whether this
 * process can render a {@linkcode MapboxMapView} at all, so apps can choose a
 * fallback before mounting one.
 *
 * Exported as the `MapboxMaps` constant.
 */
export interface MapboxMaps
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * `false` when the linked Mapbox Maps SDK has no build for this platform
   * (for example visionOS, unless the 11.32.0 xcframework ships a visionOS
   * slice). A mounted {@linkcode MapboxMapView} on such a host renders
   * nothing and reports a map loading error.
   */
  readonly isMapViewAvailable: boolean
  /** Version of the linked Mapbox Maps SDK, for example `11.32.0`. */
  readonly sdkVersion: string
}
