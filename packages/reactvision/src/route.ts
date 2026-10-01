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
