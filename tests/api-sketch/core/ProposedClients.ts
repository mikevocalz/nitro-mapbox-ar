import type { MapboxNavigationClient as CurrentNavigationClient } from '../../../src/navigation/client'
import type { MapboxSearchClient as CurrentSearchClient } from '../../../src/search/client'
import type { HttpClientOptions } from './HttpClientOptions'

/**
 * Directions and Map Matching over HTTP. Same methods as today's
 * `src/navigation/client.ts` class; the constructor takes
 * {@linkcode HttpClientOptions}.
 *
 * @throws {Error} From the constructor when the token is blank, or when no
 * `fetchImpl` is given and the host has no `globalThis.fetch`.
 */
export declare const MapboxNavigationClient: new (
  options: HttpClientOptions,
) => CurrentNavigationClient

/** Instance type of {@linkcode MapboxNavigationClient}. */
export type MapboxNavigationClient = CurrentNavigationClient

/**
 * Search Box and Geocoding over HTTP. Same methods as today's
 * `src/search/client.ts` class; the constructor takes
 * {@linkcode HttpClientOptions}.
 *
 * @throws {Error} From the constructor under the same conditions as
 * {@linkcode MapboxNavigationClient}.
 */
export declare const MapboxSearchClient: new (
  options: HttpClientOptions,
) => CurrentSearchClient

/** Instance type of {@linkcode MapboxSearchClient}. */
export type MapboxSearchClient = CurrentSearchClient
