import type { MapboxNavigation } from '../specs/MapboxNavigation.nitro'

/**
 * What the linked Navigation SDK supports on this device. Same fields as
 * `NativeNavigationCapabilities` in `@mikevocalz/nitro-mapbox-ar`, so a
 * `NavigationSession` can report them unchanged.
 *
 * @see {@linkcode MapboxNavigation.capabilities}
 */
export interface NativeNavigationCapabilities {
  /** Turn-by-turn progress from a trip session. */
  readonly activeGuidance: boolean
  /** New routes when the traveller leaves the current one. */
  readonly rerouting: boolean
  /** Periodic traffic and ETA refresh of the active route. */
  readonly trafficRefresh: boolean
  /** Live incidents on the route. */
  readonly incidents: boolean
  /** Background download of tiles near the route. */
  readonly predictiveCaching: boolean
  /** Downloaded regions for routing without a connection. */
  readonly offlineRegions: boolean
  /** The road graph ahead, through {@linkcode MapboxNavigation.createTripSession} with `enableElectronicHorizon`. */
  readonly electronicHorizon: boolean
}
