import type { SpatialHostCapabilities } from './SpatialHostCapabilities'
import type { SpatialHostProbe } from './SpatialHostProbe'

/**
 * Reads {@linkcode SpatialHostCapabilities} from the running host.
 *
 * @param probe Host queries; see {@linkcode SpatialHostProbe}.
 * @throws {Error} Rejects when a probe query rejects; the message names the
 * query.
 */
export declare function getSpatialHostCapabilities(
  probe: SpatialHostProbe,
): Promise<SpatialHostCapabilities>
