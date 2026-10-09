#if os(iOS)
import Foundation
import MapboxMaps
import NitroModules

/// Style mutations behind `MapStyle`. Each checks its preconditions first so
/// the rejection names the id at fault; the SDK's own `StyleError` passes
/// through for anything else (for example an invalid paint property).
///
/// SDK (11.32.0, `Style/StyleManager.swift`): `addSource(_:dataId:)` :265,
/// `updateGeoJSONSource(withId:geoJSON:dataId:)` :332,
/// `addLayer(with:layerPosition:)` :714, `removeLayer(withId:)` :820,
/// `layerExists(withId:)` :834, `allLayerIdentifiers` :844,
/// `layerProperties(for:)` :933, `removeSource(withId:)` :1006,
/// `sourceExists(withId:)` :1015, `sourceProperties(for:)` :1059,
/// `setTerrain(_:)` :1293, `removeTerrain()` :1302, `styleImports` :620,
/// `setStyleImportConfigProperties(for:configs:)` :678,
/// `setProjection(_:)` :1861. `LayerPosition.below(String)` is in
/// MapboxCoreMaps 11.32.0 (`arm64-apple-ios.swiftinterface` line 85).
extension MapboxMap {
  func addGeoJsonSource(_ source: GeoJsonSource) throws {
    try requireNewSource(source.id)
    _ = try Self.parseGeoJson(source.data, field: "source \"\(source.id)\" data")
    var sdkSource = GeoJSONSource(id: source.id)
    sdkSource.data = .string(source.data)
    try addSource(sdkSource)
  }

  func setGeoJsonSourceData(sourceId: String, data: String) throws {
    guard sourceExists(withId: sourceId), try sourceType(sourceId) == "geojson" else {
      throw RuntimeError.error(withMessage: "No GeoJSON source has id \"\(sourceId)\"")
    }
    let object = try Self.parseGeoJson(data, field: "data for source \"\(sourceId)\"")
    updateGeoJSONSource(withId: sourceId, geoJSON: object)
  }

  func addRasterDemSource(_ source: RasterDemSource) throws {
    try requireNewSource(source.id)
    var sdkSource = MapboxMaps.RasterDemSource(id: source.id)
    sdkSource.url = source.url
    if let tileSizePx = source.tileSizePx {
      guard tileSizePx.isFinite, tileSizePx > 0 else {
        throw RuntimeError.error(withMessage: "tileSizePx must be a positive number, got \(tileSizePx)")
      }
      sdkSource.tileSize = tileSizePx
    }
    try addSource(sdkSource)
  }

  func addVectorSource(_ source: VectorSource) throws {
    try requireNewSource(source.id)
    var sdkSource = MapboxMaps.VectorSource(id: source.id)
    sdkSource.url = source.url
    try addSource(sdkSource)
  }

  func removeSourceChecked(_ sourceId: String) throws {
    guard sourceExists(withId: sourceId) else {
      throw RuntimeError.error(withMessage: "No source has id \"\(sourceId)\"")
    }
    for layer in allLayerIdentifiers {
      let source = try layerProperties(for: layer.id)["source"] as? String
      if source == sourceId {
        throw RuntimeError.error(withMessage: "Source \"\(sourceId)\" is still used by layer \"\(layer.id)\"; remove the layer first")
      }
    }
    try removeSource(withId: sourceId)
  }

  func addStyleLayer(_ layer: StyleLayer, belowLayerId: String?) throws {
    guard !layerExists(withId: layer.id) else {
      throw RuntimeError.error(withMessage: "A layer with id \"\(layer.id)\" already exists")
    }
    if let sourceId = layer.sourceId, !sourceExists(withId: sourceId) {
      throw RuntimeError.error(withMessage: "Layer \"\(layer.id)\" names source \"\(sourceId)\", which does not exist")
    }
    if let belowLayerId, !layerExists(withId: belowLayerId) {
      throw RuntimeError.error(withMessage: "belowLayerId \"\(belowLayerId)\" names no layer")
    }
    var properties: [String: Any] = ["id": layer.id, "type": layer.type.stringValue]
    if let sourceId = layer.sourceId { properties["source"] = sourceId }
    if let sourceLayer = layer.sourceLayer { properties["source-layer"] = sourceLayer }
    if let paint = layer.paint { properties["paint"] = paint.styleProperties }
    if let layout = layer.layout { properties["layout"] = layout.styleProperties }
    try addLayer(with: properties, layerPosition: belowLayerId.map { .below($0) })
  }

  func removeLayerChecked(_ layerId: String) throws {
    guard layerExists(withId: layerId) else {
      throw RuntimeError.error(withMessage: "No layer has id \"\(layerId)\"")
    }
    try removeLayer(withId: layerId)
  }

  func setTerrain(_ options: TerrainOptions) throws {
    guard sourceExists(withId: options.sourceId), try sourceType(options.sourceId) == "raster-dem" else {
      throw RuntimeError.error(withMessage: "No raster DEM source has id \"\(options.sourceId)\"; add one with MapStyle.addRasterDemSource")
    }
    var terrain = Terrain(sourceId: options.sourceId)
    if let exaggeration = options.exaggeration {
      guard exaggeration.isFinite, (0.0...1000.0).contains(exaggeration) else {
        throw RuntimeError.error(withMessage: "exaggeration must be between 0 and 1000, got \(exaggeration)")
      }
      terrain.exaggeration = .constant(exaggeration)
    }
    try setTerrain(terrain)
  }

  func setStandardConfig(_ config: StandardStyleConfig) throws {
    let importId = config.importId ?? "basemap"
    guard styleImports.contains(where: { $0.id == importId }) else {
      throw RuntimeError.error(withMessage:
        "The loaded style has no import \"\(importId)\"; load MapStyles.standard to use Standard configuration")
    }
    var configs: [String: Any] = [:]
    if let lightPreset = config.lightPreset { configs["lightPreset"] = lightPreset.stringValue }
    if let show3dObjects = config.show3dObjects { configs["show3dObjects"] = show3dObjects }
    if let showLabels = config.showPointOfInterestLabels { configs["showPointOfInterestLabels"] = showLabels }
    try setStyleImportConfigProperties(for: importId, configs: configs)
  }

  func apply(projection: MapProjection) throws {
    let name: StyleProjectionName = projection == .globe ? .globe : .mercator
    try setProjection(StyleProjection(name: name))
  }

  private func requireNewSource(_ sourceId: String) throws {
    guard !sourceExists(withId: sourceId) else {
      throw RuntimeError.error(withMessage: "A source with id \"\(sourceId)\" already exists")
    }
  }

  private func sourceType(_ sourceId: String) throws -> String? {
    try sourceProperties(for: sourceId)["type"] as? String
  }

  private static func parseGeoJson(_ text: String, field: String) throws -> GeoJSONObject {
    do {
      return try JSONDecoder().decode(GeoJSONObject.self, from: Data(text.utf8))
    } catch {
      throw RuntimeError.error(withMessage: "\(field) is not valid GeoJSON: \(error.localizedDescription)")
    }
  }
}
#endif
