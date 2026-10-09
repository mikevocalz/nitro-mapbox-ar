import type { SpatialContextSnapshot } from './SpatialContextSnapshot'
import type { GeoWorldPosition } from './types'

/**
 * A head ray in Viro world space, with the hit it produced if any.
 *
 * @see {@linkcode SpatialContextSnapshot.gaze}
 */
export interface SpatialRay {
  /** Ray origin, metres. */
  readonly origin: GeoWorldPosition
  /** Unit direction. */
  readonly direction: GeoWorldPosition
  /** First hit along the ray, metres. */
  readonly hitPoint?: GeoWorldPosition
  /** Id of the node the ray hit. */
  readonly targetId?: string
}
