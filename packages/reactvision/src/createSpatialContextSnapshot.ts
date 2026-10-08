import type { SpatialContextSnapshot } from './SpatialContextSnapshot'
import type { SpatialHostCapabilities } from './SpatialHostCapabilities'

/**
 * Builds a {@linkcode SpatialContextSnapshot}, keeping only what the host
 * can produce: `gaze` is dropped unless
 * {@linkcode SpatialHostCapabilities.supportsGaze}, and `peerCount` unless
 * {@linkcode SpatialHostCapabilities.supportsColocation}.
 */
export function createSpatialContextSnapshot(
  capabilities: SpatialHostCapabilities,
  input: SpatialContextSnapshot,
): SpatialContextSnapshot {
  return {
    camera: input.camera,
    heading: input.heading,
    gaze: capabilities.supportsGaze ? input.gaze : undefined,
    visibleAnchorIds: input.visibleAnchorIds,
    peerCount: capabilities.supportsColocation ? input.peerCount : undefined,
    metadata: input.metadata,
  }
}
