#if os(iOS)
import CoreLocation
import MapboxMaps
import NitroModules

/// Camera commands for `MapboxMapViewMethods.flyTo`, `easeTo` and `fitBounds`.
///
/// SDK (11.32.0): `CameraAnimationsManager.fly(to:duration:curve:completion:)`
/// and `ease(to:duration:curve:completion:)` (`Camera/CameraAnimationsManager.swift:41,61`),
/// `MapboxMap.setCamera(to:)` (`Foundation/MapboxMap.swift:923`),
/// `MapboxMap.camera(for:camera:coordinatesPadding:maxZoom:offset:)`
/// (`Foundation/MapboxMap.swift:707`).
extension MapView {
  /// `easeTo` and `fitBounds` duration when the caller passes none.
  static let defaultEaseDurationMs = 300.0

  func fly(
    to target: CameraTarget,
    durationMs: Double?,
    completion: @escaping (CameraAnimationEnd) -> Void
  ) throws {
    let options = try target.cameraOptions("target")
    let seconds = try Self.seconds(durationMs)
    if seconds == 0 {
      mapboxMap.setCamera(to: options)
      completion(.finished)
      return
    }
    camera.fly(to: options, duration: seconds) { completion(CameraAnimationEnd($0)) }
  }

  func ease(
    to target: CameraTarget,
    durationMs: Double?,
    completion: @escaping (CameraAnimationEnd) -> Void
  ) throws {
    try ease(to: target.cameraOptions("target"), durationMs: durationMs, completion: completion)
  }

  func fit(
    _ bounds: CoordinateBounds,
    options: FitBoundsOptions?,
    completion: @escaping (CameraAnimationEnd) -> Void
  ) throws {
    let southwest = try bounds.southwest.validated("bounds.southwest")
    var northeast = try bounds.northeast.validated("bounds.northeast")
    guard southwest.latitude <= northeast.latitude else {
      throw RuntimeError.error(withMessage:
        "bounds.southwest.latitude (\(southwest.latitude)) must not exceed bounds.northeast.latitude (\(northeast.latitude))")
    }
    if southwest.longitude > northeast.longitude {
      // Crosses the antimeridian: unwrap so the rectangle spans east.
      northeast.longitude += 360
    }
    for (name, value) in [("bearingDeg", options?.bearingDeg), ("pitchDeg", options?.pitchDeg), ("maxZoom", options?.maxZoom)] {
      if let value, !value.isFinite {
        throw RuntimeError.error(withMessage: "options.\(name) must be finite, got \(value)")
      }
    }
    let target = try mapboxMap.camera(
      for: [southwest, northeast],
      camera: CameraOptions(
        bearing: options?.bearingDeg ?? 0,
        pitch: CGFloat(options?.pitchDeg ?? 0)
      ),
      coordinatesPadding: try options?.padding?.validated("options.padding"),
      maxZoom: options?.maxZoom,
      offset: nil
    )
    try ease(to: target, durationMs: options?.durationMs, completion: completion)
  }

  private func ease(
    to options: CameraOptions,
    durationMs: Double?,
    completion: @escaping (CameraAnimationEnd) -> Void
  ) throws {
    let seconds = try Self.seconds(durationMs) ?? Self.defaultEaseDurationMs / 1000
    if seconds == 0 {
      mapboxMap.setCamera(to: options)
      completion(.finished)
      return
    }
    camera.ease(to: options, duration: seconds) { completion(CameraAnimationEnd($0)) }
  }

  private static func seconds(_ durationMs: Double?) throws -> TimeInterval? {
    guard let durationMs else { return nil }
    guard durationMs.isFinite, durationMs >= 0 else {
      throw RuntimeError.error(withMessage: "options.durationMs must be finite and >= 0, got \(durationMs)")
    }
    return durationMs / 1000
  }
}
#endif
