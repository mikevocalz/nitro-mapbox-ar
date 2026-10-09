import type { MapboxMapViewMethods } from '../maps/MapboxMapView.nitro'
import type { TripSession } from '../navigation/TripSession.nitro'

/**
 * Cleanup handle returned by every `addOn...Listener` method in the
 * nitro-mapbox-ar packages, for example
 * {@linkcode MapboxMapViewMethods.addOnCameraChangedListener} and
 * {@linkcode TripSession.addOnProgressListener}.
 *
 * Each registration owns its own handle; removing one listener never affects
 * another caller's listener.
 */
export interface ListenerSubscription {
  /**
   * Stops future deliveries to the listener this handle was returned for.
   * Idempotent: calling it twice, or after the owning object was released, is
   * a no-op. An event already being dispatched when `remove()` runs may still
   * reach the listener once.
   */
  remove: () => void
}
