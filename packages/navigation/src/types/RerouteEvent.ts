import type { TripSession } from '../specs/TripSession.nitro'
import type { NavigationRoutesInput } from './NavigationRoutesInput'
import type { RouteLeg } from './RouteLeg'

/**
 * Emitted after a {@linkcode TripSession} replaced its routes because the
 * traveller left the route.
 *
 * @see {@linkcode TripSession.addOnRerouteListener}
 */
export interface RerouteEvent {
  /**
   * The new primary route in the form {@linkcode TripSession.setRoutes}
   * takes: a one-route response and the request URL rebuilt from the SDK's
   * route options. The URL carries the access token: never log it.
   */
  readonly routes: NavigationRoutesInput
  /** Legs of the new primary route. */
  readonly legs: RouteLeg[]
}
