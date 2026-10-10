package com.margelo.nitro.mapboxar.nativemap

import android.view.View
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.core.Promise
import com.mapbox.maps.MapView
import com.mapbox.maps.plugin.gestures.gestures
import com.mapbox.maps.plugin.locationcomponent.createDefault2DPuck
import com.mapbox.maps.plugin.locationcomponent.location

/**
 * The `MapboxMapView` Hybrid View. Props arrive on the main thread and are
 * applied in [afterUpdate]; methods arrive on the JS thread and cross to the
 * main thread once through [MainThreadPromise].
 */
@Keep
@DoNotStrip
class HybridMapboxMapView(
  private val context: ThemedReactContext,
) : HybridMapboxMapViewSpec(), LifecycleEventListener {
  private val host = MapHost(context)
  private var appliedStyleUri: String? = null
  private var cameraChanged = false
  private var gesturesChanged = true
  private var locationChanged = true
  private var started = false

  init {
    context.addLifecycleEventListener(this)
  }

  override val view: View = host.container

  override var styleUri: String = ""

  override var camera: CameraTarget? = null
    set(value) {
      field = value
      cameraChanged = true
    }

  override var projection: MapProjection? = null
    set(value) {
      field = value
      host.projection = value
    }

  override var enableGestures: Boolean? = null
    set(value) {
      field = value
      gesturesChanged = true
    }

  override var showUserLocation: Boolean? = null
    set(value) {
      field = value
      locationChanged = true
    }

  override var puckBearing: LocationPuckBearing? = null
    set(value) {
      field = value
      locationChanged = true
    }

  override fun afterUpdate() {
    super.afterUpdate()
    // An invalid camera prop is reported by applyCameraProp below.
    val initialCamera = runCatching { camera?.toValidatedCameraOptions("camera", density) }.getOrNull()
    val map = host.ensureMapForProps(initialCamera) ?: return
    if (!started) {
      host.start()
      started = true
    }
    if (cameraChanged) {
      cameraChanged = false
      applyCameraProp(map)
    }
    if (gesturesChanged) {
      gesturesChanged = false
      applyGestures(map)
    }
    if (locationChanged) {
      locationChanged = false
      applyLocationPuck(map)
    }
    if (appliedStyleUri != styleUri && styleUri.isNotEmpty()) {
      appliedStyleUri = styleUri
      host.loadStyle(styleUri, map, null)
    }
  }

  override fun onHostResume() {
    if (!started && host.mapView != null) {
      host.start()
      started = true
    }
  }

  override fun onHostPause() {
    if (started) {
      host.stop()
      started = false
    }
  }

  override fun onHostDestroy() {
    release()
  }

  override fun onDropView() {
    super.onDropView()
    context.removeLifecycleEventListener(this)
    release()
  }

  override fun loadStyle(uri: String): Promise<HybridMapStyleSpec> =
    MainThreadPromise.complete { settle ->
      host.loadStyle(uri, host.requireMap("MapboxMapView.loadStyle"), settle)
    }

  override fun createPointAnnotationManager(): Promise<HybridPointAnnotationManagerSpec> =
    MainThreadPromise.run {
      host.createPointAnnotationManager(host.requireMap("MapboxMapView.createPointAnnotationManager"))
    }

  override fun flyTo(target: CameraTarget, options: CameraAnimationOptions?): Promise<CameraAnimationEnd> =
    MainThreadPromise.complete { settle ->
      host.requireMap("MapboxMapView.flyTo").flyTo(target, options?.durationMs) { settle(Result.success(it)) }
    }

  override fun easeTo(target: CameraTarget, options: CameraAnimationOptions?): Promise<CameraAnimationEnd> =
    MainThreadPromise.complete { settle ->
      host.requireMap("MapboxMapView.easeTo").easeTo(target, options?.durationMs) { settle(Result.success(it)) }
    }

  override fun fitBounds(bounds: CoordinateBounds, options: FitBoundsOptions?): Promise<CameraAnimationEnd> =
    MainThreadPromise.complete { settle ->
      host.requireMap("MapboxMapView.fitBounds").fitBounds(bounds, options) { settle(Result.success(it)) }
    }

  override fun getCameraState(): Promise<CameraState> =
    MainThreadPromise.run {
      host.requireMap("MapboxMapView.getCameraState").mapboxMap.cameraState.toNitroCameraState(density)
    }

  override fun addOnCameraChangedListener(listener: (state: CameraState) -> Unit): ListenerSubscription =
    host.cameraChanged.add(listener)

  override fun addOnMapTapListener(listener: (event: MapTapEvent) -> Unit): ListenerSubscription =
    host.mapTapped.add(listener)

  override fun addOnStyleLoadedListener(listener: (style: HybridMapStyleSpec) -> Unit): ListenerSubscription =
    host.styleLoaded.add(listener)

  override fun addOnMapLoadingErrorListener(listener: (error: Throwable) -> Unit): ListenerSubscription =
    host.loadingFailed.add(listener)

  override fun queryRenderedFeatures(query: RenderedFeatureQuery): Promise<Array<HybridRenderedFeatureSpec>> =
    MainThreadPromise.complete { settle ->
      host.requireMap("MapboxMapView.queryRenderedFeatures").queryRenderedFeatures(query) { result ->
        settle(result.map { features -> features.map<_, HybridRenderedFeatureSpec> { HybridRenderedFeature(it) }.toTypedArray() })
      }
    }

  private val density: Float
    get() = context.resources.displayMetrics.density

  private fun applyCameraProp(map: MapView) {
    val camera = camera ?: return
    try {
      map.mapboxMap.setCamera(camera.toValidatedCameraOptions("camera", density))
    } catch (error: IllegalArgumentException) {
      host.loadingFailed.emit(error)
    }
  }

  /** SDK: `GesturesSettings` fields (sdk-base/api/Release/metalava.txt:2583-2599), `updateSettings`. */
  private fun applyGestures(map: MapView) {
    val enabled = enableGestures ?: true
    map.gestures.updateSettings {
      scrollEnabled = enabled
      pinchToZoomEnabled = enabled
      rotateEnabled = enabled
      pitchEnabled = enabled
      doubleTapToZoomInEnabled = enabled
      doubleTouchToZoomOutEnabled = enabled
      quickZoomEnabled = enabled
    }
  }

  /**
   * SDK: MapView.location (LocationComponentUtils / LocationComponentExt.kt),
   * LocationComponentSettings.Builder enabled / locationPuck / puckBearing /
   * puckBearingEnabled, createDefault2DPuck(Boolean), all read from the 11.32.0
   * AARs with javap. Permission requests are the app's job; see `showUserLocation`.
   */
  private fun applyLocationPuck(map: MapView) {
    val visible = showUserLocation ?: false
    val bearing = (puckBearing ?: LocationPuckBearing.NONE).toPuckBearing()
    map.location.updateSettings {
      enabled = visible
      locationPuck = createDefault2DPuck(bearing != null)
      puckBearingEnabled = bearing != null
      bearing?.let { puckBearing = it }
    }
  }

  private fun release() {
    if (started) {
      started = false
    }
    host.tearDown()
    appliedStyleUri = null
    cameraChanged = true
    gesturesChanged = true
    locationChanged = true
  }
}
