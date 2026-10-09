import MapboxDirections

extension MapboxDirections.RouteStep {
  var routeStep: RouteStep {
    RouteStep(
      maneuver: navigationManeuver,
      distanceM: distance,
      durationS: expectedTravelTime,
      streetName: names?.first ?? "",
      geometry: shape?.coordinates.map(\.geographicCoordinate)
    )
  }
}
