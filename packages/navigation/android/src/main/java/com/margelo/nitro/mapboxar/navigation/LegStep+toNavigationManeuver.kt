package com.margelo.nitro.mapboxar.navigation

import com.mapbox.api.directions.v5.models.LegStep

/** The step's manoeuvre with Directions API strings for `kind` and `modifier`. */
internal fun LegStep.toNavigationManeuver(): NavigationManeuver {
  val maneuver = maneuver()
  return NavigationManeuver(
    kind = maneuver.type() ?: "unknown",
    modifier = maneuver.modifier(),
    location = maneuver.location().toGeographicCoordinate(),
    bearingBeforeDeg = maneuver.bearingBefore() ?: 0.0,
    bearingAfterDeg = maneuver.bearingAfter() ?: 0.0,
    instruction = maneuver.instruction() ?: "",
    exitNumber = maneuver.exit()?.toDouble(),
  )
}
