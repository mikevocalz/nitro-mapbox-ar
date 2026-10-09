import type { ScreenPoint } from './ScreenPoint'
import type { RenderedFeatureQuery } from './RenderedFeatureQuery'

/**
 * An axis-aligned rectangle in the map view.
 *
 * @see {@linkcode RenderedFeatureQuery.area}
 */
export interface ScreenBox {
  /** Top-left corner. */
  min: ScreenPoint
  /** Bottom-right corner; each coordinate must be at least `min`'s. */
  max: ScreenPoint
}
