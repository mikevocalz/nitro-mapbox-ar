/**
 * A WGS84 waypoint or trace point passed to
 * {@linkcode MapboxNavigationClient.directions} and
 * {@linkcode MapboxNavigationClient.mapMatch}.
 */
export interface NavigationCoordinate {
  /** Degrees east of the prime meridian, -180..180. Outside the range throws a `RangeError`. */
  readonly longitude: number
  /** Degrees north of the equator, -90..90. Outside the range throws a `RangeError`. */
  readonly latitude: number
}

/**
 * The Mapbox routing profile, which sets the travel mode and whether live
 * traffic is used. `driving-traffic` is the only one that accounts for
 * current traffic.
 *
 * @see {@linkcode DirectionsOptions.profile}
 */
export type NavigationProfile =
  | 'driving-traffic'
  | 'driving'
  | 'walking'
  | 'cycling'

/**
 * A per-segment value the Directions API can add to each leg's
 * {@linkcode RouteLegAnnotation}.
 *
 * @see {@linkcode DirectionsOptions.annotations}
 */
export type DirectionsAnnotation =
  | 'distance'
  | 'duration'
  | 'speed'
  | 'congestion'
  | 'congestion_numeric'
  | 'maxspeed'
  | 'closure'

/**
 * Options for {@linkcode MapboxNavigationClient.directions} and
 * {@linkcode MapboxNavigationClient.directionsWithRequestUrl}. The client
 * always requests `geometries=geojson` and `overview=full`.
 */
export interface DirectionsOptions {
  /** @default 'driving-traffic' */
  readonly profile?: NavigationProfile
  /**
   * Asks for alternative routes in addition to the best one.
   * @default true
   */
  readonly alternatives?: boolean
  /**
   * Includes turn-by-turn steps on each leg, which `mapboxRouteLegs` needs.
   * @default true
   */
  readonly steps?: boolean
  /** Instruction language, such as `en`. Omitted: the API default. */
  readonly language?: string
  /**
   * Per-segment values to add to each leg. Omitted: `distance`, `duration`,
   * `speed`, `congestion`, `congestion_numeric` and `closure` for
   * `driving-traffic`; `distance`, `duration` and `speed` for other profiles.
   */
  readonly annotations?: readonly DirectionsAnnotation[]
  /** Road classes to avoid, such as `toll`, `motorway` or `ferry`. Empty means none. */
  readonly exclude?: readonly string[]
  /**
   * Forbids U-turns at intermediate waypoints when `true`. Omitted: the API
   * default for the profile.
   */
  readonly continueStraight?: boolean
  /** Aborts the HTTP request; the returned promise then rejects. */
  readonly signal?: AbortSignal
}

/**
 * Options for {@linkcode MapboxNavigationClient.mapMatch}. The client always
 * requests `geometries=geojson` and `overview=full`.
 */
export interface MapMatchingOptions {
  /** @default 'driving-traffic' */
  readonly profile?: NavigationProfile
  /**
   * Includes turn-by-turn steps on each matched leg.
   * @default false
   */
  readonly steps?: boolean
  /**
   * Lets the API drop clustered and redundant trace points before matching.
   * @default true
   */
  readonly tidy?: boolean
  /**
   * Search radius in metres around each trace point; `null` sends
   * `unlimited`. Must have one entry per coordinate or the call throws a
   * `RangeError`.
   */
  readonly radiuses?: readonly (number | null)[]
  /**
   * Unix timestamps in seconds, one per coordinate, or the call throws a
   * `RangeError`.
   */
  readonly timestamps?: readonly number[]
  /** Aborts the HTTP request; the returned promise then rejects. */
  readonly signal?: AbortSignal
}

/**
 * Per-segment data on a {@linkcode NavigationRouteLeg}, one array entry per
 * segment between consecutive geometry positions. Only the arrays requested
 * through {@linkcode DirectionsOptions.annotations} are present.
 */
export interface RouteLegAnnotation {
  /** Segment lengths in metres. */
  readonly distance?: readonly number[]
  /** Segment travel times in seconds. */
  readonly duration?: readonly number[]
  /** Segment speeds in metres per second. */
  readonly speed?: readonly number[]
  /** Congestion levels: `unknown`, `low`, `moderate`, `heavy` or `severe`. */
  readonly congestion?: readonly string[]
  /**
   * Congestion from 0 (free flow) to 100; `null` where there is no traffic
   * data. Read by `summarizeRouteTraffic`.
   */
  readonly congestion_numeric?: readonly (number | null)[]
  /** Closed stretches of the leg, as the API reports them. */
  readonly closure?: readonly unknown[]
  readonly [key: string]: unknown
}

