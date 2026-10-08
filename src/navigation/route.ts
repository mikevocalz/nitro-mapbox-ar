import type {
  ManeuverModifier,
  ManeuverType,
  MapboxRouteStep,
  NavigationRoute,
} from './client'

/**
 * A WGS84 position in degrees, with altitude in metres when known.
 * Structurally identical to `GeoCoordinate` in
 * `@mikevocalz/nitro-mapbox-ar-reactvision`, so it can go straight to the
 * ENU projection helpers there.
 *
 * @see {@linkcode NavigationManeuver.location}
 */
export interface GeographicCoordinate {
  readonly latitude: number
  readonly longitude: number
  readonly altitude?: number
}

/**
 * A provider-neutral manoeuvre: what to do at the start of a
 * {@linkcode RouteStep}.
 */
export interface NavigationManeuver {
  readonly kind: ManeuverType
  /** Turn direction relative to travel before the manoeuvre, when given. */
  readonly modifier?: ManeuverModifier
  readonly location: GeographicCoordinate
  /** Compass bearing in degrees [0, 360) of travel into the manoeuvre. */
  readonly bearingBeforeDeg: number
  /** Compass bearing in degrees [0, 360) of travel out of the manoeuvre. */
  readonly bearingAfterDeg: number
  /** Human-readable instruction in the request's language. */
  readonly instruction: string
  /** Roundabout or rotary exit number. */
  readonly exitNumber?: number
}

/**
 * A provider-neutral route step: one manoeuvre and the stretch of travel up to
 * the next one.
 *
 * @see {@linkcode RouteLeg.steps}
 */
export interface RouteStep {
  readonly maneuver: NavigationManeuver
  /** Metres from this manoeuvre to the next. */
  readonly distanceM: number
  /** Seconds from this manoeuvre to the next. */
  readonly durationS: number
  /** Street or path name; empty when the provider has none. */
  readonly streetName: string
  /**
   * The step's path from this manoeuvre to the next, when the provider sent
   * GeoJSON step geometry.
   */
  readonly geometry?: readonly GeographicCoordinate[]
}

/**
 * A provider-neutral route leg: travel between two waypoints.
 *
 * @see {@linkcode mapboxRouteLegs}
 */
export interface RouteLeg {
  readonly distanceM: number
  readonly durationS: number
  /** Steps in travel order; the last one is the leg's arrival. */
  readonly steps: readonly RouteStep[]
}

function wgs84(longitude: unknown, latitude: unknown, label: string): GeographicCoordinate {
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    throw new TypeError(`${label} must be [lng, lat] numbers`)
  }
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new RangeError(`${label} must be finite`)
  }
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new RangeError(`${label} is outside WGS84 bounds`)
  }
  return { latitude, longitude }
}

const bearing = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? ((value % 360) + 360) % 360 : 0

function lineString(geometry: unknown): GeographicCoordinate[] | undefined {
  if (
    typeof geometry !== 'object' ||
    geometry === null ||
    (geometry as { type?: unknown }).type !== 'LineString' ||
    !Array.isArray((geometry as { coordinates?: unknown }).coordinates)
  ) {
    return undefined
  }
  return (geometry as { coordinates: unknown[] }).coordinates.map((position) => {
    if (!Array.isArray(position)) throw new TypeError('Step geometry positions must be arrays')
    return wgs84(position[0], position[1], 'Step geometry position')
  })
}

function toRouteStep(step: MapboxRouteStep): RouteStep {
  const maneuver = step.maneuver
  const location = maneuver?.location
  if (!Array.isArray(location)) {
    throw new TypeError('Step maneuver location must be [lng, lat] numbers')
  }
  const geometry = lineString(step.geometry)
  return {
    maneuver: {
      kind: maneuver.type,
      ...(maneuver.modifier ? { modifier: maneuver.modifier } : {}),
      location: wgs84(location[0], location[1], 'Step maneuver location'),
      bearingBeforeDeg: bearing(maneuver.bearing_before),
      bearingAfterDeg: bearing(maneuver.bearing_after),
      instruction: maneuver.instruction ?? '',
      ...(typeof maneuver.exit === 'number' ? { exitNumber: maneuver.exit } : {}),
    },
    distanceM: step.distance,
    durationS: step.duration,
    streetName: step.name ?? '',
    ...(geometry ? { geometry } : {}),
  }
}

/**
 * Converts a Mapbox Directions route into provider-neutral
 * {@linkcode RouteLeg}s. Request it with `steps: true` and
 * `geometries=geojson` (what `MapboxNavigationClient.directions` sends) so
 * every step carries its manoeuvre and path.
 *
 * @throws {TypeError} When a leg has no steps (the request did not set
 * `steps: true`) or a manoeuvre location is not two numbers.
 * @throws {RangeError} When a position is outside WGS84 bounds.
 */
export function mapboxRouteLegs(route: NavigationRoute): RouteLeg[] {
  return route.legs.map((leg) => {
    if (!Array.isArray(leg.steps)) {
      throw new TypeError('Route legs have no steps; request steps: true')
    }
    return {
      distanceM: leg.distance,
      durationS: leg.duration,
      steps: leg.steps.map(toRouteStep),
    }
  })
}

/**
 * Every {@linkcode RouteStep} of a set of legs in travel order. A multi-leg
 * route keeps each leg's arrival step, so waypoints show up as arrivals.
 */
export function routeSteps(legs: readonly RouteLeg[]): RouteStep[] {
  return legs.flatMap((leg) => leg.steps)
}
