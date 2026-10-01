import type { NavigationRoute } from './client'

export interface RouteTrafficSummary {
  readonly segments: number
  readonly reportedSegments: number
  readonly maxCongestion: number | null
  readonly averageCongestion: number | null
  readonly severeSegments: number
  readonly closures: number
}

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
