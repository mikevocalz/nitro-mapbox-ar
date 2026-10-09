import { requireOptionalNativeModule } from 'expo'

/**
 * Whether this device can report its own GPS position, for
 * `ViroSpatialHostProbeOptions.hasDeviceLocation`.
 *
 * - No `ExpoLocation` native module (visionOS: the expo-horizon-location
 *   podspec declares iOS only) means no location.
 * - On Android, `gpsAvailable` is `LocationManager.isProviderEnabled(GPS_PROVIDER)`
 *   (expo-horizon-location 57.0.2, android/src/quest/.../LocationModule.kt
 *   `getProviderStatus`). Meta Quest has no GPS provider, so it is `false`
 *   there and the route stays on the table.
 * - iOS leaves `gpsAvailable` undefined (the field is `@platform android`);
 *   location services being on is the answer there.
 */
export async function hasDeviceLocation(): Promise<boolean> {
  if (requireOptionalNativeModule('ExpoLocation') === null) {
    return false
  }
  // Loaded after the check: the package calls requireNativeModule at import
  // and throws where the native module is not linked.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Location = require('expo-horizon-location') as typeof import('expo-horizon-location')
  const status = await Location.getProviderStatusAsync()
  return status.locationServicesEnabled && status.gpsAvailable !== false
}
