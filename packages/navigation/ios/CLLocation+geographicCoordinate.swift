import CoreLocation

extension CLLocation {
  var geographicCoordinate: GeographicCoordinate {
    GeographicCoordinate(
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      altitude: verticalAccuracy >= 0 ? altitude : nil
    )
  }
}