/**
 * What a manoeuvre asks the traveller to do, using the Mapbox Directions API
 * vocabulary. New values can appear; treat unknown ones like `turn`.
 */
export type ManeuverType =
  | 'depart'
  | 'arrive'
  | 'turn'
  | 'continue'
  | 'new name'
  | 'merge'
  | 'on ramp'
  | 'off ramp'
  | 'fork'
  | 'end of road'
  | 'use lane'
  | 'roundabout'
  | 'rotary'
  | 'roundabout turn'
  | 'exit roundabout'
  | 'exit rotary'
  | 'notification'
  | (string & {})

/**
 * The direction of a manoeuvre, relative to the direction of travel before it.
 */
export type ManeuverModifier =
  | 'uturn'
  | 'sharp right'
  | 'right'
  | 'slight right'
  | 'straight'
  | 'slight left'
  | 'left'
  | 'sharp left'

/**
 * The manoeuvre at the start of a {@linkcode MapboxRouteStep}, as the Mapbox
 * Directions API sends it. {@linkcode mapboxRouteLegs} converts it to the
 * provider-neutral `NavigationManeuver`.
 *
 * @see {@linkcode MapboxRouteStep.maneuver}
 */
export interface MapboxStepManeuver {
  /** `[longitude, latitude]` of the manoeuvre. */
  readonly location: readonly [longitude: number, latitude: number]
  /** Clockwise degrees from true north before the manoeuvre, 0..359. */
  readonly bearing_before: number
  /** Clockwise degrees from true north after the manoeuvre, 0..359. */
  readonly bearing_after: number
  /** Human-readable instruction, in the request's `language`. */
  readonly instruction: string
  /** What the traveller does here, such as `turn`, `depart` or `arrive`. */
  readonly type: ManeuverType
  /** Absent for `depart`/`arrive` on some profiles. */
  readonly modifier?: ManeuverModifier
  /** Roundabout exit number, when `type` is a roundabout or rotary. */
  readonly exit?: number
  readonly [key: string]: unknown
}

/**
 * One step of a {@linkcode NavigationRouteLeg} as the Mapbox Directions API
 * sends it, present when the request set `steps: true` (see
 * {@linkcode DirectionsOptions.steps}). {@linkcode mapboxRouteLegs} converts
 * it to the provider-neutral `RouteStep`.
 */
export interface MapboxRouteStep {
  /** Metres from this step's manoeuvre to the next one. */
  readonly distance: number
  /** Seconds from this step's manoeuvre to the next one. */
  readonly duration: number
  /** Street name the step travels along; may be empty. */
  readonly name: string
  /** Travel mode, for example `walking` or `driving`. */
  readonly mode: string
  /** The manoeuvre that starts this step. */
  readonly maneuver: MapboxStepManeuver
  /** The step's GeoJSON geometry when `geometries=geojson`. */
  readonly geometry?: unknown
  readonly [key: string]: unknown
}

/**
 * Travel between two consecutive waypoints of a {@linkcode NavigationRoute},
 * as the Mapbox API sends it. Fields not listed here pass through unchanged.
 */
export interface NavigationRouteLeg {
  /** Leg length in metres. */
  readonly distance: number
  /** Expected leg travel time in seconds. */
  readonly duration: number
  /** Per-segment data, present when annotations were requested. */
  readonly annotation?: RouteLegAnnotation
  /** Turn-by-turn steps; present when the request set `steps: true`. */
  readonly steps?: readonly MapboxRouteStep[]
  readonly [key: string]: unknown
}

/**
 * One route from {@linkcode DirectionsResponse.routes} or one matching from
 * {@linkcode MapMatchingResponse.matchings}, as the Mapbox API sends it.
 * Fields not listed here pass through unchanged.
 */
export interface NavigationRoute {
  /** Route length in metres. */
  readonly distance: number
  /** Expected travel time in seconds, with live traffic on `driving-traffic`. */
  readonly duration: number
  /** Travel time in seconds under typical traffic, when the API sends it. */
  readonly duration_typical?: number
  /** Cost the router minimised to pick this route; unit given by `weight_name`. */
  readonly weight?: number
  /** Name of the weight metric, such as `auto` or `pedestrian`. */
  readonly weight_name?: string
  /**
   * The full route path. A GeoJSON `LineString` for routes from
   * {@linkcode MapboxNavigationClient}; read it with
   * {@linkcode routeGeometryToCoordinates}.
   */
  readonly geometry?: unknown
  /** One leg per pair of consecutive waypoints, in travel order. */
  readonly legs: readonly NavigationRouteLeg[]
  readonly [key: string]: unknown
}

