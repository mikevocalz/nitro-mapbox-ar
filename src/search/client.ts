import type { FetchLike, FetchLikeResponse } from '../navigation/client'
import { defaultFetch, requestInit } from '../core/transport'

/**
 * A WGS84 position used to bias search results.
 *
 * @see {@linkcode SuggestOptions.proximity}
 */
export interface LngLat {
  /** Degrees east of the prime meridian. Must be finite. */
  readonly longitude: number
  /** Degrees north of the equator. Must be finite. */
  readonly latitude: number
}

/**
 * One Search Box `/suggest` result, from {@linkcode MapboxSearchClient.suggest}.
 * It has no coordinates; pass `mapbox_id` to
 * {@linkcode MapboxSearchClient.retrieve} to get the full feature. Fields
 * not listed here pass through from the API unchanged.
 */
export interface SearchSuggestion {
  /** Mapbox ID of the place; the `id` argument for `retrieve`. */
  readonly mapbox_id: string
  /** Display name of the place or address. */
  readonly name: string
  /** Kind of result, such as `poi`, `address` or `place`. */
  readonly feature_type?: string
  /** Street address line, when the result has one. */
  readonly address?: string
  /** Address with locality, region and country appended. */
  readonly full_address?: string
  /** Formatted context for the result, such as city, region and country. */
  readonly place_formatted?: string
  readonly [key: string]: unknown
}

/**
 * A GeoJSON feature returned by {@linkcode MapboxSearchClient.retrieve},
 * {@linkcode MapboxSearchClient.forward} or
 * {@linkcode MapboxSearchClient.geocode}. Fields not listed here pass through
 * from the API unchanged.
 *
 * @see {@linkcode SearchFeatureCollection.features}
 */
export interface SearchFeature {
  /** Always `Feature`. */
  readonly type: 'Feature'
  /** Mapbox ID of the feature, when the API sends one. */
  readonly id?: string
  /** The feature's GeoJSON geometry. */
  readonly geometry?: {
    /** GeoJSON geometry type, `Point` for search results. */
    readonly type?: string
    /** `[longitude, latitude]` in degrees for a `Point`. */
    readonly coordinates?: readonly number[]
  }
  /**
   * Place data from the API, such as name, address, context and, for
   * Geocoding v6 with `entrances: true`, `coordinates.routable_points`.
   */
  readonly properties?: Record<string, unknown>
  readonly [key: string]: unknown
}

/**
 * The GeoJSON body of a Search Box `/retrieve` or `/forward` response or a
 * Geocoding v6 `/forward` response, as parsed. The client does not validate
 * its shape.
 */
export interface SearchFeatureCollection {
  /** Always `FeatureCollection`. */
  readonly type: 'FeatureCollection'
  /** Matching features, best match first; empty when nothing matched. */
  readonly features: readonly SearchFeature[]
  /** Attribution text sent by Mapbox with the results. */
  readonly attribution?: string
  /** Mapbox's identifier for this response. */
  readonly response_id?: string
}

/**
 * Constructor options for {@linkcode MapboxSearchClient}.
 */
export interface MapboxSearchClientOptions {
  /** Mapbox access token. Empty or blank throws. */
  readonly accessToken: string
  /**
   * HTTP transport. Required on hosts without `globalThis.fetch`, such as
   * Lens Studio.
   * @default globalThis.fetch
   */
  readonly fetchImpl?: FetchLike
}

/**
 * Options for {@linkcode MapboxSearchClient.suggest}.
 */
export interface SuggestOptions {
  /**
   * Groups `suggest` and `retrieve` calls into one billed Search Box session.
   * Use the same token for a run of suggestions and the `retrieve` that ends
   * it. Blank throws.
   */
  readonly sessionToken: string
  /** Result language as an ISO 639-1 code, such as `en`. Omitted: the API default. */
  readonly language?: string
  /**
   * Maximum suggestions, an integer from 1 to 10. Omitted: the API default.
   * Out of range throws a `RangeError`.
   */
  readonly limit?: number
  /**
   * Biases results toward a position, or toward the caller's IP location with
   * `'ip'`. Non-finite coordinates throw a `RangeError`.
   */
  readonly proximity?: LngLat | 'ip'
  /** Limits results to these ISO 3166 alpha-2 country codes. Empty means no limit. */
  readonly country?: readonly string[]
  /** Limits results to these Search Box feature types, such as `poi` or `address`. */
  readonly types?: readonly string[]
  /** Limits POI results to these Mapbox category IDs, sent as `poi_category`. */
  readonly poiCategories?: readonly string[]
  /** Aborts the HTTP request; the returned promise then rejects. */
  readonly signal?: AbortSignal
}

/**
 * Options for {@linkcode MapboxSearchClient.retrieve}.
 */
