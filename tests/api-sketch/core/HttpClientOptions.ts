import type { FetchLike } from './FetchLike'
import type { MapboxNavigationClient, MapboxSearchClient } from './ProposedClients'

/**
 * Proposed constructor options shared by the `core` HTTP clients,
 * {@linkcode MapboxNavigationClient} and {@linkcode MapboxSearchClient}.
 * Widens today's `fetchImpl?: typeof fetch` to {@linkcode FetchLike}.
 */
export interface HttpClientOptions {
  /** Mapbox access token. Required; empty or blank throws. */
  readonly accessToken: string
  /**
   * HTTP transport. Required on hosts without `globalThis.fetch`.
   * @default globalThis.fetch
   */
  readonly fetchImpl?: FetchLike
}
