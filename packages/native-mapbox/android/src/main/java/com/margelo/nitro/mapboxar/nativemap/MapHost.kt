package com.margelo.nitro.mapboxar.nativemap

import android.content.Context
import android.widget.FrameLayout
import com.margelo.nitro.mapboxar.MapboxARAccessToken
import com.mapbox.common.Cancelable
import com.mapbox.common.MapboxOptions
import com.mapbox.maps.CameraOptions
import com.mapbox.maps.MapInitOptions
import com.mapbox.maps.MapLoadingErrorType
import com.mapbox.maps.MapView
import com.mapbox.maps.MapboxMap
import com.mapbox.maps.plugin.annotation.annotations
import com.mapbox.maps.plugin.gestures.OnMapClickListener
import com.mapbox.maps.plugin.gestures.addOnMapClickListener
import com.mapbox.maps.plugin.gestures.removeOnMapClickListener

/**
 * Owns the SDK [MapView] behind one `MapboxMapView`, its event subscriptions
 * and the style generation that `MapStyle` handles check. Main thread only,
 * except the registries, which JS reaches directly.
 *
 * SDK (v11.32.0): MapView(Context, MapInitOptions) and MapInitOptions(context, ..., cameraOptions,
 * ..., styleUri) (maps-sdk/.../MapInitOptions.kt:28-36), MapboxMap.loadStyle(String, OnStyleLoaded)
 * (metalava.txt:259), subscribeCameraChanged / subscribeStyleLoaded / subscribeMapLoadingError
 * (metalava.txt:352,367,357), CameraChanged.cameraState (maps-sdk/.../MapController.kt:128),
 * MapLoadingErrorType.STYLE, addOnMapClickListener / removeOnMapClickListener
 * (plugin-gestures/.../GesturesExt.kt:27,36), com.mapbox.common.MapboxOptions.accessToken
 * (maps-sdk/.../MapController.kt:8,103).
 */
internal class MapHost(private val context: Context) {
  val container = FrameLayout(context)
  val cameraChanged = ListenerRegistry<CameraState>()
  val mapTapped = ListenerRegistry<MapTapEvent>()
  val styleLoaded = ListenerRegistry<HybridMapStyleSpec>()
  val loadingFailed = ListenerRegistry<Throwable>()

  var mapView: MapView? = null
    private set

  /** The `projection` prop; applied now and after every style load. */
  var projection: MapProjection? = null
    set(value) {
      field = value
      applyProjection()
    }

  private val density = context.resources.displayMetrics.density
  private var styleGeneration = 0L
  private var styleUri = ""
  private var currentStyle: HybridMapStyle? = null
  private val pendingStyleLoads = HashMap<Long, (Result<HybridMapStyleSpec>) -> Unit>()
  private val subscriptions = ArrayList<Cancelable>()
  private val annotationManagers = ArrayList<HybridPointAnnotationManager>()
  private var mapClickListener: OnMapClickListener? = null
  private var reportedMissingToken = false

  /**
   * Returns the map, creating it on first use once a token is set.
   *
   * @throws IllegalStateException `Mapbox access token is not set (<operation>)` while
   * `MapboxAR.accessToken` is empty.
   */
  fun requireMap(operation: String, camera: CameraOptions? = null): MapView {
    mapView?.let { return it }
    val token = MapboxARAccessToken.current
    check(token.isNotEmpty()) { "Mapbox access token is not set ($operation); assign MapboxAR.accessToken first" }
    MapboxOptions.accessToken = token
    val map = MapView(context, MapInitOptions(context, cameraOptions = camera, styleUri = null))
    map.layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
    container.addView(map)
    mapView = map
    subscribe(map)
    return map
  }

  /** Creates the map for a prop update; a missing token is reported once to the error listeners. */
  fun ensureMapForProps(camera: CameraOptions?): MapView? =
    try {
      requireMap("MapboxMapView", camera).also { reportedMissingToken = false }
    } catch (error: IllegalStateException) {
      if (!reportedMissingToken) {
        reportedMissingToken = true
        loadingFailed.emit(error)
      }
      null
    }

