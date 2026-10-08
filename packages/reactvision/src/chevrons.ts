import { cumulativeRouteLengthsM } from './routeMatch'
import type { GeoWorldPosition } from './types'

/**
 * One ground chevron placed by {@linkcode layoutRouteChevrons}, in the same
 * node-local Viro axes as the projected route.
 *
 * @see {@linkcode MapboxViroChevrons}
 */
export interface RouteChevron {
  /** Horizontal metres from the route start; a multiple of the spacing. */
  readonly alongTrackM: number
  /** Point on the route, with `y` interpolated along the segment. */
  readonly position: GeoWorldPosition
  /** Route direction at this point, degrees clockwise from true north. */
  readonly bearingDeg: number
  /** Viro rotation `[0, −bearingDeg, 0]` for an arrow authored pointing at −z. */
  readonly rotation: GeoWorldPosition
  /** 1 for most chevrons; lower for the last few when the run is cut short. */
  readonly opacity: number
}

/** Options for {@linkcode layoutRouteChevrons}. */
export interface RouteChevronLayoutOptions {
  /** The user's matched along-track distance, for example from `projectOntoRoute`. */
  readonly fromAlongTrackM: number
  /** Gap kept clear in front of the user before the first chevron. @default 2 */
  readonly startOffsetM?: number
  /** Farthest distance ahead of the user to place chevrons. @default 25 */
  readonly lookaheadM?: number
  /**
   * Along-track distance where chevrons must stop, such as the next
   * manoeuvre plus 5 m. @default the route end
   */
  readonly stopAlongTrackM?: number
  /** Distance between chevrons. @default 2.5 */
  readonly spacingM?: number
  /** Most chevrons to return. @default 10 */
  readonly maxCount?: number
  /**
   * How many trailing chevrons fade out when the lookahead or `maxCount`
   * ends the run. Runs that end at `stopAlongTrackM` or the route end do not
   * fade. @default 3
   */
  readonly fadeCount?: number
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite number ≥ 0`)
  }
}

const EPSILON_M = 1e-9

/**
 * Places ground chevrons along a projected route, ahead of the user.
 *
 * Chevrons sit at whole multiples of `spacingM` along the route, so they stay
 * fixed in the world as the user walks instead of sliding with them. Each one
 * faces the route direction at its own position, so a run that crosses a
 * corner bends with it and points at the next turn, never straight at the
 * destination. Chevrons only ever sit on route geometry.
 *
 * `points` are node-local Viro positions from `projectRouteToEnu`. Project
 * the route once per route version and reuse the points.
 *
 * @throws {RangeError} When the route has fewer than two points or any is not
 * finite, or an option is negative or not finite.
 * @see {@linkcode MapboxViroChevrons}
 */
export function layoutRouteChevrons(
  points: readonly GeoWorldPosition[],
  options: RouteChevronLayoutOptions,
): RouteChevron[] {
  const cumulative = cumulativeRouteLengthsM(points)
  const total = cumulative[cumulative.length - 1]!
  const startOffsetM = options.startOffsetM ?? 2
  const lookaheadM = options.lookaheadM ?? 25
  const spacingM = options.spacingM ?? 2.5
  const maxCount = options.maxCount ?? 10
  const fadeCount = options.fadeCount ?? 3
  if (!Number.isFinite(options.fromAlongTrackM)) {
    throw new RangeError('fromAlongTrackM must be finite')
  }
  assertNonNegativeFinite(startOffsetM, 'startOffsetM')
  assertNonNegativeFinite(lookaheadM, 'lookaheadM')
  assertNonNegativeFinite(maxCount, 'maxCount')
  assertNonNegativeFinite(fadeCount, 'fadeCount')
  if (!Number.isFinite(spacingM) || spacingM <= 0) {
    throw new RangeError('spacingM must be a positive finite number')
  }
  if (options.stopAlongTrackM !== undefined && !Number.isFinite(options.stopAlongTrackM)) {
    throw new RangeError('stopAlongTrackM must be finite')
  }
  if (total === 0) return []

  const lookaheadLimit = options.fromAlongTrackM + lookaheadM
  const hardLimit = Math.min(options.stopAlongTrackM ?? total, total)
  const limit = Math.min(lookaheadLimit, hardLimit)
  const firstIndex = Math.max(
    0,
    Math.ceil((options.fromAlongTrackM + startOffsetM) / spacingM - EPSILON_M),
  )

  const out: Array<Omit<RouteChevron, 'opacity'>> = []
  let segment = 0
  for (let k = firstIndex; out.length < Math.floor(maxCount); k += 1) {
    const along = k * spacingM
    if (along > limit + EPSILON_M) break
    while (
      segment < points.length - 2 &&
      (cumulative[segment + 1]! <= along || cumulative[segment + 1] === cumulative[segment])
    ) {
      segment += 1
    }
    while (segment > 0 && cumulative[segment + 1] === cumulative[segment]) segment -= 1
    const a = points[segment]!
    const b = points[segment + 1]!
    const length = cumulative[segment + 1]! - cumulative[segment]!
    const t = length === 0 ? 0 : Math.min(1, Math.max(0, (along - cumulative[segment]!) / length))
    const degrees = (Math.atan2(b[0] - a[0], -(b[2] - a[2])) * 180) / Math.PI
    const bearingDeg = degrees < 0 ? degrees + 360 : degrees
    out.push({
      alongTrackM: along,
      position: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
      bearingDeg,
      rotation: [0, bearingDeg === 0 ? 0 : -bearingDeg, 0],
    })
  }

  const nextAlong = (firstIndex + out.length) * spacingM
  const cutShort =
    out.length > 0 && hardLimit > lookaheadLimit + EPSILON_M
      ? true
      : out.length >= maxCount && nextAlong <= hardLimit + EPSILON_M
  const fade = cutShort ? Math.min(Math.floor(fadeCount), out.length) : 0
  return out.map((chevron, index) => {
    const fromEnd = out.length - index
    return {
      ...chevron,
      opacity: fromEnd <= fade ? fromEnd / (fade + 1) : 1,
    }
  })
}
