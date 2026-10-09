import type { AnyMap } from 'react-native-nitro-modules'

import type { MapStyle } from '../specs/MapStyle.nitro'

/**
 * Layer types from the Mapbox Style Specification.
 *
 * @see {@linkcode StyleLayer.type}
 */
export type StyleLayerType =
  | 'background'
  | 'fill'
  | 'line'
  | 'symbol'
  | 'circle'
  | 'heatmap'
  | 'fill-extrusion'
  | 'raster'
  | 'hillshade'
  | 'sky'
  | 'model'

/**
 * A style layer to add with {@linkcode MapStyle.addLayer}.
 *
 * `paint` and `layout` take Mapbox Style Specification properties by their
 * spec names, for example `{ 'line-width': 4 }`. They are untyped in this
 * version; see the API design doc for the reason.
 */
export interface StyleLayer {
  /** Layer id, unique within the style. */
  id: string
  /** Layer type. */
  type: StyleLayerType
  /** Source id. Required for every type except `background` and `sky`. */
  sourceId?: string
  /** Layer inside a vector source. Required when the source is vector. */
  sourceLayer?: string
  /** Paint properties, by Style Specification name. */
  paint?: AnyMap
  /** Layout properties, by Style Specification name. */
  layout?: AnyMap
}
