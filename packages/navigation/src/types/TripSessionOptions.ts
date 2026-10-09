import type { MapboxNavigation } from '../specs/MapboxNavigation.nitro'
import type { TripSession } from '../specs/TripSession.nitro'
import type { TripLocationSource } from './TripLocationSource'

/**
 * Settings fixed for the life of a {@linkcode TripSession}.
 *
 * @see {@linkcode MapboxNavigation.createTripSession}
 */
export interface TripSessionOptions {
  /** Position source. @default 'device' */
  readonly locationSource?: TripLocationSource
  /**
   * Request a new route when the traveller leaves the current one.
   * @default true
   */
  readonly enableRerouting?: boolean
  /**
   * Track the road graph ahead. Required for
   * {@linkcode TripSession.getElectronicHorizon}. @default false
   */
  readonly enableElectronicHorizon?: boolean
}
