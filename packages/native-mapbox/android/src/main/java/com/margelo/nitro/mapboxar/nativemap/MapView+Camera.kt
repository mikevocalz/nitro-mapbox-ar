package com.margelo.nitro.mapboxar.nativemap

import com.mapbox.maps.CameraOptions
import com.mapbox.maps.MapView
import com.mapbox.maps.plugin.animation.MapAnimationOptions
import com.mapbox.maps.plugin.animation.easeTo
import com.mapbox.maps.plugin.animation.flyTo

/*
 * Camera commands for MapboxMapViewMethods.flyTo / easeTo / fitBounds.
 *
 * SDK (v11.32.0): MapPluginExtensionsDelegate.flyTo / easeTo
 * (plugin-animation/.../CameraAnimationsExt.kt:72,53), MapAnimationOptions.Builder.duration
 * (sdk-base/.../plugin/animation/MapAnimationOptions.kt:63), MapboxMap.setCamera,
 * MapboxMap.cameraForCoordinates(coordinates, camera, coordinatesPadding, maxZoom, offset, result)
 * (maps-sdk/api/Release/metalava.txt:209).
 */

private const val DEFAULT_EASE_DURATION_MS = 300.0

internal fun MapView.flyTo(target: CameraTarget, durationMs: Double?, onEnd: (CameraAnimationEnd) -> Unit) {
  val options = target.toValidatedCameraOptions("target", resources.displayMetrics.density)
  val duration = validatedDurationMs(durationMs)
  if (duration == 0L || options.isEmpty) {
    mapboxMap.setCamera(options)
    onEnd(CameraAnimationEnd.FINISHED)
    return
  }
  val animation = duration?.let { MapAnimationOptions.Builder().duration(it).build() }
  mapboxMap.flyTo(options, animation, CameraAnimationEndListener(onEnd))
}

internal fun MapView.easeTo(target: CameraTarget, durationMs: Double?, onEnd: (CameraAnimationEnd) -> Unit) {
  easeTo(target.toValidatedCameraOptions("target", resources.displayMetrics.density), durationMs, onEnd)
}

internal fun MapView.fitBounds(
  bounds: CoordinateBounds,
  options: FitBoundsOptions?,
  onEnd: (CameraAnimationEnd) -> Unit,
) {
  val southwest = bounds.southwest.toValidatedPoint("bounds.southwest")
  var northeast = bounds.northeast.toValidatedPoint("bounds.northeast")
  require(southwest.latitude() <= northeast.latitude()) {
    "bounds.southwest.latitude (${southwest.latitude()}) must not exceed bounds.northeast.latitude (${northeast.latitude()})"
  }
  if (southwest.longitude() > northeast.longitude()) {
    // Crosses the antimeridian: unwrap so the rectangle spans east.
    northeast = com.mapbox.geojson.Point.fromLngLat(northeast.longitude() + 360, northeast.latitude())
  }
  listOf("bearingDeg" to options?.bearingDeg, "pitchDeg" to options?.pitchDeg, "maxZoom" to options?.maxZoom)
    .forEach { (name, value) -> require(value == null || value.isFinite()) { "options.$name must be finite, got $value" } }
  val density = resources.displayMetrics.density
  val padding = options?.padding?.toValidatedMapboxInsets("options.padding", density)
  val durationMs = options?.durationMs
  validatedDurationMs(durationMs)
  mapboxMap.cameraForCoordinates(
    listOf(southwest, northeast),
    CameraOptions.Builder().bearing(options?.bearingDeg ?: 0.0).pitch(options?.pitchDeg ?: 0.0).build(),
    padding,
    options?.maxZoom,
    null,
  ) { camera -> easeTo(camera, durationMs, onEnd) }
}

private fun MapView.easeTo(options: CameraOptions, durationMs: Double?, onEnd: (CameraAnimationEnd) -> Unit) {
  val duration = validatedDurationMs(durationMs) ?: DEFAULT_EASE_DURATION_MS.toLong()
  if (duration == 0L || options.isEmpty) {
    mapboxMap.setCamera(options)
    onEnd(CameraAnimationEnd.FINISHED)
    return
  }
  mapboxMap.easeTo(
    options,
    MapAnimationOptions.Builder().duration(duration).build(),
    CameraAnimationEndListener(onEnd),
  )
}

private fun validatedDurationMs(durationMs: Double?): Long? {
  if (durationMs == null) return null
  require(durationMs.isFinite() && durationMs >= 0) { "options.durationMs must be finite and >= 0, got $durationMs" }
  return durationMs.toLong()
}
