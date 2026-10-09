import type { NavigationRoute } from './client'

/**
 * Traffic totals for one {@linkcode NavigationRoute}, from
 * {@linkcode summarizeRouteTraffic}. Congestion values are the Directions API
 * `congestion_numeric` scale, 0 (free flow) to 100 (stopped).
 */
export interface RouteTrafficSummary {
  /** Segments across all legs, counting those with no congestion value. */
  readonly segments: number
  /** Segments that carried a finite congestion value. */
  readonly reportedSegments: number
  /** Highest congestion value on the route; `null` when no segment reported one. */
  readonly maxCongestion: number | null
  /** Mean of the reported congestion values; `null` when no segment reported one. */
  readonly averageCongestion: number | null
  /** Reported segments with congestion of 80 or more. */
  readonly severeSegments: number
  /** Entries in the legs' `closure` annotations, summed. */
  readonly closures: number
}

/**
 * Totals the `congestion_numeric` and `closure` annotations on every leg of
 * `route`. Request the route with those annotations, which
 * `MapboxNavigationClient.directions` does by default for the
 * `driving-traffic` profile. A route without them summarises to zero counts
 * and `null` congestion. Does not throw.
 */
export function summarizeRouteTraffic(route: NavigationRoute): RouteTrafficSummary {
  let segments = 0
  let reportedSegments = 0
  let congestionTotal = 0
  let maxCongestion: number | null = null
  let severeSegments = 0
  let closures = 0

  for (const leg of route.legs) {
    const values = leg.annotation?.congestion_numeric ?? []
    segments += values.length

    for (const value of values) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue
      reportedSegments += 1
      congestionTotal += value
      maxCongestion = maxCongestion === null ? value : Math.max(maxCongestion, value)
      if (value >= 80) severeSegments += 1
    }

    closures += leg.annotation?.closure?.length ?? 0
  }

  return {
    segments,
    reportedSegments,
    maxCongestion,
    averageCongestion:
      reportedSegments === 0 ? null : congestionTotal / reportedSegments,
    severeSegments,
    closures,
  }
}
