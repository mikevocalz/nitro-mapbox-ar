import type { TripSession } from '../specs/TripSession.nitro'

/**
 * A Directions API response handed to a {@linkcode TripSession}.
 *
 * The native SDKs do not take a finished response from outside: both rebuild
 * routes from the request. The session parses `requestUrl` into route options
 * and asks the SDK's router for routes with the same options. `responseJson`
 * is checked (it must parse, contain `routes`, and have
 * `primaryRouteIndex` in range) but the routes guided along come from the
 * SDK's request, so ETAs can differ slightly from the JS response.
 *
 * `MapboxNavigationClient.directionsWithRequestUrl` in
 * `@mikevocalz/nitro-mapbox-ar` returns both values.
 *
 * @see {@linkcode TripSession.setRoutes}
 */
export interface NavigationRoutesInput {
  /** The Directions API response body, unmodified. */
  readonly responseJson: string
  /**
   * The request URL that produced it, including its query string. It carries
   * the access token: never log it. The session never logs it.
   */
  readonly requestUrl: string
  /** Index into `routes` of the route to guide along. @default 0 */
  readonly primaryRouteIndex?: number
}
