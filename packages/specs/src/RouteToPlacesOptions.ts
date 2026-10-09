import type { routeToPlaces } from './routeToPlaces'

/**
 * Options for {@linkcode routeToPlaces}.
 */
export interface RouteToPlacesOptions {
  /**
   * Metres at which each place counts as visited. The kit's own
   * `GeoPlaceInput` defaults `distanceToActivate` to 10.
   * @default 10
   * @see https://github.com/specs-devs/packages/blob/df8820c0c4970f052e545b8da1dd288c2516d912/SpecsNavigationKit/Assets/SpecsNavigationKit.lspkg/NavigationDataComponent/ManualPlaceList.ts
   */
  readonly distanceToVisit?: number
}
