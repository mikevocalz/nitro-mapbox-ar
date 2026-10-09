import type { RouteLeg } from '../../../src/navigation/route'
import type { NavigationRoutesInput } from './NavigationRoutesInput'
import type { TripSession } from './TripSession.nitro'

/**
 * Emitted after a {@linkcode TripSession} replaced its routes because the
 * traveller left the route.
 *
 * @see {@linkcode TripSession.addOnRerouteListener}
 */
export interface RerouteEvent {
  /** The new routes, in the same form {@linkcode TripSession.setRoutes} takes. */
  readonly routes: NavigationRoutesInput
  /** Legs of the new primary route. */
  readonly legs: readonly RouteLeg[]
}
