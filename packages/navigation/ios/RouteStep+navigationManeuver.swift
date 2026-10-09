import MapboxDirections

extension MapboxDirections.RouteStep {
  /// The step's manoeuvre with `kind` and `modifier` as Directions API
  /// strings (`ManeuverType.rawValue`, `ManeuverDirection.rawValue` in
  /// MapboxDirections/RouteStep.swift).
  var navigationManeuver: NavigationManeuver {
    NavigationManeuver(
      kind: maneuverType.rawValue,
      modifier: maneuverDirection?.rawValue,
      location: maneuverLocation.geographicCoordinate,
      bearingBeforeDeg: initialHeading ?? 0,
      bearingAfterDeg: finalHeading ?? 0,
      instruction: instructions,
      exitNumber: exitIndex.map(Double.init)
    )
  }
}