  /**
   * Starts loading [uri]. The previous `MapStyle` handle goes stale now. [completion] gets
   * the new handle, `Style load superseded` when another load starts first, or the style
   * loading error.
   */
  fun loadStyle(uri: String, map: MapView, completion: ((Result<HybridMapStyleSpec>) -> Unit)?) {
    if (!(uri.startsWith("mapbox://") || uri.startsWith("https://") || uri.startsWith("http://") || uri.startsWith("asset://") || uri.startsWith("file://"))) {
      val error = IllegalArgumentException("Malformed style URI \"$uri\"; pass a mapbox://styles/... or https:// URI")
      if (completion != null) completion(Result.failure(error)) else loadingFailed.emit(error)
      return
    }
    val superseded = pendingStyleLoads.values.toList()
    pendingStyleLoads.clear()
    superseded.forEach { it(Result.failure(IllegalStateException("Style load superseded by a later load"))) }
    styleGeneration += 1
    styleUri = uri
    currentStyle = null
    val generation = styleGeneration
    if (completion != null) pendingStyleLoads[generation] = completion
    map.mapboxMap.loadStyle(uri) {
      if (generation == styleGeneration) {
        pendingStyleLoads.remove(generation)?.invoke(Result.success(styleHandle()))
      }
    }
  }

  /** The map's style when [generation] is still the loaded one. */
  fun liveStyleMap(generation: Long): MapboxMap? {
    val map = mapView?.mapboxMap ?: return null
    return if (generation == styleGeneration && map.isStyleLoaded()) map else null
  }

  fun createPointAnnotationManager(map: MapView): HybridPointAnnotationManager =
    HybridPointAnnotationManager(map.annotations).also { annotationManagers.add(it) }

  fun start() {
    mapView?.onStart()
  }

  fun stop() {
    mapView?.onStop()
  }

  fun tearDown() {
    subscriptions.forEach { it.cancel() }
    subscriptions.clear()
    mapClickListener?.let { mapView?.mapboxMap?.removeOnMapClickListener(it) }
    mapClickListener = null
    annotationManagers.forEach { it.release() }
    annotationManagers.clear()
    styleGeneration += 1
    currentStyle = null
    val pending = pendingStyleLoads.values.toList()
    pendingStyleLoads.clear()
    pending.forEach { it(Result.failure(IllegalStateException("MapboxMapView was unmounted"))) }
    mapView?.onStop()
    mapView?.onDestroy()
    container.removeAllViews()
    mapView = null
  }

  private fun styleHandle(): HybridMapStyle =
    currentStyle ?: HybridMapStyle(styleUri, styleGeneration, this).also { currentStyle = it }

  private fun applyProjection() {
    val projection = projection ?: return
    val map = mapView?.mapboxMap ?: return
    if (!map.isStyleLoaded()) return
    try {
      map.apply(projection)
    } catch (error: IllegalStateException) {
      loadingFailed.emit(error)
    }
  }

  private fun subscribe(map: MapView) {
    val mapboxMap = map.mapboxMap
    subscriptions.add(
      mapboxMap.subscribeCameraChanged { event ->
        if (!cameraChanged.isEmpty) cameraChanged.emit(event.cameraState.toNitroCameraState(density))
      },
    )
    subscriptions.add(
      mapboxMap.subscribeStyleLoaded {
        applyProjection()
        styleLoaded.emit(styleHandle())
      },
    )
    subscriptions.add(
      mapboxMap.subscribeMapLoadingError { error ->
        if (error.type == MapLoadingErrorType.STYLE) {
          val failure = IllegalStateException("Style \"$styleUri\" failed to load: ${error.message}")
          pendingStyleLoads.remove(styleGeneration)?.invoke(Result.failure(failure))
        }
        loadingFailed.emit(IllegalStateException(error.message))
      },
    )
    val listener = OnMapClickListener { point ->
      val screen = mapboxMap.pixelForCoordinate(point)
      mapTapped.emit(
        MapTapEvent(
          coordinate = point.toGeographicCoordinate(),
          point = ScreenPoint(x = screen.x / density, y = screen.y / density),
        ),
      )
      false
    }
    mapboxMap.addOnMapClickListener(listener)
    mapClickListener = listener
  }
}
