import type { FetchLike } from '../navigation/client'

/**
 * Resolves the transport for a core HTTP client: the given one, else
 * `globalThis.fetch`.
 *
 * @throws {Error} When none is given and the host has no `globalThis.fetch`.
 */
export function defaultFetch(fetchImpl: FetchLike | undefined): FetchLike {
  if (fetchImpl) return fetchImpl
  const global = (globalThis as { fetch?: FetchLike }).fetch
  if (!global) {
    throw new Error('No fetch implementation is available; pass fetchImpl')
  }
  return global
}

/**
 * The arguments after the URL for a {@linkcode FetchLike} call: none when the
 * caller passed no signal, so hosts without `AbortSignal` never see one.
 */
export function requestInit(
  signal: AbortSignal | undefined,
): [] | [{ readonly signal: AbortSignal }] {
  return signal ? [{ signal }] : []
}
