package com.margelo.nitro.mapboxar.navigation

import com.mapbox.common.location.Location
import com.mapbox.navigation.base.trip.model.RouteProgress

/** Progress for JS; [location] is the last map-matched location. */
internal fun RouteProgress.toNavigationProgress(location: Location?): NavigationProgress =
  NavigationProgress(
    location = location?.let { GeographicCoordinate(it.latitude, it.longitude, it.altitude) }
      ?: GeographicCoordinate(0.0, 0.0, null),
    bearing = location?.bearing,
    speedMetersPerSecond = location?.speed,
    distanceRemaining = distanceRemaining.toDouble(),
    durationRemaining = durationRemaining,
    fractionTraveled = fractionTraveled.toDouble(),
    currentLegIndex = (currentLegProgress?.legIndex ?: 0).toDouble(),
    currentStepIndex = currentLegProgress?.currentStepProgress?.stepIndex?.toDouble(),
    upcomingManeuver = currentLegProgress?.upcomingStep?.toNavigationManeuver(),
  )
