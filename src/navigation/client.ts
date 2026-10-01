export interface NavigationCoordinate {
  readonly longitude: number
  readonly latitude: number
}

export type NavigationProfile =
  | 'driving-traffic'
  | 'driving'
  | 'walking'
  | 'cycling'

export type DirectionsAnnotation =
  | 'distance'
  | 'duration'
  | 'speed'
  | 'congestion'
  | 'congestion_numeric'
  | 'maxspeed'
  | 'closure'

export interface DirectionsOptions {
  readonly profile?: NavigationProfile
  readonly alternatives?: boolean
  readonly steps?: boolean
  readonly language?: string
  readonly annotations?: readonly DirectionsAnnotation[]
  readonly exclude?: readonly string[]
  readonly continueStraight?: boolean
  readonly signal?: AbortSignal
}

export interface MapMatchingOptions {
  readonly profile?: NavigationProfile
  readonly steps?: boolean
  readonly tidy?: boolean
  readonly radiuses?: readonly (number | null)[]
  readonly timestamps?: readonly number[]
  readonly signal?: AbortSignal
}

export interface RouteLegAnnotation {
  readonly distance?: readonly number[]
  readonly duration?: readonly number[]
  readonly speed?: readonly number[]
  readonly congestion?: readonly string[]
  readonly congestion_numeric?: readonly (number | null)[]
  readonly closure?: readonly unknown[]
  readonly [key: string]: unknown
}

export interface NavigationRouteLeg {
  readonly distance: number
  readonly duration: number
  readonly annotation?: RouteLegAnnotation
  readonly steps?: readonly unknown[]
  readonly [key: string]: unknown
}

export interface NavigationRoute {
  readonly distance: number
  readonly duration: number
  readonly duration_typical?: number
  readonly weight?: number
  readonly weight_name?: string
  readonly geometry?: unknown
  readonly legs: readonly NavigationRouteLeg[]
  readonly [key: string]: unknown
}

export interface DirectionsResponse {
  readonly code: string
  readonly routes: readonly NavigationRoute[]
  readonly waypoints?: readonly unknown[]
  readonly uuid?: string
  readonly [key: string]: unknown
}

export interface MapMatchingResponse {
  readonly code: string
  readonly matchings?: readonly NavigationRoute[]
  readonly tracepoints?: readonly unknown[]
  readonly [key: string]: unknown
}

export interface MapboxNavigationClientOptions {
  readonly accessToken: string
  readonly fetchImpl?: typeof fetch
}

const DIRECTIONS = 'https://api.mapbox.com/directions/v5/mapbox'
const MATCHING = 'https://api.mapbox.com/matching/v5/mapbox'

function accessToken(value: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('A Mapbox access token is required')
  return normalized
}

function coordinate(value: NavigationCoordinate): string {
  if (!Number.isFinite(value.longitude) || !Number.isFinite(value.latitude)) {
    throw new RangeError('Navigation coordinates must be finite')
  }
  if (value.longitude < -180 || value.longitude > 180) {
    throw new RangeError('Longitude must be between -180 and 180')
  }
  if (value.latitude < -90 || value.latitude > 90) {
    throw new RangeError('Latitude must be between -90 and 90')
  }
  return `${value.longitude},${value.latitude}`
}

function coordinatePath(values: readonly NavigationCoordinate[]): string {
  if (values.length < 2) {
    throw new RangeError('At least two navigation coordinates are required')
  }
  if (values.length > 25) {
    throw new RangeError('A directions request cannot contain more than 25 coordinates')
  }
  return values.map(coordinate).join(';')
}

function profile(value: NavigationProfile | undefined): NavigationProfile {
  return value ?? 'driving-traffic'
}

function defaultAnnotations(value: NavigationProfile): readonly DirectionsAnnotation[] {
  if (value === 'driving-traffic') {
    return [
      'distance',
      'duration',
      'speed',
      'congestion',
      'congestion_numeric',
      'closure',
    ]
  }
  return ['distance', 'duration', 'speed']
}

export class MapboxNavigationClient {
  readonly #token: string
  readonly #fetch: typeof fetch

  constructor(options: MapboxNavigationClientOptions) {
    this.#token = accessToken(options.accessToken)
    this.#fetch = options.fetchImpl ?? globalThis.fetch
    if (!this.#fetch) throw new Error('No fetch implementation is available')
  }

  directions(
    coordinates: readonly NavigationCoordinate[],
    options: DirectionsOptions = {},
  ): Promise<DirectionsResponse> {
    const selectedProfile = profile(options.profile)
    const params = new URLSearchParams({
      access_token: this.#token,
      geometries: 'geojson',
      overview: 'full',
      steps: String(options.steps ?? true),
      alternatives: String(options.alternatives ?? true),
      annotations: (options.annotations ?? defaultAnnotations(selectedProfile)).join(','),
    })

    if (options.language) params.set('language', options.language)
    if (options.exclude?.length) params.set('exclude', options.exclude.join(','))
    if (options.continueStraight !== undefined) {
      params.set('continue_straight', String(options.continueStraight))
    }

    return this.#json<DirectionsResponse>(
      `${DIRECTIONS}/${selectedProfile}/${coordinatePath(coordinates)}?${params}`,
      'Directions API',
      options.signal,
    )
  }

  mapMatch(
    coordinates: readonly NavigationCoordinate[],
    options: MapMatchingOptions = {},
  ): Promise<MapMatchingResponse> {
    const selectedProfile = profile(options.profile)
    const params = new URLSearchParams({
      access_token: this.#token,
      geometries: 'geojson',
      overview: 'full',
      steps: String(options.steps ?? false),
      tidy: String(options.tidy ?? true),
    })

    if (options.radiuses) {
      if (options.radiuses.length !== coordinates.length) {
        throw new RangeError('radiuses must match the coordinate count')
      }
      params.set(
        'radiuses',
        options.radiuses.map((value) => value === null ? 'unlimited' : String(value)).join(';'),
      )
    }

    if (options.timestamps) {
      if (options.timestamps.length !== coordinates.length) {
        throw new RangeError('timestamps must match the coordinate count')
      }
      params.set('timestamps', options.timestamps.join(';'))
    }

    return this.#json<MapMatchingResponse>(
      `${MATCHING}/${selectedProfile}/${coordinatePath(coordinates)}?${params}`,
      'Map Matching API',
      options.signal,
    )
  }

  async #json<T>(url: string, label: string, signal?: AbortSignal): Promise<T> {
    const response = await this.#fetch(url, { signal })
    if (!response.ok) {
      throw new Error(`${label} failed with HTTP ${response.status}`)
    }

    const value = await response.json() as T & { code?: string; message?: string }
    if (value.code && value.code !== 'Ok') {
      throw new Error(`${label} returned ${value.code}: ${value.message ?? 'unknown error'}`)
    }
    return value
  }
}
