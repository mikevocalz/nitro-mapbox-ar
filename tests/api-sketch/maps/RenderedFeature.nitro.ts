import type { HybridObject } from 'react-native-nitro-modules'

import type { MapboxMapViewMethods } from './MapboxMapView.nitro'

/**
 * A feature drawn on screen at query time. Geometry and properties stay in
 * native memory until you call {@linkcode RenderedFeature.toGeoJson}.
 *
 * @see {@linkcode MapboxMapViewMethods.queryRenderedFeatures}
 */
export interface RenderedFeature
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** The feature's id, when its source assigns one. */
  readonly featureId?: string
  /** Id of the source the feature came from. */
  readonly sourceId: string
  /** Source layer, for vector sources. */
  readonly sourceLayer?: string
  /** Ids of the style layers that drew it. */
  readonly layerIds: string[]
  /**
   * Serialises the feature, geometry and properties included, as a GeoJSON
   * `Feature` string. Cost grows with the geometry size.
   */
  toGeoJson(): string
}
