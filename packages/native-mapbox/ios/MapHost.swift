#if os(iOS)
import MapboxMaps
import NitroMapboxAR
import NitroModules
import UIKit

/// Owns the SDK `MapView` behind one `MapboxMapView`, its event
/// subscriptions and the style generation that `MapStyle` handles check.
/// Main thread only, except the registries, which JS reaches directly.
///
/// SDK (11.32.0): `MapView.init(frame:mapInitOptions:)` (`Foundation/MapView.swift:324`),
/// `MapInitOptions.init(mapOptions:cameraOptions:styleURI:...)` (`Foundation/MapInitOptions.swift:58`),
/// `MapboxMap.load(mapStyle:transition:completion:)` (`Style/StyleManager.swift:579`),
/// `CancelError` (`Style/StyleErrors.swift:26`), `onCameraChanged` / `onStyleLoaded` /
/// `onMapLoadingError` (`Foundation/MapboxMap.swift:1458,1442,1436`),
/// `CameraChanged.cameraState` (`MapEvents/CoreEventsExtensions.swift:9`),
/// `addInteraction(_:)` + `TapInteraction(action:)` (`Foundation/MapboxMap.swift:2034`,
/// `Interactions/Interactions.swift:61`), `GestureManager.options`
/// (`Gestures/GestureManager.swift:20`), `MapboxOptions.accessToken` (MapboxCommon,
/// re-exported by `Foundation/Reexports.swift:2`).
final class MapHost {
  let container = UIView()
  let cameraChanged = ListenerRegistry<CameraState>()
  let mapTapped = ListenerRegistry<MapTapEvent>()
  let styleLoaded = ListenerRegistry<any HybridMapStyleSpec>()
  let loadingFailed = ListenerRegistry<Error>()

  private(set) var mapView: MapView?
  /// The `projection` prop; applied now and after every style load, because
  /// projection is a style property.
  var projection: MapProjection? {
    didSet { applyProjection() }
  }
  private var styleGeneration: UInt64 = 0
  private var styleUri = ""
  private var currentStyle: HybridMapStyle?
  private var pendingStyleLoads: [UInt64: (Result<any HybridMapStyleSpec, Error>) -> Void] = [:]
  private var signalTokens: [AnyCancelable] = []
  private var interactionTokens: [Cancelable] = []
  private var annotationManagers: [HybridPointAnnotationManager] = []
  private var reportedMissingToken = false

  /// Returns the map, creating it on first use once a token is set.
  ///
  /// - Throws: `Mapbox access token is not set (<operation>)` while
  ///   `MapboxAR.accessToken` is empty.
  func requireMap(_ operation: String, camera: CameraOptions? = nil) throws -> MapView {
    if let mapView { return mapView }
    let token = MapboxARAccessToken.current
    guard !token.isEmpty else {
      throw RuntimeError.error(withMessage: "Mapbox access token is not set (\(operation)); assign MapboxAR.accessToken first")
    }
    MapboxOptions.accessToken = token
    let map = MapView(frame: container.bounds, mapInitOptions: MapInitOptions(cameraOptions: camera, styleURI: nil))
    map.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    container.addSubview(map)
    mapView = map
    subscribe(map)
    return map
  }

  /// Creates the map for a prop update. A missing token is reported once to
  /// the loading-error listeners instead of thrown, since no JS call waits.
  func ensureMapForProps(camera: CameraOptions?) -> MapView? {
    do {
      let map = try requireMap("MapboxMapView", camera: camera)
      reportedMissingToken = false
      return map
    } catch {
      if !reportedMissingToken {
        reportedMissingToken = true
        loadingFailed.emit(error)
      }
      return nil
    }
  }

  /// Starts loading `uri`. The previous `MapStyle` handle goes stale now.
  /// `completion` gets the new handle, or `Style load superseded` when
  /// another load starts first.
  func loadStyle(_ uri: String, on map: MapView, completion: ((Result<any HybridMapStyleSpec, Error>) -> Void)?) {
    guard let styleURI = StyleURI(rawValue: uri) else {
      let error = RuntimeError.error(withMessage: "Malformed style URI \"\(uri)\"; pass a mapbox://styles/... or https:// URI")
      if let completion { completion(.failure(error)) } else { loadingFailed.emit(error) }
      return
    }
    styleGeneration += 1
    styleUri = uri
    currentStyle = nil
    let generation = styleGeneration
    if let completion { pendingStyleLoads[generation] = completion }
    map.mapboxMap.load(mapStyle: MapStyle(uri: styleURI)) { [weak self] error in
      guard let self, let settle = self.pendingStyleLoads.removeValue(forKey: generation) else { return }
      if let error, !(error is CancelError) {
        settle(.failure(RuntimeError.error(withMessage: "Style \"\(uri)\" failed to load: \(error.localizedDescription)")))
      } else if error == nil, generation == self.styleGeneration {
        settle(.success(self.styleHandle()))
      } else {
        settle(.failure(RuntimeError.error(withMessage: "Style load superseded by a later load")))
      }
    }
  }

  /// The map's style when `generation` is still the loaded one.
  func liveStyleMap(generation: UInt64) -> MapboxMap? {
    guard generation == styleGeneration, let map = mapView?.mapboxMap, map.isStyleLoaded else { return nil }
    return map
  }

  func track(_ manager: HybridPointAnnotationManager) {
    annotationManagers.append(manager)
  }

  func tearDown() {
    signalTokens.forEach { $0.cancel() }
    signalTokens.removeAll()
    interactionTokens.forEach { $0.cancel() }
    interactionTokens.removeAll()
    annotationManagers.forEach { $0.release() }
    annotationManagers.removeAll()
    styleGeneration += 1
    currentStyle = nil
    let pending = pendingStyleLoads.values
    pendingStyleLoads.removeAll()
    pending.forEach { $0(.failure(RuntimeError.error(withMessage: "MapboxMapView was unmounted"))) }
    mapView?.removeFromSuperview()
    mapView = nil
  }

  private func applyProjection() {
    guard let projection, let map = mapView?.mapboxMap, map.isStyleLoaded else { return }
    do {
      try map.apply(projection: projection)
    } catch {
      loadingFailed.emit(error)
    }
  }

  private func styleHandle() -> HybridMapStyle {
    if let currentStyle { return currentStyle }
    let handle = HybridMapStyle(uri: styleUri, generation: styleGeneration, host: self)
    currentStyle = handle
    return handle
  }

  private func subscribe(_ map: MapView) {
    signalTokens.append(map.mapboxMap.onCameraChanged.observe { [weak self] event in
      guard let self, !self.cameraChanged.isEmpty else { return }
      self.cameraChanged.emit(CameraState(event.cameraState))
    })
    signalTokens.append(map.mapboxMap.onStyleLoaded.observe { [weak self] _ in
      guard let self else { return }
      self.applyProjection()
      self.styleLoaded.emit(self.styleHandle())
    })
    signalTokens.append(map.mapboxMap.onMapLoadingError.observe { [weak self] error in
      self?.loadingFailed.emit(RuntimeError.error(withMessage: error.message))
    })
    interactionTokens.append(map.mapboxMap.addInteraction(TapInteraction { [weak self] context in
      self?.mapTapped.emit(MapTapEvent(
        coordinate: GeographicCoordinate(context.coordinate),
        point: ScreenPoint(x: Double(context.point.x), y: Double(context.point.y))
      ))
      return false
    }))
  }
}
#endif
