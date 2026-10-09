import type {
  ElectronicHorizonSnapshot,
  NativeNavigationProvider,
  NavigationProgressSnapshot,
  NavigationRoute,
} from '@mikevocalz/nitro-mapbox-ar/core'

import type { MapboxNavigation } from './specs/MapboxNavigation.nitro'
import type { TripSession } from './specs/TripSession.nitro'
import type { ListenerSubscription } from './types/ListenerSubscription'
import type { NavigationProgress } from './types/NavigationProgress'
import type { TripSessionOptions } from './types/TripSessionOptions'

/**
 * Adapts {@linkcode MapboxNavigation} to the `NativeNavigationProvider`
 * contract of `@mikevocalz/nitro-mapbox-ar`, so one `NavigationSession` plans
 * routes in JS and guides along them natively:
 *
 * ```ts
 * const session = new NavigationSession({
 *   client,
 *   nativeProvider: createNativeNavigationProvider(MapboxNavigation, { locationSource: 'device' }),
 * })
 * ```
 *
 * - `startTripSession()` creates a {@linkcode TripSession} with `options` and
 *   sends it the route given to `setRoute`.
 * - `setRoute(route, source)` needs `source`, which `NavigationSession.planRoute`
 *   supplies: the native SDK rebuilds routes from the request URL.
 * - `getProgress()` resolves the last progress event with `route` added back,
 *   or `null` before the first one.
 * - `stopTripSession()` removes the listener and stops the session.
 *
 * `errorListener` receives the session's non-rejecting failures (failed
 * reroutes, SDK errors while guiding).
 *
 * @throws {Error} From `setRoute` when `source` is missing.
 */
export function createNativeNavigationProvider(
  navigation: MapboxNavigation,
  options: TripSessionOptions,
  errorListener?: (error: Error) => void,
): NativeNavigationProvider {
  let trip: TripSession | undefined
  let subscriptions: ListenerSubscription[] = []
  let route: NavigationRoute | null = null
  let input: { responseJson: string; requestUrl: string; primaryRouteIndex: number } | undefined
  let progress: NavigationProgress | undefined

  return {
    capabilities: navigation.capabilities,

    async startTripSession() {
      if (trip !== undefined) return
      const created = await navigation.createTripSession(options)
      trip = created
      subscriptions = [
        created.addOnProgressListener((value) => {
          progress = value
        }),
      ]
      if (errorListener !== undefined) {
        subscriptions.push(created.addOnErrorListener(errorListener))
      }
      if (input !== undefined) await created.setRoutes(input)
    },

    async stopTripSession() {
      const current = trip
      trip = undefined
      progress = undefined
      for (const subscription of subscriptions) subscription.remove()
      subscriptions = []
      if (current !== undefined) await current.stop()
    },

    async setRoute(next, source) {
      route = next
      progress = undefined
      if (next === null) {
        input = undefined
        return
      }
      if (source === undefined) {
        throw new Error('createNativeNavigationProvider needs the Directions request URL; plan the route with NavigationSession.planRoute')
      }
      // The SDK re-requests routes from the URL; responseJson only has to
      // describe the same routes, with the chosen one at routeIndex.
      const routes = Array.from({ length: source.routeIndex + 1 }, () => next)
      input = {
        responseJson: JSON.stringify({ code: 'Ok', routes }),
        requestUrl: source.requestUrl,
        primaryRouteIndex: source.routeIndex,
      }
      if (trip !== undefined) await trip.setRoutes(input)
    },

    async getProgress(): Promise<NavigationProgressSnapshot | null> {
      if (progress === undefined || route === null) return null
      const { upcomingManeuver: _upcoming, location, ...rest } = progress
      return {
        ...rest,
        location: { longitude: location.longitude, latitude: location.latitude },
        route,
      }
    },

    async getElectronicHorizon(): Promise<ElectronicHorizonSnapshot | null> {
      if (trip === undefined) return null
      return (await trip.getElectronicHorizon()) ?? null
    },
  }
}