/**
 * The parsed body of a Directions API response, from
 * {@linkcode MapboxNavigationClient.directions}.
 */
export interface DirectionsResponse {
  /** API status. Always `Ok` here; other codes reject the call. */
  readonly code: string
  /** Routes, best first; alternatives follow when requested. */
  readonly routes: readonly NavigationRoute[]
  /** Input coordinates snapped to the road network, as the API sends them. */
  readonly waypoints?: readonly unknown[]
  /** Mapbox's identifier for this response. */
  readonly uuid?: string
  readonly [key: string]: unknown
}

/**
 * The parsed body of a Map Matching API response, from
 * {@linkcode MapboxNavigationClient.mapMatch}.
 */
export interface MapMatchingResponse {
  /** API status. Always `Ok` here; other codes reject the call. */
  readonly code: string
  /** Routes matched to the trace; the API splits a trace it cannot join into several. */
  readonly matchings?: readonly NavigationRoute[]
  /**
   * One entry per input coordinate, with its snapped position, or `null` for
   * points the API dropped, as the API sends them.
   */
  readonly tracepoints?: readonly unknown[]
  readonly [key: string]: unknown
}

/**
 * The response members {@linkcode MapboxNavigationClient} and
 * `MapboxSearchClient` read from a {@linkcode FetchLike} call. A
 * WHATWG `Response` satisfies it.
 */
export interface FetchLikeResponse {
  /** `true` for HTTP 2xx. */
  readonly ok: boolean
  /** HTTP status code. */
  readonly status: number
  /** Parses the body as JSON. */
  json(): Promise<unknown>
}

/**
 * The request options the clients pass to a {@linkcode FetchLike}.
 *
 * @see {@linkcode FetchLike}
 */
export interface FetchLikeInit {
  /**
   * Cancels the request when aborted. Present only when the caller passed a
   * signal, so hosts without `AbortSignal` never receive one.
   */
  readonly signal?: AbortSignal
}

/**
 * The HTTP transport {@linkcode MapboxNavigationClient} and
 * `MapboxSearchClient` need. Pass it as `fetchImpl` when the host
 * has no global `fetch`, or when its `fetch` comes from a module, as in Lens
 * Studio. `globalThis.fetch` satisfies it.
 *
 * The URL carries the Mapbox access token in its `access_token` query
 * parameter. Do not log it.
 *
 * @param url Absolute HTTPS URL.
 * @param init Request options; omitted when the caller passed no signal.
 */
export type FetchLike = (
  url: string,
  init?: FetchLikeInit,
) => Promise<FetchLikeResponse>

/**
 * Constructor options for {@linkcode MapboxNavigationClient}.
 */
export interface MapboxNavigationClientOptions {
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
 * A Directions API response together with the URL that produced it, from
 * {@linkcode MapboxNavigationClient.directionsWithRequestUrl}.
 */
export interface DirectionsResult {
  /** The parsed Directions API response; `code` is always `Ok`. */
  readonly response: DirectionsResponse
  /**
   * The request URL, including the `access_token` query parameter. It carries
   * the access token: never log it or send it anywhere the token should not
   * go.
   */
  readonly requestUrl: string
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

function resolveFetch(fetchImpl: FetchLike | undefined): FetchLike {
  if (fetchImpl) return fetchImpl
  const global = (globalThis as { fetch?: FetchLike }).fetch
  if (!global) {
    throw new Error('No fetch implementation is available; pass fetchImpl')
  }
  return global
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

/**
 * Directions and Map Matching over HTTP.
 *
 * @throws {Error} From the constructor when the token is blank, or when no
 * `fetchImpl` is given and the host has no `globalThis.fetch`.
 */
export class MapboxNavigationClient {
  readonly #token: string
  readonly #fetch: FetchLike

  constructor(options: MapboxNavigationClientOptions) {
    this.#token = accessToken(options.accessToken)
    this.#fetch = resolveFetch(options.fetchImpl)
  }

  /**
   * Requests routes from the Directions API.
   *
   * @throws {RangeError} For fewer than 2 or more than 25 coordinates, or a
   * coordinate outside WGS84 bounds.
   * @throws {Error} On a non-2xx status or a response `code` other than `Ok`.
   */
  directions(
    coordinates: readonly NavigationCoordinate[],
    options: DirectionsOptions = {},
  ): Promise<DirectionsResponse> {
    return this.directionsWithRequestUrl(coordinates, options).then(
      (result) => result.response,
    )
  }

  /**
   * Same request as {@linkcode MapboxNavigationClient.directions}, and also
   * returns the request URL, for consumers that hand both the response and
   * the URL that produced it to another router.
   *
   * The returned {@linkcode DirectionsResult.requestUrl} contains the access
   * token. Never log it.
   *
   * @throws {RangeError} Under the same conditions as
   * {@linkcode MapboxNavigationClient.directions}.
   * @throws {Error} On a non-2xx status or a response `code` other than `Ok`.
   */
  directionsWithRequestUrl(
    coordinates: readonly NavigationCoordinate[],
    options: DirectionsOptions = {},
  ): Promise<DirectionsResult> {
    const requestUrl = this.#directionsUrl(coordinates, options)
    return this.#json<DirectionsResponse>(
      requestUrl,
      'Directions API',
      options.signal,
    ).then((response) => ({ response, requestUrl }))
  }

  #directionsUrl(
    coordinates: readonly NavigationCoordinate[],
    options: DirectionsOptions,
  ): string {
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

    return `${DIRECTIONS}/${selectedProfile}/${coordinatePath(coordinates)}?${params}`
  }

