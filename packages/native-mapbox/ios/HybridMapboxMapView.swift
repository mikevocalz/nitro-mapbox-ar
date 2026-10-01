import CoreLocation
import MapboxMaps
import NitroModules
import UIKit

final class HybridMapboxMapView: HybridMapboxMapViewSpec {
  private let container = UIView()
  private var mapView: MapView?
  private var cameraUpdateScheduled = false

  var view: UIView {
    container
  }

  var accessToken: String = "" {
    didSet {
      guard !accessToken.isEmpty else { return }
      MapboxOptions.accessToken = accessToken
      ensureMapView()
    }
  }

  var styleURI: String = "standard" {
    didSet {
      applyStyle()
    }
  }

  var camera: MapCamera = MapCamera(
    latitude: 0,
    longitude: 0,
    zoom: 0,
    bearing: 0,
    pitch: 0
  ) {
    didSet {
      scheduleCameraUpdate()
    }
  }

  func setCamera(camera: MapCamera) throws {
    self.camera = camera
  }

  func getCamera() throws -> MapCamera {
    guard let mapView else {
      return camera
    }

    let state = mapView.mapboxMap.cameraState
    return MapCamera(
      latitude: state.center.latitude,
      longitude: state.center.longitude,
      zoom: state.zoom,
      bearing: state.bearing,
      pitch: state.pitch
    )
  }

  func loadStyle(styleURI: String) throws {
    self.styleURI = styleURI
  }

  func onDropView() {
    cameraUpdateScheduled = false
    mapView?.removeFromSuperview()
    mapView = nil
  }

  private func ensureMapView() {
    guard mapView == nil, !accessToken.isEmpty else { return }

    MapboxOptions.accessToken = accessToken

    let map = MapView(
      frame: container.bounds,
      mapInitOptions: MapInitOptions(
        cameraOptions: makeCameraOptions(camera),
        styleURI: resolvedStyleURI(styleURI)
      )
    )
    map.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    container.addSubview(map)
    mapView = map
  }

  private func scheduleCameraUpdate() {
    guard !cameraUpdateScheduled else { return }
    cameraUpdateScheduled = true

    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.cameraUpdateScheduled = false
      self.applyCamera()
    }
  }

  private func applyCamera() {
    ensureMapView()
    mapView?.mapboxMap.setCamera(to: makeCameraOptions(camera))
  }

  private func applyStyle() {
    ensureMapView()
    guard let mapView else { return }

    mapView.mapboxMap.mapStyle = MapStyle(uri: resolvedStyleURI(styleURI))
  }

  private func makeCameraOptions(_ value: MapCamera) -> CameraOptions {
    CameraOptions(
      center: CLLocationCoordinate2D(
        latitude: value.latitude,
        longitude: value.longitude
      ),
      zoom: value.zoom,
      bearing: value.bearing,
      pitch: value.pitch
    )
  }

  private func resolvedStyleURI(_ value: String) -> StyleURI {
    switch value {
    case "standard":
      return .standard
    case "standard-satellite":
      return .standardSatellite
    default:
      return StyleURI(rawValue: value) ?? .standard
    }
  }
}
