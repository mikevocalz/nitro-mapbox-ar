#if os(iOS)
import CoreGraphics
import MapboxMaps
import NitroModules

extension CameraTarget {
  /// Converts the request into SDK camera options, rejecting non-finite
  /// numbers and coordinates outside WGS84. Omitted fields stay `nil`, so the
  /// SDK keeps their current value.
  ///
  /// SDK: `CameraOptions.init(center:padding:anchor:zoom:bearing:pitch:)`
  /// (MapboxCoreMaps 11.32.0 `arm64-apple-ios.swiftinterface`).
  func cameraOptions(_ field: String) throws -> CameraOptions {
    for (name, value) in [("zoom", zoom), ("bearingDeg", bearingDeg), ("pitchDeg", pitchDeg)] {
      if let value, !value.isFinite {
        throw RuntimeError.error(withMessage: "\(field).\(name) must be finite, got \(value)")
      }
    }
    return CameraOptions(
      center: try center?.validated("\(field).center"),
      padding: try padding?.validated("\(field).padding"),
      zoom: zoom.map { CGFloat($0) },
      bearing: bearingDeg,
      pitch: pitchDeg.map { CGFloat($0) }
    )
  }
}
#endif
