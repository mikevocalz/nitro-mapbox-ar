#if os(iOS)
import CoreLocation
import NitroModules

extension GeographicCoordinate {
  /// Builds the Nitro value from an SDK coordinate. Altitude is not set.
  init(_ coordinate: CLLocationCoordinate2D) {
    self.init(latitude: coordinate.latitude, longitude: coordinate.longitude, altitude: nil)
  }

  /// Returns the SDK coordinate after checking WGS84 bounds.
  ///
  /// - Parameter field: Name used in the error message, for example `target.center`.
  func validated(_ field: String) throws -> CLLocationCoordinate2D {
    guard latitude.isFinite, longitude.isFinite,
          (-90.0...90.0).contains(latitude), (-180.0...180.0).contains(longitude) else {
      throw RuntimeError.error(withMessage:
        "\(field) must be a WGS84 coordinate (latitude -90 to 90, longitude -180 to 180), got \(latitude), \(longitude)")
    }
    return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
  }
}
#endif
