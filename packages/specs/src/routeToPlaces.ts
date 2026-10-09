import {
  mapboxRouteLegs,
  type NavigationRoute,
} from '@mikevocalz/nitro-mapbox-ar/core'

import type { GeoLocationPlaceInput } from './GeoLocationPlaceInput'
import type { RouteToPlacesOptions } from './RouteToPlacesOptions'

const DEFAULT_DISTANCE_TO_VISIT_M = 10

/**
 * Turns a Mapbox route into the ordered inputs for Navigation Kit
 * `NavigationDataComponent.addPlace`: one place per manoeuvre, in travel
 * order, ending at the final arrival. `depart` manoeuvres are dropped because
 * each sits where the previous leg arrived (or where the user starts).
 *
 * `addPlace` keeps places in insertion order, so adding the result in order
 * and navigating to each in turn walks the route.
 *
 * @param route A route from `MapboxNavigationClient.directions` (which
 * requests `steps: true`).
 * @throws {TypeError} When a leg has no steps or a manoeuvre location is not
 * two numbers.
 * @throws {RangeError} When a location is outside WGS84 bounds, or
 * `distanceToVisit` is not a positive finite number.
 * @see https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/component-list
 */
export function routeToPlaces(
  route: NavigationRoute,
  options: RouteToPlacesOptions = {},
): GeoLocationPlaceInput[] {
  const distanceToVisit = options.distanceToVisit ?? DEFAULT_DISTANCE_TO_VISIT_M
  if (!Number.isFinite(distanceToVisit) || distanceToVisit <= 0) {
    throw new RangeError('distanceToVisit must be a positive number of metres')
  }

  return mapboxRouteLegs(route)
    .flatMap((leg) => leg.steps)
    .filter((step) => step.maneuver.kind !== 'depart')
    .map((step) => {
      const { latitude, longitude, altitude } = step.maneuver.location
      return {
        latitude,
        longitude,
        ...(altitude === undefined ? {} : { altitude }),
        distanceToVisit,
        name: step.maneuver.instruction,
        description: step.streetName,
      }
    })
}
