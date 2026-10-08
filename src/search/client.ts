import type { FetchLike, FetchLikeResponse } from '../navigation/client'
import { defaultFetch, requestInit } from '../core/transport'

export interface LngLat {
  readonly longitude: number
  readonly latitude: number
}

export interface SearchSuggestion {
  readonly mapbox_id: string
  readonly name: string
  readonly feature_type?: string
  readonly address?: string
  readonly full_address?: string
  readonly place_formatted?: string
  readonly [key: string]: unknown
}

export interface SearchFeature {
  readonly type: 'Feature'
  readonly id?: string
  readonly geometry?: {
    readonly type?: string
    readonly coordinates?: readonly number[]
  }
  readonly properties?: Record<string, unknown>
  readonly [key: string]: unknown
}

export interface SearchFeatureCollection {
  readonly type: 'FeatureCollection'
  readonly features: readonly SearchFeature[]
  readonly attribution?: string
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

export interface SuggestOptions {
  readonly sessionToken: string
  readonly language?: string
  readonly limit?: number
  readonly proximity?: LngLat | 'ip'
  readonly country?: readonly string[]
  readonly types?: readonly string[]
  readonly poiCategories?: readonly string[]
  readonly signal?: AbortSignal
}

export interface RetrieveOptions {
  readonly sessionToken: string
  readonly language?: string
  readonly attributeSets?: readonly ('photos' | 'visit' | 'venue')[]
  readonly proximity?: LngLat
  readonly signal?: AbortSignal
}

export interface ForwardSearchOptions {
  readonly language?: string
  readonly limit?: number
  readonly proximity?: LngLat | 'ip'
  readonly country?: readonly string[]
  readonly types?: readonly string[]
  readonly signal?: AbortSignal
}

export interface GeocodeOptions {
  readonly language?: string
  readonly limit?: number
  readonly proximity?: LngLat | 'ip'
  readonly country?: readonly string[]
  readonly types?: readonly string[]
  readonly entrances?: boolean
  readonly permanent?: boolean
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
