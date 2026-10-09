import type { createSpatialContextSnapshot } from './createSpatialContextSnapshot'
import type { SpatialRay } from './SpatialRay'
import type { GeoCoordinate } from './types'

/**
 * What the user is looking at and where, for an agent or assistant.
 *
 * Built by {@linkcode createSpatialContextSnapshot}, which drops fields the
 * host cannot produce instead of passing them through.
 */
export interface SpatialContextSnapshot {
  /** Camera position on Earth. */
  readonly camera?: GeoCoordinate
  /** Camera heading, degrees clockwise from true north. */
  readonly heading?: number
  /** Head ray; present only when the host supports gaze. */
  readonly gaze?: SpatialRay
  /** Anchors currently in view. */
  readonly visibleAnchorIds: readonly string[]
  /** Colocated peers; present only when the host supports colocation. */
  readonly peerCount?: number
  /** Application data passed through unchanged. */
  readonly metadata?: Readonly<Record<string, unknown>>
}
