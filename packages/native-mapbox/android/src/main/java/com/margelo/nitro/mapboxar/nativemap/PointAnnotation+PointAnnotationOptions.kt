package com.margelo.nitro.mapboxar.nativemap

import com.mapbox.maps.plugin.annotation.generated.PointAnnotationOptions

/**
 * Builds the SDK options for this marker.
 *
 * SDK: PointAnnotationOptions.withPoint / withIconImage(String) / withTextField
 * (plugin-annotation/.../generated/PointAnnotationOptions.kt:787,76,220).
 */
internal fun PointAnnotation.toPointAnnotationOptions(): PointAnnotationOptions {
  val options = PointAnnotationOptions().withPoint(coordinate.toValidatedPoint("annotation \"$id\" coordinate"))
  iconImageId?.let { options.withIconImage(it) }
  text?.let { options.withTextField(it) }
  return options
}
