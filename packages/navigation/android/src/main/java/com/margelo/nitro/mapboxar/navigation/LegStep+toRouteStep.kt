package com.margelo.nitro.mapboxar.navigation

import com.mapbox.api.directions.v5.models.LegStep

/**
 * `geometry` is left out: the SDK's steps carry an encoded polyline whose
 * precision depends on the request, and the field is optional.
 */
internal fun LegStep.toRouteStep(): RouteStep =
  RouteStep(
    maneuver = toNavigationManeuver(),
    distanceM = distance(),
    durationS = duration(),
    streetName = name() ?: "",
    geometry = null,
  )
