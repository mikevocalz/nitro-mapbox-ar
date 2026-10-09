package com.margelo.nitro.mapboxar.nativemap

/**
 * Converts to SDK insets after checking every side is finite and not
 * negative. Values are dp; the SDK takes pixels, so they are scaled by
 * [density].
 */
internal fun EdgeInsets.toValidatedMapboxInsets(field: String, density: Float): com.mapbox.maps.EdgeInsets {
  listOf(top, left, bottom, right).forEach {
    require(it.isFinite() && it >= 0) { "$field sides must be finite and >= 0, got $it" }
  }
  return com.mapbox.maps.EdgeInsets(top * density, left * density, bottom * density, right * density)
}
