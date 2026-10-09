import { NitroModules } from 'react-native-nitro-modules'

import type { MapboxNavigation as MapboxNavigationSpec } from './specs/MapboxNavigation.nitro'

/** The process-wide Navigation SDK root. */
export const MapboxNavigation = NitroModules.createHybridObject<MapboxNavigationSpec>('MapboxNavigation')
/** Type of the {@linkcode MapboxNavigation} root. */
export type MapboxNavigation = MapboxNavigationSpec

export type { MapboxNavigation as MapboxNavigationSpec } from './specs/MapboxNavigation.nitro'
export type { TripSession } from './specs/TripSession.nitro'
export type { ElectronicHorizon } from './types/ElectronicHorizon'
export type { ElectronicHorizonEdge } from './types/ElectronicHorizonEdge'
export type { GeographicCoordinate } from './types/GeographicCoordinate'
export type { ListenerSubscription } from './types/ListenerSubscription'
export type { NativeNavigationCapabilities } from './types/NativeNavigationCapabilities'
export type { NavigationManeuver } from './types/NavigationManeuver'
export type { NavigationProgress } from './types/NavigationProgress'
export type { NavigationRoutesInput } from './types/NavigationRoutesInput'
export type { RerouteEvent } from './types/RerouteEvent'
export type { RouteLeg } from './types/RouteLeg'
export type { RouteStep } from './types/RouteStep'
export type { TripLocationSource } from './types/TripLocationSource'
export type { TripSessionOptions } from './types/TripSessionOptions'
export { createNativeNavigationProvider } from './createNativeNavigationProvider'
export { toCoreRouteLegs } from './toCoreRouteLegs'
