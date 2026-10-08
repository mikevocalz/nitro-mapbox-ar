import type { GeoWorldPosition } from './types'

/**
 * The closest point of a projected route to a query position, measured on
 * the horizontal plane.
 *
 * Route points are in Viro axes (`x` = east, `y` = up, `z` = −north), as
 * returned by `projectRouteToEnu` or `projectRouteToWorld`. `y` is
 * ignored for the projection itself and interpolated for {@linkcode point},
 * so a pedestrian's height never pulls the match onto a different segment.
 *
 * @see {@linkcode projectOntoRoute}
 */
export interface RouteProjection {
  /** Index of the segment `[i, i + 1]` the point lies on. */
  readonly segmentIndex: number
  /** Position along that segment, 0..1. */
  readonly t: number
  /** The matched point on the route, with `y` interpolated along the segment. */
  readonly point: GeoWorldPosition
  /** Horizontal metres from the first route point to {@linkcode point}. */
  readonly alongTrackM: number
  /**
   * Signed horizontal metres from the route: positive when the query position
   * is left of the direction of travel.
   */
  readonly crossTrackM: number
  /** Unsigned horizontal distance from the query position to {@linkcode point}. */
  readonly distanceM: number
}

/** Options for {@linkcode projectOntoRoute}. */
export interface RouteProjectionWindow {
  /** First segment to consider. @default 0 */
  readonly fromSegment?: number
  /** Last segment to consider, inclusive. @default the last segment */
  readonly toSegment?: number
}

function assertPoints(points: readonly GeoWorldPosition[]): void {
  if (points.length < 2) {
    throw new RangeError('A route needs at least two points')
  }
  for (const p of points) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) {
      throw new RangeError('Route points must be finite')
    }
  }
}

/**
 * Horizontal distance from the first point to each point, so
 * `cumulativeRouteLengthsM(points)[i]` is the along-track position of
 * `points[i]`. Uses the same metric as {@linkcode projectOntoRoute}.
 *
 * @throws {RangeError} When there are fewer than two points or any is not finite.
 */
export function cumulativeRouteLengthsM(points: readonly GeoWorldPosition[]): number[] {
  assertPoints(points)
  const out = [0]
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    out.push(out[i - 1]! + Math.hypot(b[0] - a[0], b[2] - a[2]))
  }
  return out
}

/**
 * Projects `position` onto the closest segment of a projected route.
 *
 * Use `window` to restrict the search, for example to segments near the
 * previous match so a fix between two parallel streets of the same route
 * stays on the one being walked. Zero-length segments are skipped.
 *
 * @throws {RangeError} When the route is invalid, `position` is not finite,
 * the window is empty, or every segment in it has zero length.
 * @see {@linkcode cumulativeRouteLengthsM}
 */
export function projectOntoRoute(
  points: readonly GeoWorldPosition[],
  position: GeoWorldPosition,
  window: RouteProjectionWindow = {},
): RouteProjection {
  const cumulative = cumulativeRouteLengthsM(points)
  if (!Number.isFinite(position[0]) || !Number.isFinite(position[2])) {
    throw new RangeError('position must be finite')
  }
  const last = points.length - 2
  const from = window.fromSegment ?? 0
  const to = window.toSegment ?? last
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > last || from > to) {
    throw new RangeError(`segment window must lie within 0..${last}`)
  }

  let best: RouteProjection | undefined
  for (let i = from; i <= to; i += 1) {
    const a = points[i]!
    const b = points[i + 1]!
    // East/north components: x is east, north is −z.
    const de = b[0] - a[0]
    const dn = -(b[2] - a[2])
    const lengthSq = de * de + dn * dn
    if (lengthSq === 0) continue
    const pe = position[0] - a[0]
    const pn = -(position[2] - a[2])
    const t = Math.min(1, Math.max(0, (pe * de + pn * dn) / lengthSq))
    const point: GeoWorldPosition = [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]
    const distanceM = Math.hypot(position[0] - point[0], position[2] - point[2])
    if (best && distanceM >= best.distanceM) continue
    const cross = de * pn - dn * pe
    best = {
      segmentIndex: i,
      t,
      point,
      alongTrackM: cumulative[i]! + Math.sqrt(lengthSq) * t,
      crossTrackM: cross >= 0 ? distanceM : -distanceM,
      distanceM,
    }
  }
  if (!best) throw new RangeError('every segment in the window has zero length')
  return best
}

/**
 * Compass bearing of the route at `alongTrackM`, in degrees clockwise from
 * true north. Ground chevrons placed along the route should face this
 * direction so they bend at the next turn instead of pointing at the
 * destination. Viro yaw is counter-clockwise, so a chevron node needs
 * `rotation = [0, -bearing, 0]` in an unrotated ENU-aligned parent.
 *
 * Distances outside the route clamp to the first or last segment.
 *
 * @throws {RangeError} When the route is invalid, `alongTrackM` is not
 * finite, or the route has no length.
 */
export function routeBearingAt(points: readonly GeoWorldPosition[], alongTrackM: number): number {
  const cumulative = cumulativeRouteLengthsM(points)
  if (!Number.isFinite(alongTrackM)) throw new RangeError('alongTrackM must be finite')
  if (cumulative[cumulative.length - 1] === 0) throw new RangeError('route has no length')
  let i = 0
  while (
    i < points.length - 2 &&
    (cumulative[i + 1]! <= alongTrackM || cumulative[i + 1] === cumulative[i])
  ) {
    i += 1
  }
  // Skip trailing zero-length segments backwards.
  while (i > 0 && cumulative[i + 1] === cumulative[i]) i -= 1
  const a = points[i]!
  const b = points[i + 1]!
  const degrees = (Math.atan2(b[0] - a[0], -(b[2] - a[2])) * 180) / Math.PI
  return degrees < 0 ? degrees + 360 : degrees
}
