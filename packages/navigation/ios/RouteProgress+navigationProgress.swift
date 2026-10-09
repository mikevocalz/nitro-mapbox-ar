import CoreLocation
import MapboxNavigationCore

extension RouteProgress {
  /// Progress for JS. `location` is the map-matched location from
  /// `MapMatchingState.enhancedLocation`; the SDK reports speed and course as
  /// negative when unknown.
  func navigationProgress(location: CLLocation) -> NavigationProgress {
    NavigationProgress(
      location: location.geographicCoordinate,
      bearing: location.course >= 0 ? location.course : nil,
      speedMetersPerSecond: location.speed >= 0 ? location.speed : nil,
      distanceRemaining: distanceRemaining,
      durationRemaining: durationRemaining,
      fractionTraveled: fractionTraveled,
      currentLegIndex: Double(legIndex),
      currentStepIndex: Double(currentLegProgress.stepIndex),
      upcomingManeuver: upcomingStep?.navigationManeuver
    )
  }
}
