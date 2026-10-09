// Sketch of the `@mikevocalz/nitro-mapbox-ar-navigation` entry.
import type { MapboxNavigation as MapboxNavigationSpec } from './MapboxNavigation.nitro'

export type { TripSession } from './TripSession.nitro'
export type { NavigationRoutesInput } from './NavigationRoutesInput'
export type { RerouteEvent } from './RerouteEvent'
export type { TripLocationSource } from './TripLocationSource'
export type { TripProgress } from './TripProgress'
export type { TripSessionOptions } from './TripSessionOptions'
/** The process-wide {@linkcode MapboxNavigationSpec} root. */
export declare const MapboxNavigation: MapboxNavigationSpec
/** Type of the {@linkcode MapboxNavigation} root. */
export type MapboxNavigation = MapboxNavigationSpec
