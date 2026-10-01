import type { NavigationCoordinate, NavigationProfile } from './client'

export interface AdvancedNavigationClientOptions {
  readonly accessToken: string
  readonly fetchImpl?: typeof fetch
}

export interface IsochroneOptions {
  readonly profile?: NavigationProfile
  readonly minutes?: readonly number[]
  readonly meters?: readonly number[]
  readonly polygons?: boolean
  readonly denoise?: number
  readonly generalize?: number
  readonly exclude?: readonly string[]
  readonly departAt?: string
  readonly signal?: AbortSignal
}

export interface MatrixOptions {
  readonly profile?: NavigationProfile
  readonly sources?: 'all' | readonly number[]
  readonly destinations?: 'all' | readonly number[]
  readonly annotations?: readonly ('duration' | 'distance')[]
  readonly departAt?: string
  readonly signal?: AbortSignal
}

export interface OptimizationV1Options {
  readonly profile?: Exclude<NavigationProfile, 'driving-traffic'>
  readonly roundtrip?: boolean
  readonly source?: 'first' | 'any'
  readonly destination?: 'last' | 'any'
  readonly steps?: boolean
  readonly signal?: AbortSignal
}

export interface EvRouteOptions {
  readonly profile?: 'driving' | 'driving-traffic'
  readonly maxChargeWh: number
  readonly initialChargeWh?: number
  readonly connectorTypes: readonly string[]
  readonly energyConsumptionCurve: string
  readonly chargingCurve: string
  readonly addChargingStops?: boolean
  readonly preferAmenities?: readonly string[]
  readonly signal?: AbortSignal
}

export interface OptimizationV2Submission {
  readonly version: number
  readonly vehicles: readonly unknown[]
  readonly services: readonly unknown[]
  readonly [key: string]: unknown
}

export interface OptimizationV2Response {
  readonly id?: string
  readonly status?: string
  readonly [key: string]: unknown
}

const ISOCHRONE = 'https://api.mapbox.com/isochrone/v1/mapbox'
const MATRIX = 'https://api.mapbox.com/directions-matrix/v1/mapbox'
const OPTIMIZATION_V1 = 'https://api.mapbox.com/optimized-trips/v1/mapbox'
const OPTIMIZATION_V2 = 'https://api.mapbox.com/optimized-trips/v2'
const DIRECTIONS = 'https://api.mapbox.com/directions/v5/mapbox'

function requireToken(value: string): string {
  const normalized = value.trim()
  if (!normalized) throw new Error('A Mapbox access token is required')
  return normalized
}

function coord(value: NavigationCoordinate): string {
  if (!Number.isFinite(value.longitude) || !Number.isFinite(value.latitude)) {
    throw new RangeError('coordinates must be finite')
  }
  return `${value.longitude},${value.latitude}`
}

function coordPath(values: readonly NavigationCoordinate[]): string {
  if (values.length < 2) throw new RangeError('at least two coordinates are required')
  return values.map(coord).join(';')
}

function list(value: readonly number[] | 'all' | undefined): string | undefined {
  return value === 'all' ? 'all' : value?.join(';')
}

function profile(value: NavigationProfile | undefined): NavigationProfile {
  return value ?? 'driving'
}

export class MapboxAdvancedNavigationClient {
  readonly #token: string
  readonly #fetch: typeof fetch

  constructor(options: AdvancedNavigationClientOptions) {
    this.#token = requireToken(options.accessToken)
    this.#fetch = options.fetchImpl ?? globalThis.fetch
    if (!this.#fetch) throw new Error('No fetch implementation is available')
  }

  isochrone(
    center: NavigationCoordinate,
    options: IsochroneOptions,
  ): Promise<unknown> {
    const minutes = options.minutes?.join(',')
    const meters = options.meters?.join(',')
    if ((minutes ? 1 : 0) + (meters ? 1 : 0) !== 1) {
      throw new Error('Specify exactly one of minutes or meters')
    }

    const values = options.minutes ?? options.meters ?? []
    if (values.length < 1 || values.length > 4) {
      throw new RangeError('Isochrone requires between 1 and 4 contours')
    }

    const params = new URLSearchParams({
      access_token: this.#token,
      polygons: String(options.polygons ?? true),
    })
    if (minutes) params.set('contours_minutes', minutes)
    if (meters) params.set('contours_meters', meters)
    if (options.denoise !== undefined) params.set('denoise', String(options.denoise))
    if (options.generalize !== undefined) params.set('generalize', String(options.generalize))
    if (options.exclude?.length) params.set('exclude', options.exclude.join(','))
    if (options.departAt) params.set('depart_at', options.departAt)

    return this.#json(
      `${ISOCHRONE}/${profile(options.profile)}/${coord(center)}?${params}`,
      'Isochrone API',
      options.signal,
    )
  }

