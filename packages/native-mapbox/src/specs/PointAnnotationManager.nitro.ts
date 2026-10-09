import type { HybridObject } from 'react-native-nitro-modules'

import type { ListenerSubscription } from '../types/ListenerSubscription'
import type { MapboxMapViewMethods } from './MapboxMapView.nitro'
import type { PointAnnotation } from '../types/PointAnnotation'

/**
 * A group of {@linkcode PointAnnotation} markers drawn as one style layer.
 * Survives style reloads; released with its map view.
 *
 * Created by {@linkcode MapboxMapViewMethods.createPointAnnotationManager}.
 * Call {@linkcode PointAnnotationManager.removeFromMap} when done; after that
 * every method rejects.
 */
export interface PointAnnotationManager
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Manager id; also the id of the style layer it draws. */
  readonly id: string

  /**
   * Replaces every annotation in this manager.
   *
   * @throws {Error} Rejects when two annotations share an `id`, a coordinate
   * is outside WGS84 bounds, or the manager was removed.
   */
  setAnnotations(annotations: PointAnnotation[]): Promise<void>

  /**
   * Calls `listener` with the {@linkcode PointAnnotation.id} of each tapped
   * annotation. Taps on annotations do not reach
   * {@linkcode MapboxMapViewMethods.addOnMapTapListener}.
   */
  addOnAnnotationTapListener(
    listener: (annotationId: string) => void,
  ): ListenerSubscription

  /**
   * Removes the layer and its annotations from the map. Idempotent. Listener
   * subscriptions stop delivering.
   */
  removeFromMap(): Promise<void>
}
