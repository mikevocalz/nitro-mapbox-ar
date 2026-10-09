import type { HybridObject } from 'react-native-nitro-modules'

import type { NativeNavigationCapabilities } from '../../../src/navigation/contracts'
import type { MapboxAR } from '../core/MapboxAR.nitro'
import type { TripSession } from './TripSession.nitro'
import type { TripSessionOptions } from './TripSessionOptions'

/**
 * The root of `@mikevocalz/nitro-mapbox-ar-navigation`, backed by the native
 * Mapbox Navigation SDK. Exported as the `MapboxNavigation` constant.
 *
 * Use it for turn-by-turn guidance from device location, rerouting and the
 * electronic horizon. For route planning only, the JS `NavigationSession`
 * over the Directions API needs no native SDK.
 */
export interface MapboxNavigation
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * What the linked Navigation SDK supports on this device. Shape reused
   * from the JS navigation contracts.
   */
  readonly capabilities: NativeNavigationCapabilities

  /**
   * Starts a trip session and resolves once it is ready for
   * {@linkcode TripSession.setRoutes}. One session can be active at a time.
   *
   * @throws {Error} Rejects with `Mapbox access token is not set` when
   * {@linkcode MapboxAR.accessToken} is empty.
   * @throws {Error} Rejects when `capabilities.activeGuidance` is `false`.
   * @throws {Error} Rejects when another session is active; the message says
   * to call `TripSession.stop()` first.
   * @throws {Error} Rejects when `locationSource` is `device` and location
   * permission is not granted.
   * @throws {Error} Rejects when `enableElectronicHorizon` is `true` and
   * `capabilities.electronicHorizon` is `false`.
   */
  createTripSession(options: TripSessionOptions): Promise<TripSession>
}
