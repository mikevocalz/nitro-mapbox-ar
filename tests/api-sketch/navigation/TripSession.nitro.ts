import type { HybridObject } from 'react-native-nitro-modules'

import type { ElectronicHorizonSnapshot } from '../../../src/navigation/contracts'
import type { ListenerSubscription } from '../core/ListenerSubscription'
import type { MapboxNavigation } from './MapboxNavigation.nitro'
import type { NavigationRoutesInput } from './NavigationRoutesInput'
import type { RerouteEvent } from './RerouteEvent'
import type { TripProgress } from './TripProgress'
import type { TripSessionOptions } from './TripSessionOptions'

/**
 * A running native trip session. Created by
 * {@linkcode MapboxNavigation.createTripSession}; ends with
 * {@linkcode TripSession.stop}. After `stop()` every method rejects with
 * `TripSession was stopped` and listeners stop delivering.
 */
export interface TripSession
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Starts guidance along the given routes, replacing any previous ones.
   *
   * @throws {Error} Rejects when `responseJson` does not parse as a
   * Directions response, `primaryRouteIndex` is out of range, or the
   * session was stopped.
   */
  setRoutes(routes: NavigationRoutesInput): Promise<void>

  /** Calls `listener` on each progress update, about once per second. */
  addOnProgressListener(
    listener: (progress: TripProgress) => void,
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
   * requests that fail, and a location source that stops.
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
  getElectronicHorizon(): Promise<ElectronicHorizonSnapshot | undefined>

  /** Ends the session and releases the location source. Idempotent. */
  stop(): Promise<void>
}