export interface RetrieveOptions {
  /**
   * The session token used for the `suggest` calls this retrieve completes.
   * Blank throws.
   */
  readonly sessionToken: string
  /** Result language as an ISO 639-1 code, such as `en`. Omitted: the API default. */
  readonly language?: string
  /** Extra Search Box attribute sets to include, sent as `attribute_sets`. */
  readonly attributeSets?: readonly ('photos' | 'visit' | 'venue')[]
  /** Position to bias the result toward. Non-finite coordinates throw a `RangeError`. */
  readonly proximity?: LngLat
  /** Aborts the HTTP request; the returned promise then rejects. */
  readonly signal?: AbortSignal
}

/**
 * Options for {@linkcode MapboxSearchClient.forward}.
 */
export interface ForwardSearchOptions {
  /** Result language as an ISO 639-1 code, such as `en`. Omitted: the API default. */
  readonly language?: string
  /**
   * Maximum results, an integer from 1 to 10. Omitted: the API default. Out
   * of range throws a `RangeError`.
   */
  readonly limit?: number
  /**
   * Biases results toward a position, or toward the caller's IP location with
   * `'ip'`. Non-finite coordinates throw a `RangeError`.
   */
  readonly proximity?: LngLat | 'ip'
  /** Limits results to these ISO 3166 alpha-2 country codes. Empty means no limit. */
  readonly country?: readonly string[]
  /** Limits results to these Search Box feature types, such as `poi` or `address`. */
  readonly types?: readonly string[]
  /** Aborts the HTTP request; the returned promise then rejects. */
  readonly signal?: AbortSignal
}

/**
 * Options for {@linkcode MapboxSearchClient.geocode}.
 */
export interface GeocodeOptions {
  /** Result language as an ISO 639-1 code, such as `en`. Omitted: the API default. */
  readonly language?: string
  /**
   * Maximum results, an integer from 1 to 10. Omitted: the API default. Out
   * of range throws a `RangeError`.
   */
  readonly limit?: number
  /**
   * Biases results toward a position, or toward the caller's IP location with
   * `'ip'`. Non-finite coordinates throw a `RangeError`.
   */
  readonly proximity?: LngLat | 'ip'
  /** Limits results to these ISO 3166 alpha-2 country codes. Empty means no limit. */
  readonly country?: readonly string[]
  /** Limits results to these Geocoding v6 feature types, such as `address` or `place`. */
  readonly types?: readonly string[]
  /**
   * Asks for building entrances as routable points named `entrance`, which
   * `getSpatialSearchAnchor` prefers.
   * @default false
   */
  readonly entrances?: boolean
  /**
   * Requests permanent geocoding, sent as `permanent=true`. Use it for
   * results you store; Mapbox bills it separately from temporary geocoding.
   * @default false
   */
  readonly permanent?: boolean
  /** Aborts the HTTP request; the returned promise then rejects. */
  readonly signal?: AbortSignal
}

const SEARCH_BOX = 'https://api.mapbox.com/search/searchbox/v1'
const GEOCODING_V6 = 'https://api.mapbox.com/search/geocode/v6'

function token(value: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('A Mapbox access token is required')
  return normalized
}

function queryText(value: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('Search text cannot be empty')
  if (normalized.length > 256) throw new RangeError('Search text cannot exceed 256 characters')
  return normalized
}

function addLngLat(params: URLSearchParams, key: string, value: LngLat | 'ip' | undefined): void {
  if (!value) return
  if (value === 'ip') {
    params.set(key, 'ip')
    return
  }

  if (!Number.isFinite(value.longitude) || !Number.isFinite(value.latitude)) {
    throw new RangeError(`${key} coordinates must be finite`)
  }

  params.set(key, `${value.longitude},${value.latitude}`)
}

function addList(params: URLSearchParams, key: string, value: readonly string[] | undefined): void {
  if (value?.length) params.set(key, value.join(','))
}

function addLimit(params: URLSearchParams, limit: number | undefined): void {
  if (limit === undefined) return
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10) {
    throw new RangeError('Search limit must be an integer between 1 and 10')
  }
  params.set('limit', String(limit))
}

/**
 * Search Box and Geocoding over HTTP.
 *
 * @throws {Error} From the constructor when the token is blank, or when no
 * `fetchImpl` is given and the host has no `globalThis.fetch`.
 */
export class MapboxSearchClient {
  readonly #accessToken: string
  readonly #fetch: FetchLike

  constructor(options: MapboxSearchClientOptions) {
    this.#accessToken = token(options.accessToken)
    this.#fetch = defaultFetch(options.fetchImpl)
  }

