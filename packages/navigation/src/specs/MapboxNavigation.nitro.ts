import type { HybridObject } from 'react-native-nitro-modules'

import type { NativeNavigationCapabilities } from '../types/NativeNavigationCapabilities'
import type { TripSessionOptions } from '../types/TripSessionOptions'
import type { TripSession } from './TripSession.nitro'

/**
 * The root of `@mikevocalz/nitro-mapbox-ar-navigation`, backed by the native
 * Mapbox Navigation SDK. Exported as the `MapboxNavigation` constant.
 *
 * Use it for turn-by-turn progress from device location, rerouting, the
 * electronic horizon and replayed drives. For route planning only, the JS
 * `NavigationSession` over the Directions API needs no native SDK.
 *
 * The access token is `MapboxAR.accessToken` from `@mikevocalz/nitro-mapbox-ar`,
 * read when a session is created.
 */
export interface MapboxNavigation
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** What the linked Navigation SDK supports on this device. */
  readonly capabilities: NativeNavigationCapabilities

  /**
   * Starts a trip session and resolves once it is ready for
   * {@linkcode TripSession.setRoutes}. One session can be active at a time.
   *
   * @throws {Error} Rejects with `Mapbox access token is not set
   * (MapboxNavigation.createTripSession)` when `MapboxAR.accessToken` is empty.
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
