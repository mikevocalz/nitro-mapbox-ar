import type { TripSession } from '../specs/TripSession.nitro'
import type { ElectronicHorizonEdge } from './ElectronicHorizonEdge'

/**
 * The road graph ahead of the traveller, from
 * {@linkcode TripSession.getElectronicHorizon}. Same fields as
 * `ElectronicHorizonSnapshot` in `@mikevocalz/nitro-mapbox-ar`.
 */
export interface ElectronicHorizon {
  /** Id of the edge the traveller is on, as a decimal string. */
  readonly edgeId: string
  /** Share of that edge already travelled, 0 to 1. */
  readonly percentAlong: number
  /** The edge the traveller is on, then every edge reachable from it, depth first. */
  readonly edges: ElectronicHorizonEdge[]
}
