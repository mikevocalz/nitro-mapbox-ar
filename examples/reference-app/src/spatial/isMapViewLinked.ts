import { NitroModules } from 'react-native-nitro-modules'

/**
 * Whether the native MapboxMapView is linked into this build.
 *
 * The maps podspec is iOS-only because CocoaPods' MapboxMaps 11.32.0 spec
 * declares `platforms: { ios: 14.0 }`, so the visionOS Podfile skips it and
 * the view is never registered. Nitrogen registers it as "MapboxMapView"
 * (packages/native-mapbox/nitrogen/generated/ios/NitroMapboxARNativeMapAutolinking.mm).
 *
 * Replace with `MapboxMaps.isMapViewAvailable` once the maps root lands.
 */
export function isMapViewLinked(): boolean {
  return NitroModules.hasHybridObject('MapboxMapView')
}
