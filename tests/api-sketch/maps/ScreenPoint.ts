import type { MapTapEvent } from './MapTapEvent'
import type { RenderedFeatureQuery } from './RenderedFeatureQuery'

/**
 * A point in the map view, in density-independent points from the top-left
 * corner.
 *
 * @see {@linkcode MapTapEvent.point}
 * @see {@linkcode RenderedFeatureQuery.area}
 */
export interface ScreenPoint {
  /** Points from the left edge. */
  x: number
  /** Points from the top edge. */
  y: number
}
