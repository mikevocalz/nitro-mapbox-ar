import CoreLocation

extension CLLocationCoordinate2D {
  var geographicCoordinate: GeographicCoordinate {
    GeographicCoordinate(latitude: latitude, longitude: longitude, altitude: nil)
  }
}
