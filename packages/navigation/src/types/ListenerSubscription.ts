import type { TripSession } from '../specs/TripSession.nitro'

/**
 * Cleanup handle returned by every `addOn...Listener` method, for example
 * {@linkcode TripSession.addOnProgressListener}. Each registration owns its
 * own handle; removing one listener never affects another.
 */
export interface ListenerSubscription {
  /**
   * Stops future deliveries to the listener this handle was returned for.
   * Idempotent. An event already being dispatched may still reach the
   * listener once.
   */
  readonly remove: () => void
}
