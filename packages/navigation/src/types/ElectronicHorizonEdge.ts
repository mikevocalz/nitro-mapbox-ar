import type { ElectronicHorizon } from './ElectronicHorizon'
import type { GeographicCoordinate } from './GeographicCoordinate'

/**
 * One road-graph edge ahead of the traveller. Same fields as
 * `ElectronicHorizonEdge` in `@mikevocalz/nitro-mapbox-ar`; `id` is always a
 * decimal string because native edge ids are unsigned 64-bit integers that a
 * JS number cannot hold exactly.
 *
 * @see {@linkcode ElectronicHorizon.edges}
 */
export interface ElectronicHorizonEdge {
  /** Native edge id, as a decimal string. */
  readonly id: string
  /** 0 for the most probable path, higher for branches off it. */
  readonly level: number
  /** Probability, 0 to 1, that the traveller takes this edge. */
  readonly probability: number
  /** The edge's geometry, when the road graph has it. */
  readonly shape?: GeographicCoordinate[]
}
