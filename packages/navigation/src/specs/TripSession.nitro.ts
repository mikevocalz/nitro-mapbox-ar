import type { HybridObject } from 'react-native-nitro-modules'

import type { ElectronicHorizon } from '../types/ElectronicHorizon'
import type { ListenerSubscription } from '../types/ListenerSubscription'
import type { NavigationProgress } from '../types/NavigationProgress'
import type { NavigationRoutesInput } from '../types/NavigationRoutesInput'
import type { RerouteEvent } from '../types/RerouteEvent'
import type { TripSessionOptions } from '../types/TripSessionOptions'
import type { MapboxNavigation } from './MapboxNavigation.nitro'

/**
 * A running native trip session. Created by
 * {@linkcode MapboxNavigation.createTripSession}; ends with
 * {@linkcode TripSession.stop}. After `stop()` every method except `stop`
 * rejects with `TripSession was stopped` and listeners stop delivering.
 */
export interface TripSession
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Starts guidance along the given routes, replacing any previous ones.
   * Resolves once the SDK accepted the routes.
   *
   * @throws {Error} Rejects when `responseJson` does not parse as a
   * Directions response, `primaryRouteIndex` is out of range, `requestUrl`
   * is not a Directions request URL, the SDK's route request fails, or the
   * session was stopped.
   */
  setRoutes(routes: NavigationRoutesInput): Promise<void>

  /** Calls `listener` on each progress update, about once per second. */
  addOnProgressListener(
    listener: (progress: NavigationProgress) => void,
  ): ListenerSubscription

  /**
   * Calls `listener` after rerouting replaced the routes. Never fires when
   * {@linkcode TripSessionOptions.enableRerouting} is `false`.
   */
  addOnRerouteListener(
    listener: (event: RerouteEvent) => void,
  ): ListenerSubscription

  /**
   * Calls `listener` for failures that do not reject a call: reroute
   * requests that fail, and SDK errors while guiding.
   */
  addOnErrorListener(
    listener: (error: Error) => void,
  ): ListenerSubscription

  /**
   * Reads the road graph ahead of the traveller. Resolves `undefined` until
   * the position is matched to a road.
   *
   * @throws {Error} Rejects when the session was created without
   * {@linkcode TripSessionOptions.enableElectronicHorizon}.
   */
  getElectronicHorizon(): Promise<ElectronicHorizon | undefined>

  /** Ends the session and releases the location source. Idempotent. */
  stop(): Promise<void>
}
