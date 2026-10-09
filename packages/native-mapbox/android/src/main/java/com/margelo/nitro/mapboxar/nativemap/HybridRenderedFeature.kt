package com.margelo.nitro.mapboxar.nativemap

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.mapbox.geojson.Feature
import com.mapbox.maps.QueriedRenderedFeature

/**
 * A rendered feature from `queryRenderedFeatures`. Geometry stays in the SDK
 * value until [toGeoJson] serialises it.
 *
 * SDK: QueriedRenderedFeature.queriedFeature (maps-sdk/.../MapboxMap.kt:3057-3060),
 * QueriedFeature.source / sourceLayer and QueriedRenderedFeature.layers (same bindgen
 * class as iOS MBMQueriedFeature.h:24,30 and MBMQueriedRenderedFeature.h:31; the Android
 * accessors were not read from source), com.mapbox.geojson.Feature.id() / toJson().
 */
@Keep
@DoNotStrip
internal class HybridRenderedFeature(queried: QueriedRenderedFeature) : HybridRenderedFeatureSpec() {
  private val feature: Feature = queried.queriedFeature.feature
  override val featureId: String? = feature.id()
  override val sourceId: String = queried.queriedFeature.source
  override val sourceLayer: String? = queried.queriedFeature.sourceLayer
  override val layerIds: Array<String> = queried.layers.toTypedArray()

  override fun toGeoJson(): String = feature.toJson()
}
