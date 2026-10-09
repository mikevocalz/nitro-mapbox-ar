import type { NavigationCoordinate, NavigationProfile } from './client'

/**
 * Construction options for {@linkcode MapboxAdvancedNavigationClient}.
 */
export interface AdvancedNavigationClientOptions {
  /**
   * Mapbox access token sent as `access_token` on every request. Surrounding
   * whitespace is trimmed; the constructor throws an `Error` when the trimmed
   * token is empty.
   */
  readonly accessToken: string
  /**
   * `fetch` implementation used for every request.
   *
   * @default globalThis.fetch
   */
  readonly fetchImpl?: typeof fetch
}

/**
 * Options for {@linkcode MapboxAdvancedNavigationClient.isochrone}. Set
 * exactly one of `minutes` or `meters`.
 */
export interface IsochroneOptions {
  /**
   * Travel profile in the request path.
   *
   * @default 'driving'
   */
  readonly profile?: NavigationProfile
  /**
   * Contour times in minutes, 1 to 4 values, sent as `contours_minutes`.
   * Mutually exclusive with `meters`.
   */
  readonly minutes?: readonly number[]
  /**
   * Contour distances in metres, 1 to 4 values, sent as `contours_meters`.
   * Mutually exclusive with `minutes`.
   */
  readonly meters?: readonly number[]
  /**
   * Return contours as polygons when `true`, as lines when `false`.
   *
   * @default true
   */
  readonly polygons?: boolean
  /**
   * Sent as `denoise`: the Isochrone API drops contour fragments smaller than
   * this share (0 to 1) of the largest one. Omitted means the API default.
   */
  readonly denoise?: number
  /**
   * Sent as `generalize`: simplification tolerance in metres for the contour
   * geometry. Omitted means the API default.
   */
  readonly generalize?: number
  /** Road classes to avoid, sent comma-separated as `exclude`. */
  readonly exclude?: readonly string[]
  /** Departure time sent unchanged as `depart_at`, for traffic-aware contours. */
  readonly departAt?: string
  /** Aborts the HTTP request. */
  readonly signal?: AbortSignal
}

/**
 * Options for {@linkcode MapboxAdvancedNavigationClient.matrix}.
 */
export interface MatrixOptions {
  /**
   * Travel profile in the request path. `driving-traffic` accepts at most 10
   * coordinates, the others 25.
   *
   * @default 'driving'
   */
  readonly profile?: NavigationProfile
  /**
   * Indexes into the coordinate list to use as origins, or `'all'`. Omitted
   * means the API default (every coordinate).
   */
  readonly sources?: 'all' | readonly number[]
  /**
   * Indexes into the coordinate list to use as destinations, or `'all'`.
   * Omitted means the API default (every coordinate).
   */
  readonly destinations?: 'all' | readonly number[]
  /**
   * Which tables to return. `duration` is in seconds, `distance` in metres.
   * Omitted means the API default (durations only).
   */
  readonly annotations?: readonly ('duration' | 'distance')[]
  /** Departure time sent unchanged as `depart_at`. */
  readonly departAt?: string
  /** Aborts the HTTP request. */
  readonly signal?: AbortSignal
}

/**
 * Options for {@linkcode MapboxAdvancedNavigationClient.optimizeV1}.
 */
export interface OptimizationV1Options {
  /**
   * Travel profile in the request path. The Optimization API v1 has no
   * `driving-traffic` profile.
   *
   * @default 'driving'
   */
  readonly profile?: Exclude<NavigationProfile, 'driving-traffic'>
  /**
   * Return to the first location at the end of the trip.
   *
   * @default true
   */
  readonly roundtrip?: boolean
  /**
   * `'first'` starts the trip at the first coordinate; `'any'` lets the API
   * pick.
   *
   * @default 'any'
   */
  readonly source?: 'first' | 'any'
  /**
   * `'last'` ends the trip at the last coordinate; `'any'` lets the API pick.
   *
   * @default 'any'
   */
  readonly destination?: 'last' | 'any'
  /**
   * Include turn-by-turn steps in the response.
   *
   * @default false
   */
  readonly steps?: boolean
  /** Aborts the HTTP request. */
  readonly signal?: AbortSignal
}

/**
 * Options for {@linkcode MapboxAdvancedNavigationClient.evRoute}. EV routing
 * is a Mapbox Private Preview; the request fails unless the account has
 * access.
 */
export interface EvRouteOptions {
  /**
   * Directions profile in the request path.
   *
   * @default 'driving-traffic'
   */
  readonly profile?: 'driving' | 'driving-traffic'
  /** Usable battery capacity in watt-hours, a positive integer. Sent as `ev_max_charge`. */
  readonly maxChargeWh: number
  /** Charge at departure in watt-hours, sent as `ev_initial_charge`. Omitted means the API default. */
  readonly initialChargeWh?: number
  /** Connector types the vehicle accepts, at least one, sent comma-separated as `ev_connector_types`. */
  readonly connectorTypes: readonly string[]
  /** Speed-to-consumption curve sent unchanged as `energy_consumption_curve`, in the Directions API string format. */
  readonly energyConsumptionCurve: string
  /** Charge-level-to-charging-power curve sent unchanged as `ev_charging_curve`, in the Directions API string format. */
  readonly chargingCurve: string
  /**
   * Let the API insert charging stops along the route.
   *
   * @default true
   */
  readonly addChargingStops?: boolean
  /** Amenities preferred at charging stops, sent comma-separated as `ev_prefer_amenities`. */
  readonly preferAmenities?: readonly string[]
  /** Aborts the HTTP request. */
  readonly signal?: AbortSignal
}