  /**
   * Autocomplete suggestions from Search Box `GET /search/searchbox/v1/suggest`.
   *
   * @param query Search text; trimmed, 1 to 256 characters.
   * @returns The suggestions, or an empty array when the response has none.
   * @throws {RangeError} (as a rejection) When `query` exceeds 256 characters,
   * `limit` is out of range or `proximity` is not finite.
   * @throws {Error} (as a rejection) When `query` or `sessionToken` is blank,
   * or the API answers with a non-2xx status.
   */
  async suggest(query: string, options: SuggestOptions): Promise<readonly SearchSuggestion[]> {
    if (!options.sessionToken.trim()) throw new Error('sessionToken is required for suggestions')

    const params = new URLSearchParams({
      q: queryText(query),
      session_token: options.sessionToken,
      access_token: this.#accessToken,
    })

    if (options.language) params.set('language', options.language)
    addLimit(params, options.limit)
    addLngLat(params, 'proximity', options.proximity)
    addList(params, 'country', options.country)
    addList(params, 'types', options.types)
    addList(params, 'poi_category', options.poiCategories)

    const response = await this.#fetch(
      `${SEARCH_BOX}/suggest?${params}`,
      ...requestInit(options.signal),
    )
    const data = await this.#json(response, 'Search Box suggest')
    const suggestions = (data as { suggestions?: SearchSuggestion[] }).suggestions
    return suggestions ?? []
  }

  /**
   * The full feature for a suggestion, from Search Box
   * `GET /search/searchbox/v1/retrieve/{id}`.
   *
   * @param id The {@linkcode SearchSuggestion.mapbox_id} to look up.
   * @throws {Error} Synchronously when `id` or `sessionToken` is blank; the
   * promise rejects on a non-2xx status.
   * @throws {RangeError} Synchronously when `proximity` is not finite.
   */
  retrieve(id: string, options: RetrieveOptions): Promise<SearchFeatureCollection> {
    if (!id.trim()) throw new Error('Search result id cannot be empty')
    if (!options.sessionToken.trim()) throw new Error('sessionToken is required for retrieve')

    const params = new URLSearchParams({
      session_token: options.sessionToken,
      access_token: this.#accessToken,
    })

    if (options.language) params.set('language', options.language)
    addLngLat(params, 'proximity', options.proximity)
    addList(params, 'attribute_sets', options.attributeSets)

    return this.#featureCollection(
      `${SEARCH_BOX}/retrieve/${encodeURIComponent(id)}?${params}`,
      'Search Box retrieve',
      options.signal,
    )
  }

  /**
   * One-shot text search from Search Box `GET /search/searchbox/v1/forward`.
   * Needs no session token.
   *
   * @param query Search text; trimmed, 1 to 256 characters.
   * @throws {Error} Synchronously when `query` is blank; the promise rejects
   * on a non-2xx status.
   * @throws {RangeError} Synchronously when `query` exceeds 256 characters,
   * `limit` is out of range or `proximity` is not finite.
   */
  forward(query: string, options: ForwardSearchOptions = {}): Promise<SearchFeatureCollection> {
    const params = new URLSearchParams({
      q: queryText(query),
      access_token: this.#accessToken,
    })

    if (options.language) params.set('language', options.language)
    addLimit(params, options.limit)
    addLngLat(params, 'proximity', options.proximity)
    addList(params, 'country', options.country)
    addList(params, 'types', options.types)

    return this.#featureCollection(
      `${SEARCH_BOX}/forward?${params}`,
      'Search Box forward',
      options.signal,
    )
  }

  /**
   * Forward geocoding of an address or place name from Geocoding v6
   * `GET /search/geocode/v6/forward`.
   *
   * @param query Address or place text; trimmed, 1 to 256 characters.
   * @throws {Error} Synchronously when `query` is blank; the promise rejects
   * on a non-2xx status.
   * @throws {RangeError} Synchronously when `query` exceeds 256 characters,
   * `limit` is out of range or `proximity` is not finite.
   */
  geocode(query: string, options: GeocodeOptions = {}): Promise<SearchFeatureCollection> {
    const params = new URLSearchParams({
      q: queryText(query),
      access_token: this.#accessToken,
    })

    if (options.language) params.set('language', options.language)
    addLimit(params, options.limit)
    addLngLat(params, 'proximity', options.proximity)
    addList(params, 'country', options.country)
    addList(params, 'types', options.types)
    if (options.entrances) params.set('entrances', 'true')
    if (options.permanent) params.set('permanent', 'true')

    return this.#featureCollection(
      `${GEOCODING_V6}/forward?${params}`,
      'Geocoding v6 forward',
      options.signal,
    )
  }

  async #featureCollection(
    url: string,
    label: string,
    signal?: AbortSignal,
  ): Promise<SearchFeatureCollection> {
    const response = await this.#fetch(url, ...requestInit(signal))
    return (await this.#json(response, label)) as SearchFeatureCollection
  }

  async #json(response: FetchLikeResponse, label: string): Promise<unknown> {
    if (!response.ok) {
      throw new Error(`${label} failed with HTTP ${response.status}`)
    }
    return response.json()
  }
}
