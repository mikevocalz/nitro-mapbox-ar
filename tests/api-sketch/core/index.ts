// Sketch of the `@mikevocalz/nitro-mapbox-ar` native entry. Barrel plus the
// one-line Nitro root; `declare` stands in for
// `NitroModules.createHybridObject<MapboxAR>('MapboxAR')`.
import type { MapboxAR as MapboxARSpec } from './MapboxAR.nitro'

export type { ListenerSubscription } from './ListenerSubscription'
/** The process-wide {@linkcode MapboxARSpec} root. */
export declare const MapboxAR: MapboxARSpec
/** Type of the {@linkcode MapboxAR} root. */
export type MapboxAR = MapboxARSpec