/**
 * Routing problem posted by
 * {@linkcode MapboxAdvancedNavigationClient.submitOptimizationV2}. The object
 * is sent as JSON unchanged, so any extra Optimization API v2 fields pass
 * through.
 */
export interface OptimizationV2Submission {
  /** Optimization API v2 document format version. */
  readonly version: number
  /** Vehicles available to serve the problem, in the API's vehicle schema. */
  readonly vehicles: readonly unknown[]
  /** Stops to serve, in the API's service schema. */
  readonly services: readonly unknown[]
  readonly [key: string]: unknown
}

/**
 * Parsed JSON from the Optimization API v2, returned by
 * {@linkcode MapboxAdvancedNavigationClient.submitOptimizationV2} and
 * {@linkcode MapboxAdvancedNavigationClient.getOptimizationV2}. Other fields
 * in the body are kept as-is.
 */
export interface OptimizationV2Response {
  /** Job id; pass it to {@linkcode MapboxAdvancedNavigationClient.getOptimizationV2} to fetch the result. */
  readonly id?: string
  /** Job status as the API reports it. */
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

/**
 * HTTP client for the Mapbox Isochrone, Matrix, Optimization (v1 and v2) and
 * EV Directions APIs. Every method validates its input synchronously and
 * throws before any request is sent; HTTP failures reject the returned
 * Promise with an `Error` naming the API and status code. Successful calls
 * resolve with the parsed JSON body.
 *
 * Optimization v2 is a Mapbox Public Beta and EV routing a Private Preview;
 * only call them when the account has access.
 */
export class MapboxAdvancedNavigationClient {
  readonly #token: string
  readonly #fetch: typeof fetch

  /**
   * @throws {Error} When the access token is empty after trimming, or when
   * no `fetchImpl` is given and `globalThis.fetch` is undefined.
   */
  constructor(options: AdvancedNavigationClientOptions) {
    this.#token = requireToken(options.accessToken)
    this.#fetch = options.fetchImpl ?? globalThis.fetch
    if (!this.#fetch) throw new Error('No fetch implementation is available')
  }

  /**
   * Requests areas reachable from `center` within the given times or
   * distances, via `GET https://api.mapbox.com/isochrone/v1/mapbox/{profile}/{lng},{lat}`.
   *
   * @returns The Isochrone API response body (a GeoJSON `FeatureCollection`).
   * @throws {Error} When neither or both of `minutes` and `meters` are set.
   * @throws {RangeError} When the contour list has fewer than 1 or more than
   * 4 values, or `center` has a non-finite coordinate.
   */
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

  /**
   * Requests travel times (and optionally distances) between every source
   * and destination, via `GET https://api.mapbox.com/directions-matrix/v1/mapbox/{profile}/{coordinates}`.
   *
   * @returns The Matrix API response body.
   * @throws {RangeError} When there are fewer than 2 coordinates, more than
   * 10 for `driving-traffic` or 25 for other profiles, or a coordinate is not
   * finite.
   */
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

  /**
   * Orders 2 to 12 stops into the fastest trip, via `GET https://api.mapbox.com/optimized-trips/v1/mapbox/{profile}/{coordinates}`.
   * The request asks for GeoJSON geometry with `overview=full`.
   *
   * @returns The Optimization API v1 response body.
   * @throws {RangeError} When there are fewer than 2 or more than 12
   * coordinates, or a coordinate is not finite.
   */
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

  /**
   * Posts a routing problem as JSON to `POST https://api.mapbox.com/optimized-trips/v2`.
   * The API solves it asynchronously; poll
   * {@linkcode MapboxAdvancedNavigationClient.getOptimizationV2} with the
   * returned `id` for the solution.
   *
   * @param signal Aborts the HTTP request.
   * @returns The submission response, including the job `id`.
   */
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

  /**
   * Fetches the status or solution of a job created by
   * {@linkcode MapboxAdvancedNavigationClient.submitOptimizationV2}, via
   * `GET https://api.mapbox.com/optimized-trips/v2/{id}`.
   *
   * @param id Job id from {@linkcode OptimizationV2Response.id}.
   * @param signal Aborts the HTTP request.
   * @throws {Error} When `id` is empty or whitespace.
   */
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

  /**
   * Requests an electric-vehicle route with charging stops, via
   * `GET https://api.mapbox.com/directions/v5/mapbox/{profile}/{coordinates}`
   * with `engine=electric`. The request asks for alternatives, full GeoJSON
   * geometry and `waypoints_per_route=true`.
   *
   * @returns The Directions API response body.
   * @throws {RangeError} When there are fewer than 2 or more than 12
   * coordinates, `maxChargeWh` is not a positive safe integer,
   * `connectorTypes` is empty, or a coordinate is not finite.
   */
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
