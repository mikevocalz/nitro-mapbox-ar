import type { MapboxNavigation } from './MapboxNavigation.nitro'
import type { TripSession } from './TripSession.nitro'
import type { TripLocationSource } from './TripLocationSource'

/**
 * Settings fixed for the life of a {@linkcode TripSession}.
 *
 * @see {@linkcode MapboxNavigation.createTripSession}
 */
export interface TripSessionOptions {
  /** Position source. @default 'device' */
  locationSource?: TripLocationSource
  /**
   * Request a new route when the traveller leaves the current one.
   * @default true
   */
  enableRerouting?: boolean
  /**
   * Track the road graph ahead. Required for
   * {@linkcode TripSession.getElectronicHorizon}. @default false
   */
  enableElectronicHorizon?: boolean
}
