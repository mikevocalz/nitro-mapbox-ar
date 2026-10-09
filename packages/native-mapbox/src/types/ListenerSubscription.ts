import type { MapboxMapViewMethods } from '../specs/MapboxMapView.nitro'
import type { PointAnnotationManager } from '../specs/PointAnnotationManager.nitro'

/**
 * Cleanup handle returned by every `addOn...Listener` method in this
 * package, for example
 * {@linkcode MapboxMapViewMethods.addOnCameraChangedListener} and
 * {@linkcode PointAnnotationManager.addOnAnnotationTapListener}.
 *
 * Each registration owns its own handle; removing one listener never affects
 * another caller's listener. Same shape as the core package's
 * `ListenerSubscription`; Nitrogen generates one struct per package.
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
