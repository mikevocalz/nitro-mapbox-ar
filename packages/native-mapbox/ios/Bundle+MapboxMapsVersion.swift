#if os(iOS)
import Foundation
import MapboxMaps

extension Bundle {
  /// Version of the linked Mapbox Maps SDK, read from the `MapboxMaps.json`
  /// resource the SDK ships (`Sources/MapboxMaps/MapboxMaps.json`, which holds
  /// `{"version": "11.32.0"}` at the 11.32.0 tag). The lookup mirrors the
  /// SDK's internal `Bundle.mapboxMaps` (`Foundation/Extensions/Bundle+MapboxMaps.swift:10-26`):
  /// the framework bundle, or the `MapboxMapsResources` bundle CocoaPods adds.
  static var linkedMapboxMapsVersion: String? {
    let framework = Bundle(for: MapView.self)
    let resources = framework.path(forResource: "MapboxMapsResources", ofType: "bundle").flatMap(Bundle.init(path:))
    guard let url = (resources ?? framework).url(forResource: "MapboxMaps", withExtension: "json"),
          let data = try? Data(contentsOf: url),
          let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      return nil
    }
    return object["version"] as? String
  }
}
#endif
