package com.margelo.nitro.mapboxar.navigation

import com.mapbox.api.directions.v5.models.RouteLeg as DirectionsRouteLeg

internal fun DirectionsRouteLeg.toRouteLeg(): RouteLeg =
  RouteLeg(
    distanceM = distance() ?: 0.0,
    durationS = duration() ?: 0.0,
    steps = (steps() ?: emptyList()).map { it.toRouteStep() }.toTypedArray(),
  )
