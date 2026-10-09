package com.margelo.nitro.mapboxar.nativemap

import com.mapbox.maps.MapView
import com.mapbox.maps.QueriedRenderedFeature
import com.mapbox.maps.RenderedQueryGeometry
import com.mapbox.maps.RenderedQueryOptions
import com.mapbox.maps.ScreenBox
import com.mapbox.maps.ScreenCoordinate

/*
 * MapboxMapViewMethods.queryRenderedFeatures.
 *
 * SDK (v11.32.0): MapboxMap.queryRenderedFeatures(RenderedQueryGeometry, RenderedQueryOptions,
 * QueryRenderedFeaturesCallback) (maps-sdk/api/Release/metalava.txt:277);
 * RenderedQueryGeometry(ScreenCoordinate) and RenderedQueryOptions(layerIds, filter)
 * (plugin-annotation/.../AnnotationManagerImpl.kt:969-970); RenderedQueryGeometry.valueOf(ScreenBox)
 * (maps-sdk/.../MapboxMap.kt:3039). Query points arrive in dp and are scaled to pixels.
 */
internal fun MapView.queryRenderedFeatures(
  query: RenderedFeatureQuery,
  onResult: (Result<List<QueriedRenderedFeature>>) -> Unit,
) {
  query.layerIds?.let { layerIds ->
    require(layerIds.isNotEmpty()) { "layerIds must not be empty; omit it to query every layer" }
    layerIds.firstOrNull { !mapboxMap.styleLayerExists(it) }?.let {
      throw IllegalArgumentException("layerIds names \"$it\", which is not a layer in the loaded style")
    }
  }
  val density = resources.displayMetrics.density
  val widthDp = width / density
  val heightDp = height / density
  val geometry = when (val area = query.area) {
    is Variant_ScreenPoint_ScreenBox.First -> {
      val point = area.value
      require(point.x in 0.0..widthDp.toDouble() && point.y in 0.0..heightDp.toDouble()) {
        "Query point (${point.x}, ${point.y}) lies outside the map view"
      }
      RenderedQueryGeometry(ScreenCoordinate(point.x * density, point.y * density))
    }
    is Variant_ScreenPoint_ScreenBox.Second -> {
      val box = area.value
      require(box.min.x <= box.max.x && box.min.y <= box.max.y) {
        "Query box is inverted: min must be at or above-left of max"
      }
      require(box.min.x >= 0 && box.min.y >= 0 && box.max.x <= widthDp && box.max.y <= heightDp) {
        "Query box lies outside the map view"
      }
      RenderedQueryGeometry.valueOf(
        ScreenBox(
          ScreenCoordinate(box.min.x * density, box.min.y * density),
          ScreenCoordinate(box.max.x * density, box.max.y * density),
        ),
      )
    }
  }
  mapboxMap.queryRenderedFeatures(geometry, RenderedQueryOptions(query.layerIds?.toList(), null)) { expected ->
    val features = expected.value
    onResult(
      if (features != null) {
        Result.success(features)
      } else {
        Result.failure(IllegalStateException("queryRenderedFeatures failed: ${expected.error}"))
      },
    )
  }
}
