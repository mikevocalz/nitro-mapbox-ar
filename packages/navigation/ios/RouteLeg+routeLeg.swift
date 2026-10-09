import MapboxDirections

extension MapboxDirections.RouteLeg {
  var routeLeg: RouteLeg {
    RouteLeg(
      distanceM: distance,
      durationS: expectedTravelTime,
      steps: steps.map(\.routeStep)
    )
  }
}
