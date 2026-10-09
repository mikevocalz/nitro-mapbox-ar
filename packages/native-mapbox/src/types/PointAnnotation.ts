import type { GeographicCoordinate } from './GeographicCoordinate'
import type { PointAnnotationManager } from '../specs/PointAnnotationManager.nitro'

/**
 * A marker drawn by a {@linkcode PointAnnotationManager}.
 *
 * @see {@linkcode PointAnnotationManager.setAnnotations}
 */
export interface PointAnnotation {
  /** Id, unique within its manager. Tap listeners receive it. */
  id: string
  /** Position. `altitude` is ignored. */
  coordinate: GeographicCoordinate
  /** Id of an image already in the style. Omit for a text-only marker. */
  iconImageId?: string
  /** Label drawn next to the icon. */
  text?: string
}
