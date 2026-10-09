import NitroModules
import UIKit
#if os(iOS)
import MapboxMaps
#endif

#if os(iOS)
/// The `MapboxMapView` Hybrid View. Props arrive on the main thread and are
/// applied in `afterUpdate()`; methods arrive on the JS thread and cross to
/// the main thread once through `MainThreadPromise`.
final class HybridMapboxMapView: HybridMapboxMapViewSpec {
  private let host = MapHost()
  private var appliedStyleUri: String?
  private var cameraChanged = false
  private var gesturesChanged = true

  var view: UIView {
    host.container
  }

  var styleUri: String = ""

  var camera: CameraTarget? {
    didSet { cameraChanged = true }
  }

  var projection: MapProjection? {
    didSet { host.projection = projection }
  }

  var enableGestures: Bool? {
    didSet { gesturesChanged = true }
  }

  func afterUpdate() {
    // An invalid camera prop is reported by applyCameraProp below.
    let initialCamera = try? camera?.cameraOptions("camera")
    guard let map = host.ensureMapForProps(camera: initialCamera) else { return }
    if cameraChanged {
      cameraChanged = false
      applyCameraProp(to: map)
    }
    if gesturesChanged {
      gesturesChanged = false
      applyGestures(to: map)
    }
    if appliedStyleUri != styleUri, !styleUri.isEmpty {
      appliedStyleUri = styleUri
      host.loadStyle(styleUri, on: map, completion: nil)
    }
  }

  func onDropView() {
    host.tearDown()
    appliedStyleUri = nil
    cameraChanged = true
    gesturesChanged = true
    host.cameraChanged.removeAll()
    host.mapTapped.removeAll()
    host.styleLoaded.removeAll()
    host.loadingFailed.removeAll()
  }

  func loadStyle(uri: String) throws -> Promise<any HybridMapStyleSpec> {
    MainThreadPromise.complete { settle in
      let map = try self.host.requireMap("MapboxMapView.loadStyle")
      self.host.loadStyle(uri, on: map, completion: settle)
    }
  }

  func createPointAnnotationManager() throws -> Promise<any HybridPointAnnotationManagerSpec> {
    MainThreadPromise.run {
      let map = try self.host.requireMap("MapboxMapView.createPointAnnotationManager")
      let manager = HybridPointAnnotationManager(orchestrator: map.annotations)
      self.host.track(manager)
      return manager as any HybridPointAnnotationManagerSpec
    }
  }

  func flyTo(target: CameraTarget, options: CameraAnimationOptions?) throws -> Promise<CameraAnimationEnd> {
    MainThreadPromise.complete { settle in
      let map = try self.host.requireMap("MapboxMapView.flyTo")
      try map.fly(to: target, durationMs: options?.durationMs) { settle(.success($0)) }
    }
  }

  func easeTo(target: CameraTarget, options: CameraAnimationOptions?) throws -> Promise<CameraAnimationEnd> {
    MainThreadPromise.complete { settle in
      let map = try self.host.requireMap("MapboxMapView.easeTo")
      try map.ease(to: target, durationMs: options?.durationMs) { settle(.success($0)) }
    }
  }

  func fitBounds(bounds: CoordinateBounds, options: FitBoundsOptions?) throws -> Promise<CameraAnimationEnd> {
    MainThreadPromise.complete { settle in
      let map = try self.host.requireMap("MapboxMapView.fitBounds")
      try map.fit(bounds, options: options) { settle(.success($0)) }
    }
  }

  func getCameraState() throws -> Promise<CameraState> {
    MainThreadPromise.run {
      let map = try self.host.requireMap("MapboxMapView.getCameraState")
      return CameraState(map.mapboxMap.cameraState)
    }
  }

  func addOnCameraChangedListener(listener: @escaping (CameraState) -> Void) throws -> ListenerSubscription {
    host.cameraChanged.add(listener)
  }

  func addOnMapTapListener(listener: @escaping (MapTapEvent) -> Void) throws -> ListenerSubscription {
    host.mapTapped.add(listener)
  }

  func addOnStyleLoadedListener(listener: @escaping (any HybridMapStyleSpec) -> Void) throws -> ListenerSubscription {
    host.styleLoaded.add(listener)
  }

