#if os(iOS)
import Foundation
import MapboxMaps
import NitroModules

/// A rendered feature from `queryRenderedFeatures`. Geometry stays in the SDK
/// value until `toGeoJson()` encodes it.
///
/// SDK: `QueriedRenderedFeature.queriedFeature` / `.layers`
/// (`MBMQueriedRenderedFeature.h:24,31`), `QueriedFeature.source` /
/// `.sourceLayer` (`MBMQueriedFeature.h:24,30`), `QueriedFeature.feature`
/// (`Foundation/Extensions/Core/QueriedFeature.swift`), Turf 4.0.0
/// `Feature: Codable`, `FeatureIdentifier.string` / `.number`.
final class HybridRenderedFeature: HybridRenderedFeatureSpec {
  private let feature: Feature
  let featureId: String?
  let sourceId: String
  let sourceLayer: String?
  let layerIds: [String]

  init(_ queried: QueriedRenderedFeature) {
    feature = queried.queriedFeature.feature
    if case .string(let value) = feature.identifier {
      featureId = value
    } else if case .number(let value) = feature.identifier {
      featureId = value.rounded() == value ? String(Int64(value)) : String(value)
    } else {
      featureId = nil
    }
    sourceId = queried.queriedFeature.source
    sourceLayer = queried.queriedFeature.sourceLayer
    layerIds = queried.layers
    super.init()
  }

  func toGeoJson() throws -> String {
    let data = try JSONEncoder().encode(feature)
    return String(decoding: data, as: UTF8.self)
  }
}
#endif