  matrix(
    coordinates: readonly NavigationCoordinate[],
    options: MatrixOptions = {},
  ): Promise<unknown> {
    const selectedProfile = profile(options.profile)
    const limit = selectedProfile === 'driving-traffic' ? 10 : 25
    if (coordinates.length < 2 || coordinates.length > limit) {
      throw new RangeError(`Matrix supports 2..${limit} coordinates for ${selectedProfile}`)
    }

    const params = new URLSearchParams({ access_token: this.#token })
    const sources = list(options.sources)
    const destinations = list(options.destinations)
    if (sources) params.set('sources', sources)
    if (destinations) params.set('destinations', destinations)
    if (options.annotations?.length) params.set('annotations', options.annotations.join(','))
    if (options.departAt) params.set('depart_at', options.departAt)

    return this.#json(
      `${MATRIX}/${selectedProfile}/${coordPath(coordinates)}?${params}`,
      'Matrix API',
      options.signal,
    )
  }

  optimizeV1(
    coordinates: readonly NavigationCoordinate[],
    options: OptimizationV1Options = {},
  ): Promise<unknown> {
    if (coordinates.length < 2 || coordinates.length > 12) {
      throw new RangeError('Optimization v1 supports between 2 and 12 coordinates')
    }

    const params = new URLSearchParams({
      access_token: this.#token,
      roundtrip: String(options.roundtrip ?? true),
      source: options.source ?? 'any',
      destination: options.destination ?? 'any',
      steps: String(options.steps ?? false),
      geometries: 'geojson',
      overview: 'full',
    })

    return this.#json(
      `${OPTIMIZATION_V1}/${options.profile ?? 'driving'}/${coordPath(coordinates)}?${params}`,
      'Optimization API v1',
      options.signal,
    )
  }

  async submitOptimizationV2(
    document: OptimizationV2Submission,
    signal?: AbortSignal,
  ): Promise<OptimizationV2Response> {
    return this.#json(
      `${OPTIMIZATION_V2}?access_token=${encodeURIComponent(this.#token)}`,
      'Optimization API v2',
      signal,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(document),
      },
    ) as Promise<OptimizationV2Response>
  }

  getOptimizationV2(
    id: string,
    signal?: AbortSignal,
  ): Promise<OptimizationV2Response> {
    if (!id.trim()) throw new Error('Optimization v2 id is required')
    return this.#json(
      `${OPTIMIZATION_V2}/${encodeURIComponent(id)}?access_token=${encodeURIComponent(this.#token)}`,
      'Optimization API v2',
      signal,
    ) as Promise<OptimizationV2Response>
  }

  evRoute(
    coordinates: readonly NavigationCoordinate[],
    options: EvRouteOptions,
  ): Promise<unknown> {
    if (coordinates.length < 2 || coordinates.length > 12) {
      throw new RangeError('EV routes with automatic charging support up to 12 waypoints')
    }
    if (!Number.isSafeInteger(options.maxChargeWh) || options.maxChargeWh <= 0) {
      throw new RangeError('maxChargeWh must be a positive integer')
    }
    if (!options.connectorTypes.length) {
      throw new RangeError('At least one EV connector type is required')
    }

    const params = new URLSearchParams({
      access_token: this.#token,
      overview: 'full',
      geometries: 'geojson',
      alternatives: 'true',
      waypoints_per_route: 'true',
      engine: 'electric',
      ev_max_charge: String(options.maxChargeWh),
      ev_connector_types: options.connectorTypes.join(','),
      energy_consumption_curve: options.energyConsumptionCurve,
      ev_charging_curve: options.chargingCurve,
      ev_add_charging_stops: String(options.addChargingStops ?? true),
    })
    if (options.initialChargeWh !== undefined) {
      params.set('ev_initial_charge', String(options.initialChargeWh))
    }
    if (options.preferAmenities?.length) {
      params.set('ev_prefer_amenities', options.preferAmenities.join(','))
    }

    return this.#json(
      `${DIRECTIONS}/${options.profile ?? 'driving-traffic'}/${coordPath(coordinates)}?${params}`,
      'EV Directions API',
      options.signal,
    )
  }

  async #json(
    url: string,
    label: string,
    signal?: AbortSignal,
    init: RequestInit = {},
  ): Promise<unknown> {
    const response = await this.#fetch(url, { ...init, signal })
    if (!response.ok) throw new Error(`${label} failed with HTTP ${response.status}`)
    return response.json()
  }
}
