#if os(iOS)
import CoreGraphics
import MapboxMaps
import NitroModules

/// `MapboxMapViewMethods.queryRenderedFeatures`.
///
/// SDK (11.32.0): `MapboxMap.queryRenderedFeatures(with:options:completion:)`
/// (`Foundation/MapboxMap.swift:1225`), `CGPoint` / `CGRect` conformances to
/// `RenderedQueryGeometryConvertible` (`Foundation/RenderedQueryGeometry.swift:35,41`),
/// `RenderedQueryOptions(layerIds:filter:)`
/// (`Foundation/Extensions/Core/RenderedQueryOptions.swift:10`).
extension MapView {
  func queryRenderedFeatures(
    _ query: RenderedFeatureQuery,
    completion: @escaping (Result<[QueriedRenderedFeature], Error>) -> Void
  ) throws {
    if let layerIds = query.layerIds {
      guard !layerIds.isEmpty else {
        throw RuntimeError.error(withMessage: "layerIds must not be empty; omit it to query every layer")
      }
      if let unknown = layerIds.first(where: { !mapboxMap.layerExists(withId: $0) }) {
        throw RuntimeError.error(withMessage: "layerIds names \"\(unknown)\", which is not a layer in the loaded style")
      }
    }
    let options = RenderedQueryOptions(layerIds: query.layerIds, filter: nil)
    switch query.area {
    case .first(let point):
      let cgPoint = CGPoint(x: point.x, y: point.y)
      guard bounds.contains(cgPoint) else {
        throw RuntimeError.error(withMessage: "Query point (\(point.x), \(point.y)) lies outside the map view")
      }
      mapboxMap.queryRenderedFeatures(with: cgPoint, options: options, completion: completion)
    case .second(let box):
      guard box.min.x <= box.max.x, box.min.y <= box.max.y else {
        throw RuntimeError.error(withMessage: "Query box is inverted: min must be at or above-left of max")
      }
      let rect = CGRect(x: box.min.x, y: box.min.y, width: box.max.x - box.min.x, height: box.max.y - box.min.y)
      guard bounds.contains(rect) else {
        throw RuntimeError.error(withMessage: "Query box lies outside the map view")
      }
      mapboxMap.queryRenderedFeatures(with: rect, options: options, completion: completion)
    }
  }
}
#endif