  func addOnMapLoadingErrorListener(listener: @escaping (Error) -> Void) throws -> ListenerSubscription {
    host.loadingFailed.add(listener)
  }

  func queryRenderedFeatures(query: RenderedFeatureQuery) throws -> Promise<[any HybridRenderedFeatureSpec]> {
    MainThreadPromise.complete { settle in
      let map = try self.host.requireMap("MapboxMapView.queryRenderedFeatures")
      try map.queryRenderedFeatures(query) { result in
        settle(result.map { features in features.map { HybridRenderedFeature($0) as any HybridRenderedFeatureSpec } })
      }
    }
  }

  private func applyCameraProp(to map: MapView) {
    guard let camera else { return }
    do {
      map.mapboxMap.setCamera(to: try camera.cameraOptions("camera"))
    } catch {
      host.loadingFailed.emit(error)
    }
  }

  /// SDK: `GestureOptions` fields (`Gestures/GestureOptions.swift:23-68`).
  private func applyGestures(to map: MapView) {
    let enabled = enableGestures ?? true
    var options = map.gestures.options
    options.panEnabled = enabled
    options.pinchEnabled = enabled
    options.rotateEnabled = enabled
    options.pitchEnabled = enabled
    options.doubleTapToZoomInEnabled = enabled
    options.doubleTouchToZoomOutEnabled = enabled
    options.quickZoomEnabled = enabled
    map.gestures.options = options
  }
}
#else
/// The `MapboxMapView` Hybrid View where the Maps SDK is not linked
/// (`MapboxMaps.isMapViewAvailable` is `false`). It renders an empty view;
/// every map method rejects and no listener ever fires.
final class HybridMapboxMapView: HybridMapboxMapViewSpec {
  let view = UIView()
  var styleUri = ""
  var camera: CameraTarget?
  var projection: MapProjection?
  var enableGestures: Bool?

  func loadStyle(uri: String) throws -> Promise<any HybridMapStyleSpec> {
    .rejected(withError: Self.unavailable("loadStyle"))
  }

  func createPointAnnotationManager() throws -> Promise<any HybridPointAnnotationManagerSpec> {
    .rejected(withError: Self.unavailable("createPointAnnotationManager"))
  }

  func flyTo(target: CameraTarget, options: CameraAnimationOptions?) throws -> Promise<CameraAnimationEnd> {
    .rejected(withError: Self.unavailable("flyTo"))
  }

  func easeTo(target: CameraTarget, options: CameraAnimationOptions?) throws -> Promise<CameraAnimationEnd> {
    .rejected(withError: Self.unavailable("easeTo"))
  }

  func fitBounds(bounds: CoordinateBounds, options: FitBoundsOptions?) throws -> Promise<CameraAnimationEnd> {
    .rejected(withError: Self.unavailable("fitBounds"))
  }

  func getCameraState() throws -> Promise<CameraState> {
    .rejected(withError: Self.unavailable("getCameraState"))
  }

  func addOnCameraChangedListener(listener: @escaping (CameraState) -> Void) throws -> ListenerSubscription {
    ListenerSubscription(remove: {})
  }

  func addOnMapTapListener(listener: @escaping (MapTapEvent) -> Void) throws -> ListenerSubscription {
    ListenerSubscription(remove: {})
  }

  func addOnStyleLoadedListener(listener: @escaping (any HybridMapStyleSpec) -> Void) throws -> ListenerSubscription {
    ListenerSubscription(remove: {})
  }

  func addOnMapLoadingErrorListener(listener: @escaping (Error) -> Void) throws -> ListenerSubscription {
    ListenerSubscription(remove: {})
  }

  func queryRenderedFeatures(query: RenderedFeatureQuery) throws -> Promise<[any HybridRenderedFeatureSpec]> {
    .rejected(withError: Self.unavailable("queryRenderedFeatures"))
  }

  private static func unavailable(_ operation: String) -> Error {
    RuntimeError.error(withMessage:
      "Mapbox Maps SDK is unavailable on this platform (MapboxMapView.\(operation)); check MapboxMaps.isMapViewAvailable before mounting the view")
  }
}
#endif
