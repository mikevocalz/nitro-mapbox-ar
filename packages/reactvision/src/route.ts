import type {
  GeoCoordinate,
  GeoWorldPosition,
  ViroGeospatialPose,
} from './types'
import { validateCoordinate } from './geo'

export interface RouteProjectionOptions {
  /**
   * Fallback WGS84 altitude for route coordinates that do not carry altitude.
   * Defaults to the camera pose altitude, which intentionally keeps an
   * altitude-less route on the camera's horizontal plane.
   */
  readonly fallbackAltitude?: number
  readonly verticalOffset?: number
}

export type GeoProjector = (
  pose: ViroGeospatialPose,
  latitude: number,
  longitude: number,
  altitude: number,
) => [number, number, number]

export function projectRouteToWorld(
  projector: GeoProjector,
  pose: ViroGeospatialPose,
  route: readonly GeoCoordinate[],
  options: RouteProjectionOptions = {},
): GeoWorldPosition[] {
  const fallbackAltitude = options.fallbackAltitude ?? pose.altitude
  const verticalOffset = options.verticalOffset ?? 0

  if (!Number.isFinite(fallbackAltitude)) {
    throw new RangeError('fallbackAltitude must be finite')
  }
  if (!Number.isFinite(verticalOffset)) {
    throw new RangeError('verticalOffset must be finite')
  }

  return route.map((coordinate) => {
    validateCoordinate(coordinate)

    const altitude = coordinate.altitude ?? fallbackAltitude
    const [x, y, z] = projector(
      pose,
      coordinate.latitude,
      coordinate.longitude,
      altitude,
    )

    return [x, y + verticalOffset, z] as const
  })
}

/**
 * Splits long AR routes into overlapping chunks suitable for separate
 * ViroPolyline nodes. One point overlaps adjacent chunks so the route stays
 * visually continuous.
 */
export function chunkWorldRoute(
  points: readonly GeoWorldPosition[],
  maxPoints = 128,
): GeoWorldPosition[][] {
  if (!Number.isSafeInteger(maxPoints) || maxPoints < 2) {
    throw new RangeError('maxPoints must be an integer of at least 2')
  }

  if (points.length <= maxPoints) {
    return [Array.from(points)]
  }

  const chunks: GeoWorldPosition[][] = []
  let start = 0

  while (start < points.length - 1) {
    const end = Math.min(start + maxPoints, points.length)
    chunks.push(Array.from(points.slice(start, end)))

    if (end === points.length) {
      break
    }

    start = end - 1
  }

  return chunks
}

function validateRoutePoints(points: readonly GeoWorldPosition[]): void {
  if (points.length === 0) {
    throw new RangeError('A route needs at least one point')
  }
  for (const [x, y, z] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new RangeError('Route points must be finite')
    }
  }
}

function segmentLengthM(a: GeoWorldPosition, b: GeoWorldPosition): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
}

/**
 * Length in metres of a projected route, measured along its segments.
 *
 * Pass points from `projectRouteToEnu` or {@linkcode projectRouteToWorld};
 * both are in metres. A single point has length 0.
 *
 * @throws {RangeError} When `points` is empty or holds a non-finite value.
 * @see {@linkcode pointAlongRoute}
 */
export function routeLengthM(points: readonly GeoWorldPosition[]): number {
  validateRoutePoints(points)
  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    total += segmentLengthM(points[i - 1]!, points[i]!)
  }
  return total
}

/**
 * The position `distanceM` metres along a projected route, for a playhead or
 * progress marker. Distances below 0 return the first point and distances past
 * {@linkcode routeLengthM} return the last.
 *
 * @throws {RangeError} When `points` is empty, holds a non-finite value, or
 * `distanceM` is not finite.
 */
export function pointAlongRoute(
  points: readonly GeoWorldPosition[],
  distanceM: number,
): GeoWorldPosition {
  validateRoutePoints(points)
  if (!Number.isFinite(distanceM)) {
    throw new RangeError('distanceM must be finite')
  }

  const first = points[0]!
  if (distanceM <= 0 || points.length === 1) {
    return [first[0], first[1], first[2]] as const
  }

  let travelled = 0
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    const length = segmentLengthM(a, b)
    if (length > 0 && travelled + length >= distanceM) {
      const t = (distanceM - travelled) / length
      return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ] as const
    }
    travelled += length
  }

  const last = points[points.length - 1]!
  return [last[0], last[1], last[2]] as const
}
