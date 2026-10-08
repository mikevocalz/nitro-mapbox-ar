import type { GeoPositionLike } from './GeoPositionLike'
import type { userPositionToProgress } from './userPositionToProgress'

/**
 * The members {@linkcode userPositionToProgress} reads from the Navigation
 * Kit's `UserPosition` (from `NavigationDataComponent.getUserPosition()`).
 * The kit's `UserPosition` satisfies it.
 *
 * @see https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/component-list
 * @see https://github.com/specs-devs/packages/blob/df8820c0c4970f052e545b8da1dd288c2516d912/SpecsNavigationKit/Assets/SpecsNavigationKit.lspkg/NavigationDataComponent/UserPosition.ts
 */
export interface UserPositionLike {
  /**
   * The user's position; `null` when location services are not working.
   */
  getGeoPosition(): GeoPositionLike | null
  /**
   * The user's north-aligned orientation in radians: zero is true north,
   * increasing clockwise. The kit negates it when running in the Lens Studio
   * editor.
   */
  getBearing(): number
}
