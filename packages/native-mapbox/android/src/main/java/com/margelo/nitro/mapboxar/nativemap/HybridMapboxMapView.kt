package com.margelo.nitro.mapboxar.nativemap

import android.view.View
import android.widget.FrameLayout
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.uimanager.ThemedReactContext
import com.mapbox.geojson.Point
import com.mapbox.maps.CameraOptions
import com.mapbox.maps.MapView
import com.mapbox.maps.MapboxOptions
import com.mapbox.maps.Style

@Keep
@DoNotStrip
class HybridMapboxMapView(
  private val context: ThemedReactContext,
) : HybridMapboxMapViewSpec(), LifecycleEventListener {
  private val container = FrameLayout(context)
  private var mapView: MapView? = null
  private var cameraUpdateScheduled = false
  private var started = false

  init {
    context.addLifecycleEventListener(this)
  }

  override val view: View = container

  override var accessToken: String = ""
    set(value) {
      field = value
      if (value.isNotBlank()) {
        MapboxOptions.accessToken = value
        ensureMapView()
      }
    }

  override var styleURI: String = "standard"
    set(value) {
      field = value
      applyStyle()
    }

  override var camera: MapCamera = MapCamera(
    latitude = 0.0,
    longitude = 0.0,
    zoom = 0.0,
    bearing = 0.0,
    pitch = 0.0,
  )
    set(value) {
      field = value
      scheduleCameraUpdate()
    }

  override fun setCamera(camera: MapCamera) {
    this.camera = camera
  }

  override fun getCamera(): MapCamera {
    val state = mapView?.mapboxMap?.cameraState ?: return camera
    return MapCamera(
      latitude = state.center.latitude(),
      longitude = state.center.longitude(),
      zoom = state.zoom,
      bearing = state.bearing,
      pitch = state.pitch,
    )
  }

  override fun loadStyle(styleURI: String) {
    this.styleURI = styleURI
  }

  override fun onHostResume() {
    if (!started) {
      mapView?.onStart()
      started = true
    }
  }

  override fun onHostPause() {
    if (started) {
      mapView?.onStop()
      started = false
    }
  }

  override fun onHostDestroy() {
    releaseMapView()
  }

  override fun onDropView() {
    context.removeLifecycleEventListener(this)
    releaseMapView()
  }

  private fun ensureMapView() {
    if (mapView != null || accessToken.isBlank()) return

    MapboxOptions.accessToken = accessToken

    val map = MapView(context)
    map.layoutParams = FrameLayout.LayoutParams(
      FrameLayout.LayoutParams.MATCH_PARENT,
      FrameLayout.LayoutParams.MATCH_PARENT,
    )
    container.addView(map)
    mapView = map

    map.mapboxMap.setCamera(camera.toCameraOptions())
    map.mapboxMap.loadStyle(resolvedStyleURI(styleURI))
  }

  private fun scheduleCameraUpdate() {
    if (cameraUpdateScheduled) return
    cameraUpdateScheduled = true

    container.post {
      cameraUpdateScheduled = false
      applyCamera()
    }
  }

  private fun applyCamera() {
    ensureMapView()
    mapView?.mapboxMap?.setCamera(camera.toCameraOptions())
  }

  private fun applyStyle() {
    ensureMapView()
    mapView?.mapboxMap?.loadStyle(resolvedStyleURI(styleURI))
  }

  private fun releaseMapView() {
    cameraUpdateScheduled = false

    if (started) {
      mapView?.onStop()
      started = false
    }

    mapView?.onDestroy()
    container.removeAllViews()
    mapView = null
  }

  private fun MapCamera.toCameraOptions(): CameraOptions =
    CameraOptions.Builder()
      .center(Point.fromLngLat(longitude, latitude))
      .zoom(zoom)
      .bearing(bearing)
      .pitch(pitch)
      .build()

  private fun resolvedStyleURI(value: String): String =
    when (value) {
      "standard" -> Style.STANDARD
      "standard-satellite" -> Style.STANDARD_SATELLITE
      else -> value
    }
}
