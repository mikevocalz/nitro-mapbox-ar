import type { MapboxMapViewMethods } from './MapboxMapView.nitro'
import type { ScreenBox } from './ScreenBox'
import type { ScreenPoint } from './ScreenPoint'

/**
 * Which rendered features to return.
 *
 * @see {@linkcode MapboxMapViewMethods.queryRenderedFeatures}
 */
export interface RenderedFeatureQuery {
  /** A point or a box in the view. Must lie inside the view's bounds. */
  area: ScreenPoint | ScreenBox
  /**
   * Restrict results to these style layer ids. Omit to query every layer.
   * An empty array is invalid.
   */
  layerIds?: string[]
}
