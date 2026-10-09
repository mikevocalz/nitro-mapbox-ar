import type { CameraTarget } from './CameraTarget'
import type { FitBoundsOptions } from './FitBoundsOptions'

/**
 * Screen-space padding in density-independent points (iOS points, Android
 * dp). The camera centres content inside the padded area.
 *
 * @see {@linkcode CameraTarget.padding}
 * @see {@linkcode FitBoundsOptions.padding}
 */
export interface EdgeInsets {
  /** Points from the top edge. */
  top: number
  /** Points from the left edge. */
  left: number
  /** Points from the bottom edge. */
  bottom: number
  /** Points from the right edge. */
  right: number
}
