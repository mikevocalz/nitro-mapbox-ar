import {
  routeGeometryToCoordinates,
  type NavigationCoordinate,
  type NavigationRoute,
} from './client'
import type { NavigationProgressSnapshot } from './contracts'

const EARTH_RADIUS_M = 6_371_000
const RAD = Math.PI / 180

/**
 * One position fix handed to {@linkcode routeProgressAt} or
 * `NavigationSession.updateLocation`.
 */
export interface NavigationLocationSample {
  /** WGS84 position of the traveller. */
  readonly location: NavigationCoordinate
  /** Course in degrees clockwise from true north, when the source reports it. */
  readonly bearing?: number
  /** Ground speed in metres per second, when the source reports it. */
  readonly speedMetersPerSecond?: number
}

function distanceM(a: NavigationCoordinate, b: NavigationCoordinate): number {
  const dLat = (b.latitude - a.latitude) * RAD
  const dLng = (b.longitude - a.longitude) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * RAD) * Math.cos(b.latitude * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Metres along `path` to the point on it nearest `point`, and the path's
 * total length. Each segment is projected in a local equirectangular plane,
 * which is accurate at route-segment lengths.
 */
function project(
  path: readonly NavigationCoordinate[],
  point: NavigationCoordinate,
): { readonly alongM: number; readonly lengthM: number } {
  let bestOffsetM = Number.POSITIVE_INFINITY
  let alongM = 0
  let travelledM = 0
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1]!
    const b = path[index]!
    const cosLat = Math.cos(a.latitude * RAD)
    const bx = (b.longitude - a.longitude) * cosLat
    const by = b.latitude - a.latitude
    const px = (point.longitude - a.longitude) * cosLat
    const py = point.latitude - a.latitude
    const lengthSq = bx * bx + by * by
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / lengthSq))
    const nearest = {
      latitude: a.latitude + by * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    }
    const segmentM = distanceM(a, b)
    const offsetM = distanceM(point, nearest)
    if (offsetM < bestOffsetM) {
      bestOffsetM = offsetM
      alongM = travelledM + segmentM * t
    }
    travelledM += segmentM
  }
  return { alongM, lengthM: travelledM }
}

/** Index of the entry in `lengths` that contains `offset`; past the end lands on the last. */
function indexAt(lengths: readonly number[], offset: number): { readonly index: number; readonly start: number } {
  let start = 0
  for (let index = 0; index < lengths.length - 1; index += 1) {
    if (offset < start + lengths[index]!) return { index, start }
    start += lengths[index]!
  }
  return { index: Math.max(0, lengths.length - 1), start }
}

/**
 * Progress along `route` for one position fix, computed in JS from the
 * route's GeoJSON geometry. This is what `NavigationSession` reports when no
 * native provider is attached.
 *
 * - `fractionTraveled` is the distance along the geometry to the point
 *   nearest `sample.location`, over the geometry's length.
 * - `distanceRemaining` and `durationRemaining` scale `route.distance` and
 *   `route.duration` by the untravelled fraction, so they assume constant
 *   speed over the route.
 * - `currentLegIndex` and `currentStepIndex` are the leg and step whose share
 *   of `route.distance` contains the travelled distance. `currentStepIndex`
 *   is absent when the leg has no steps.
 * - `location` is the fix as given, not snapped to the route.
 *
 * There is no off-route detection: a fix far from the route still projects
 * onto its nearest point.
 *
 * @throws {TypeError} When the route geometry is not a GeoJSON `LineString`.
 * @throws {RangeError} When the geometry has fewer than two positions or a
 * position is outside WGS84 bounds.
 * @see {@linkcode NavigationProgressSnapshot}
 */
export function routeProgressAt(
  route: NavigationRoute,
  sample: NavigationLocationSample,
): NavigationProgressSnapshot {
  const path = routeGeometryToCoordinates(route)
  if (path.length < 2) {
    throw new RangeError('Route geometry needs at least two positions')
  }
  const { alongM, lengthM } = project(path, sample.location)
  const fractionTraveled = lengthM === 0 ? 1 : Math.min(1, alongM / lengthM)
  const travelled = route.distance * fractionTraveled

  const leg = indexAt(route.legs.map((value) => value.distance), travelled)
  const steps = route.legs[leg.index]?.steps
  const step = steps !== undefined && steps.length > 0
    ? indexAt(steps.map((value) => value.distance), travelled - leg.start)
    : undefined

  return {
    location: { longitude: sample.location.longitude, latitude: sample.location.latitude },
    ...(sample.bearing !== undefined ? { bearing: sample.bearing } : {}),
    ...(sample.speedMetersPerSecond !== undefined
      ? { speedMetersPerSecond: sample.speedMetersPerSecond }
      : {}),
    distanceRemaining: route.distance * (1 - fractionTraveled),
    durationRemaining: route.duration * (1 - fractionTraveled),
    fractionTraveled,
    currentLegIndex: leg.index,
    ...(step !== undefined ? { currentStepIndex: step.index } : {}),
    route,
  }
}
