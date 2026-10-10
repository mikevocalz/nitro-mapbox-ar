#if os(iOS)
import MapboxMaps
import NitroModules

/// Handle to one loaded style. Every method rejects once another style load
/// starts on the same map, or once the map unmounts.
final class HybridMapStyle: HybridMapStyleSpec {
  let uri: String
  private let generation: UInt64
  private weak var host: MapHost?

  init(uri: String, generation: UInt64, host: MapHost) {
    self.uri = uri
    self.generation = generation
    self.host = host
    super.init()
  }

  func addGeoJsonSource(source: GeoJsonSource) throws -> Promise<Void> {
    mutate("addGeoJsonSource") { try $0.addGeoJsonSource(source) }
  }

  func setGeoJsonSourceData(sourceId: String, data: String) throws -> Promise<Void> {
    mutate("setGeoJsonSourceData") { try $0.setGeoJsonSourceData(sourceId: sourceId, data: data) }
  }

  func addRasterDemSource(source: RasterDemSource) throws -> Promise<Void> {
    mutate("addRasterDemSource") { try $0.addRasterDemSource(source) }
  }

  func addVectorSource(source: VectorSource) throws -> Promise<Void> {
    mutate("addVectorSource") { try $0.addVectorSource(source) }
  }

  func removeSource(sourceId: String) throws -> Promise<Void> {
    mutate("removeSource") { try $0.removeSourceChecked(sourceId) }
  }

  func addLayer(layer: StyleLayer, belowLayerId: String?) throws -> Promise<Void> {
    mutate("addLayer") { try $0.addStyleLayer(layer, belowLayerId: belowLayerId) }
  }

  func removeLayer(layerId: String) throws -> Promise<Void> {
    mutate("removeLayer") { try $0.removeLayerChecked(layerId) }
  }

  /// SDK: `StyleManager.addImage(_:id:sdf:contentInsets:)`
  /// (`Style/StyleManager.swift:1188`), which takes the scale from `UIImage.scale`.
  func addStyleImage(id: String, image: StyleImageSource, options: StyleImageOptions?) throws -> Promise<Void> {
    let scale = options?.scale ?? 1
    guard scale.isFinite, scale > 0 else {
      return .rejected(withError: RuntimeError.error(withMessage: "options.scale must be greater than 0, got \(scale)"))
    }
    let sdf = options?.sdf ?? false
    return MainThreadPromise.run(after: { image.loadImage(scale: scale, completion: $0) }) { decoded in
      try self.liveStyleMap("addStyleImage").addImage(decoded, id: id, sdf: sdf)
    }
  }

  func removeStyleImage(id: String) throws -> Promise<Void> {
    mutate("removeStyleImage") { try $0.removeImageChecked(id) }
  }

  func setTerrain(terrain: TerrainOptions) throws -> Promise<Void> {
    mutate("setTerrain") { try $0.setTerrain(terrain) }
  }

  func clearTerrain() throws -> Promise<Void> {
    mutate("clearTerrain") { $0.removeTerrain() }
  }

  func setStandardConfig(config: StandardStyleConfig) throws -> Promise<Void> {
    mutate("setStandardConfig") { try $0.setStandardConfig(config) }
  }

  private func mutate(_ operation: String, _ body: @escaping (MapboxMap) throws -> Void) -> Promise<Void> {
    MainThreadPromise.run {
      try body(self.liveStyleMap(operation))
    }
  }

  /// The map's style while this handle is current. Main thread only.
  private func liveStyleMap(_ operation: String) throws -> MapboxMap {
    guard let map = host?.liveStyleMap(generation: generation) else {
      throw RuntimeError.error(withMessage: "This MapStyle was replaced (MapStyle.\(operation)); use the handle from the latest style load")
    }
    return map
  }
}
#endif
