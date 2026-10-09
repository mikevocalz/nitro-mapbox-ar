import type { MapboxNavigationClient } from '../../../src/navigation/client'
import type { TripSession } from './TripSession.nitro'

/**
 * A Directions API response handed to the native Navigation SDK, which needs
 * the raw JSON and the request URL to rebuild route options for rerouting.
 *
 * @see {@linkcode TripSession.setRoutes}
 * @see {@linkcode MapboxNavigationClient.directions}
 */
export interface NavigationRoutesInput {
  /** The Directions API response body, unmodified. */
  responseJson: string
  /** The request URL that produced it, including its query string. */
  requestUrl: string
  /** Index into `routes` of the route to guide along. @default 0 */
  primaryRouteIndex?: number
}
