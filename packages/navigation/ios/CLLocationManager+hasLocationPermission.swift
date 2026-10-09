import CoreLocation

extension CLLocationManager {
  /// Whether the app may read the device location in the foreground.
  static var hasLocationPermission: Bool {
    switch CLLocationManager().authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      return true
    default:
      return false
    }
  }
}
