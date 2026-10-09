import type { TripSessionOptions } from './TripSessionOptions'

/**
 * Where a trip session takes positions from.
 *
 * - `device`: the platform location service. Requires location permission.
 * - `replay-primary-route`: positions simulated along the primary route, for
 *   tests and hosts without location (Meta Quest).
 *
 * @see {@linkcode TripSessionOptions.locationSource}
 */
export type TripLocationSource = 'device' | 'replay-primary-route'
