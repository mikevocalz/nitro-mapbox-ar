import type { MapboxNavigationClient } from '../../../src/navigation/client'
import type { MapboxSearchClient } from '../../../src/search/client'

/**
 * The response shape the `core` HTTP clients read from a {@linkcode FetchLike}
 * call. A WHATWG `Response` satisfies it.
 */
export interface FetchLikeResponse {
  /** `true` for HTTP 2xx. */
  readonly ok: boolean
  /** HTTP status code. */
  readonly status: number
  /** Parses the body as JSON. */
  json(): Promise<unknown>
  /** Reads the body as raw bytes (tiles, imagery). */
  arrayBuffer(): Promise<ArrayBuffer>
}

/**
 * The request options the `core` HTTP clients pass to a {@linkcode FetchLike}.
 */
export interface FetchLikeInit {
  /**
   * Cancels the request when aborted. Omitted when the caller passed no
   * signal, so hosts without `AbortSignal` (Lens Studio) never receive one.
   */
  readonly signal?: AbortSignal
}

/**
 * The minimum `fetch` the `core` HTTP clients need. Pass it as `fetchImpl` to
 * {@linkcode MapboxNavigationClient} or {@linkcode MapboxSearchClient} when
 * the host has no global `fetch`, or when its `fetch` is a module, as in Lens
 * Studio. `globalThis.fetch` satisfies it.
 *
 * Proposed replacement for the current `typeof fetch` option type, which
 * requires DOM typings.
 *
 * @param url Absolute HTTPS URL, including the `access_token` query
 * parameter.
 * @param init Request options; omitted when no signal was given.
 */
export type FetchLike = (
  url: string,
  init?: FetchLikeInit,
) => Promise<FetchLikeResponse>
