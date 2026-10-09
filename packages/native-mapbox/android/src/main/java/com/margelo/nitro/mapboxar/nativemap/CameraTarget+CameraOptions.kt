package com.margelo.nitro.mapboxar.nativemap

import com.mapbox.maps.CameraOptions

/**
 * Converts the request into SDK camera options, rejecting non-finite numbers
 * and coordinates outside WGS84. Omitted fields stay unset, so the SDK keeps
 * their current value.
 */
internal fun CameraTarget.toValidatedCameraOptions(field: String, density: Float): CameraOptions {
  listOf("zoom" to zoom, "bearingDeg" to bearingDeg, "pitchDeg" to pitchDeg).forEach { (name, value) ->
    require(value == null || value.isFinite()) { "$field.$name must be finite, got $value" }
  }
  return CameraOptions.Builder()
    .center(center?.toValidatedPoint("$field.center"))
    .padding(padding?.toValidatedMapboxInsets("$field.padding", density))
    .zoom(zoom)
    .bearing(bearingDeg)
    .pitch(pitchDeg)
    .build()
}
