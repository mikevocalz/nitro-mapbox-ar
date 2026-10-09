import type { UserPositionLike } from './UserPositionLike'

/**
 * The fields this adapter reads from a Lens Studio `GeoPosition`, as returned
 * by {@linkcode UserPositionLike.getGeoPosition}. A `GeoPosition` satisfies it.
 *
 * @see https://developers.snap.com/lens-studio/api/lens-scripting/classes/Built-In.GeoPosition.html
 */
export interface GeoPositionLike {
  /** Latitude in decimal degrees. */
  readonly latitude: number
  /** Longitude in decimal degrees. */
  readonly longitude: number
}
