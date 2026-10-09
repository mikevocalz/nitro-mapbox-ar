#if os(iOS)
import Foundation
import MapboxMaps

extension Bundle {
  /// Version of the linked Mapbox Maps SDK, read from the `MapboxMaps.json`
  /// resource the SDK ships (`Sources/MapboxMaps/MapboxMaps.json`, which holds
  /// `{"version": "11.32.0"}` at the 11.32.0 tag). The lookup mirrors the
  /// SDK's internal `Bundle.mapboxMaps` (`Foundation/Extensions/Bundle+MapboxMaps.swift:10-26`):
  /// the `MapboxMaps_MapboxMaps` bundle Swift Package Manager builds for the
  /// package's resources, the `MapboxMapsResources` bundle CocoaPods adds, or
  /// the framework bundle itself.
  static var linkedMapboxMapsVersion: String? {
    let framework = Bundle(for: MapView.self)
    let resources = ["MapboxMaps_MapboxMaps", "MapboxMapsResources"].lazy
      .compactMap { framework.path(forResource: $0, ofType: "bundle") ?? Bundle.main.path(forResource: $0, ofType: "bundle") }
      .compactMap(Bundle.init(path:))
      .first
    guard let url = (resources ?? framework).url(forResource: "MapboxMaps", withExtension: "json"),
          let data = try? Data(contentsOf: url),
          let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      return nil
    }
    return object["version"] as? String
  }
}
#endif