  /**
   * Snaps a GPS trace to the road network with the Map Matching API.
   *
   * @param coordinates 2 to 25 trace points in travel order.
   * @throws {RangeError} Synchronously for fewer than 2 or more than 25
   * coordinates, a coordinate outside WGS84 bounds, or `radiuses` or
   * `timestamps` whose length differs from the coordinate count.
   * @throws {Error} (as a rejection) On a non-2xx status or a response `code`
   * other than `Ok`.
   */
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
    const response = await (signal ? this.#fetch(url, { signal }) : this.#fetch(url))
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

/**
 * A WGS84 position on a {@linkcode NavigationRoute}'s geometry. Structurally
 * matches `GeoCoordinate` in `@mikevocalz/nitro-mapbox-ar-reactvision`, so
 * the result of {@linkcode routeGeometryToCoordinates} can go straight to its
 * route projection helpers.
 */
export interface RouteGeometryCoordinate extends NavigationCoordinate {
  /** Altitude in metres when the geometry carries a third position value. */
  readonly altitude?: number
}

/**
 * Reads a route's GeoJSON `LineString` geometry, which is `[lng, lat]`
 * ordered, into `{ latitude, longitude }` coordinates.
 *
 * {@linkcode MapboxNavigationClient.directions} and
 * {@linkcode MapboxNavigationClient.mapMatch} always request
 * `geometries=geojson`, so their routes are accepted as-is.
 *
 * @throws {TypeError} When the geometry is missing, an encoded polyline, or
 * not a `LineString` of numeric positions.
 * @throws {RangeError} When a position is outside WGS84 bounds.
 */
export function routeGeometryToCoordinates(
  route: NavigationRoute,
): RouteGeometryCoordinate[] {
  const geometry = route.geometry
  if (typeof geometry === 'string') {
    throw new TypeError(
      'Route geometry is an encoded polyline; request geometries=geojson',
    )
  }
  if (
    typeof geometry !== 'object' ||
    geometry === null ||
    (geometry as { type?: unknown }).type !== 'LineString' ||
    !Array.isArray((geometry as { coordinates?: unknown }).coordinates)
  ) {
    throw new TypeError('Route geometry must be a GeoJSON LineString')
  }

  const positions = (geometry as { coordinates: unknown[] }).coordinates
  return positions.map((position) => {
    if (
      !Array.isArray(position) ||
      position.length < 2 ||
      !position.every((value) => typeof value === 'number')
    ) {
      throw new TypeError('LineString positions must be [lng, lat] number arrays')
    }
    const [longitude, latitude, altitude] = position as number[]
    // Validates finiteness and WGS84 bounds.
    coordinate({ longitude: longitude!, latitude: latitude! })
    if (altitude === undefined) {
      return { latitude: latitude!, longitude: longitude! }
    }
    if (!Number.isFinite(altitude)) {
      throw new RangeError('LineString altitude must be finite')
    }
    return { latitude: latitude!, longitude: longitude!, altitude }
  })
}


export {
  mapboxRouteLegs,
  routeSteps,
  type GeographicCoordinate,
  type NavigationManeuver,
  type RouteLeg,
  type RouteStep,
} from './route'
