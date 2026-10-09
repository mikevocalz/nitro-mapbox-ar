import NitroModules
#if os(iOS)
import MapboxMaps
#endif

#if os(iOS)
/// The `MapboxMaps` root.
final class HybridMapboxMaps: HybridMapboxMapsSpec {
  /// The pod only builds where MapboxMaps links, so a constructed root means
  /// the view can render.
  let isMapViewAvailable = true

  let sdkVersion: String = Bundle.linkedMapboxMapsVersion ?? "unknown"

  /// SDK evidence (11.32.0): `StyleProjectionName.globe`
  /// (`Style/Generated/Properties/Properties.swift:743`), `StyleManager.setTerrain(_:)`
  /// (`Style/StyleManager.swift:1293`), `ModelLayer` (`Style/Generated/Layers/ModelLayer.swift:7`).
  /// Every supported iPhone has location hardware.
  let capabilities = MapCapabilities(
    supportsGlobeProjection: true,
    supportsTerrain: true,
    supportsModelLayers: true,
    supportsLocationPuck: true
  )
}
#else
/// The `MapboxMaps` root where the Maps SDK is not used. The Swift sources
/// import MapboxMaps only under `#if os(iOS)`, so on visionOS this pod builds
/// without the map view.
final class HybridMapboxMaps: HybridMapboxMapsSpec {
  let isMapViewAvailable = false
  let sdkVersion = ""
  let capabilities = MapCapabilities(
    supportsGlobeProjection: false,
    supportsTerrain: false,
    supportsModelLayers: false,
    supportsLocationPuck: false
  )
}
#endif
