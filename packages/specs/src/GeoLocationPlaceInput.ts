import type { routeToPlaces } from './routeToPlaces'

/**
 * The plain values for one Navigation Kit `GeoLocationPlace`, produced by
 * {@linkcode routeToPlaces}. The Lens script supplies the Lens-only arguments
 * (`icon: Texture`, `userPosition: UserPosition`) and builds the place:
 *
 * ```ts
 * const geoPosition = GeoPosition.create()
 * geoPosition.latitude = input.latitude
 * geoPosition.longitude = input.longitude
 * if (input.altitude !== undefined) geoPosition.altitude = input.altitude
 * navigation.addPlace(new GeoLocationPlace(
 *   geoPosition, input.distanceToVisit, input.name, icon, input.description,
 *   navigation.getUserPosition(),
 * ))
 * ```
 *
 * The constructor order `(geoPosition, distanceToVisit, name, icon,
 * description, userPosition)` is the one in the kit's source; the component
 * list page does not document the constructor.
 *
 * @see https://github.com/specs-devs/packages/blob/df8820c0c4970f052e545b8da1dd288c2516d912/SpecsNavigationKit/Assets/SpecsNavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace.ts
 * @see https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/component-list
 */
export interface GeoLocationPlaceInput {
  /**
   * Latitude in decimal degrees, for `GeoPosition.latitude`.
   * @see https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.GeoPosition.html
   */
  readonly latitude: number
  /**
   * Longitude in decimal degrees, for `GeoPosition.longitude`.
   * @see https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.GeoPosition.html
   */
  readonly longitude: number
  /**
   * Metres above sea level, for `GeoPosition.altitude`. Absent when the route
   * has no elevation; leave `GeoPosition.altitude` at its default of 0.
   * @see https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.GeoPosition.html
   */
  readonly altitude?: number
  /**
   * Metres from the place at which the kit marks it visited (the
   * `distanceToVisit` constructor argument; the place is visited once the
   * user is closer than this).
   * @see https://github.com/specs-devs/packages/blob/df8820c0c4970f052e545b8da1dd288c2516d912/SpecsNavigationKit/Assets/SpecsNavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace.ts
   */
  readonly distanceToVisit: number
  /**
   * The place's `name`: the manoeuvre instruction, for example
   * "Turn left onto Broadway".
   * @see https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/component-list
   */
  readonly name: string
  /**
   * The place's `description`: the street the step travels along; empty when
   * the route has no name for it.
   * @see https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/component-list
   */
  readonly description: string
}
