package com.margelo.nitro.mapboxar.nativemap

import android.graphics.Bitmap
import com.mapbox.maps.GeoJSONSourceData
import com.mapbox.maps.LayerPosition
import com.mapbox.maps.MapboxDelicateApi
import com.mapbox.maps.MapboxMap
import com.mapbox.maps.toMapboxImage
import com.mapbox.maps.extension.style.terrain.generated.removeTerrain
import com.mapbox.bindgen.Value
import org.json.JSONObject
import org.json.JSONException

/*
 * Style mutations behind MapStyle. Each checks its preconditions first so the
 * rejection names the id at fault; the SDK's own error string passes through
 * for anything else (for example an invalid paint property).
 *
 * SDK (v11.32.0, sdk-base/api/Release/metalava.txt): MapboxStyleManager.addStyleSource :171,
 * addStyleLayer :169, removeStyleLayer :211, removeStyleSource :213, styleSourceExists :251,
 * styleLayerExists :250, setStyleTerrain :247, setStyleGeoJSONSourceData :228,
 * setStyleImportConfigProperties :230, getStyleImports :182, setStyleProjection :238,
 * getStyleLayerProperty :185, getStyleLayers :186, getStyleSources :196.
 * addStyleImage(String, Float, Image, Boolean, List, List, ImageContent?), removeStyleImage,
 * hasStyleImage and Bitmap.toMapboxImage (ExtensionUtils.kt), read from the 11.32.0 AARs with javap.
 * MapboxStyleManager.removeTerrain (extension-style/.../terrain/generated/TerrainExt.kt:31),
 * GeoJSONSourceData.valueOf(String) (extension-style/.../sources/generated/GeoJsonSource.kt:112),
 * LayerPosition(above, below, at) (plugin-annotation/.../AnnotationManagerImpl.kt:197).
 */

internal fun MapboxMap.addGeoJsonSource(source: GeoJsonSource) {
  requireNewSource(source.id)
  requireGeoJson(source.data, "source \"${source.id}\" data")
  addStyleSource(source.id, mapOf("type" to "geojson", "data" to JSONObject(source.data)).toStyleValue("addGeoJsonSource"))
    .orThrow("addGeoJsonSource")
}

internal fun MapboxMap.setGeoJsonSourceData(sourceId: String, data: String) {
  require(sourceType(sourceId) == "geojson") { "No GeoJSON source has id \"$sourceId\"" }
  requireGeoJson(data, "data for source \"$sourceId\"")
  setStyleGeoJSONSourceData(sourceId, "", GeoJSONSourceData.valueOf(data)).orThrow("setGeoJsonSourceData")
}

internal fun MapboxMap.addRasterDemSource(source: RasterDemSource) {
  requireNewSource(source.id)
  val properties = mutableMapOf<String, Any?>("type" to "raster-dem", "url" to source.url)
  source.tileSizePx?.let {
    require(it.isFinite() && it > 0) { "tileSizePx must be a positive number, got $it" }
    properties["tileSize"] = it
  }
  addStyleSource(source.id, properties.toStyleValue("addRasterDemSource")).orThrow("addRasterDemSource")
}

internal fun MapboxMap.addVectorSource(source: VectorSource) {
  requireNewSource(source.id)
  addStyleSource(source.id, mapOf("type" to "vector", "url" to source.url).toStyleValue("addVectorSource"))
    .orThrow("addVectorSource")
}

internal fun MapboxMap.removeSourceChecked(sourceId: String) {
  require(styleSourceExists(sourceId)) { "No source has id \"$sourceId\"" }
  styleLayers.firstOrNull { getStyleLayerProperty(it.id, "source").value.contents == sourceId }?.let {
    throw IllegalArgumentException("Source \"$sourceId\" is still used by layer \"${it.id}\"; remove the layer first")
  }
  removeStyleSource(sourceId).orThrow("removeSource")
}

internal fun MapboxMap.addStyleLayer(layer: StyleLayer, belowLayerId: String?) {
  require(!styleLayerExists(layer.id)) { "A layer with id \"${layer.id}\" already exists" }
  layer.sourceId?.let {
    require(styleSourceExists(it)) { "Layer \"${layer.id}\" names source \"$it\", which does not exist" }
  }
  belowLayerId?.let { require(styleLayerExists(it)) { "belowLayerId \"$it\" names no layer" } }
  val properties = mutableMapOf<String, Any?>("id" to layer.id, "type" to layer.type.styleSpecName)
  layer.sourceId?.let { properties["source"] = it }
  layer.sourceLayer?.let { properties["source-layer"] = it }
  layer.paint?.let { properties["paint"] = it.toHashMap() }
  layer.layout?.let { properties["layout"] = it.toHashMap() }
  addStyleLayer(properties.toStyleValue("addLayer"), belowLayerId?.let { LayerPosition(null, it, null) })
    .orThrow("addLayer")
}

internal fun MapboxMap.removeLayerChecked(layerId: String) {
  require(styleLayerExists(layerId)) { "No layer has id \"$layerId\"" }
  removeStyleLayer(layerId).orThrow("removeLayer")
}

// toMapboxImage is delicate because it copies pixels and needs ARGB_8888;
// decodeBitmap decodes to that config.
@OptIn(MapboxDelicateApi::class)
internal fun MapboxMap.addBitmapImage(imageId: String, bitmap: Bitmap, scale: Float, sdf: Boolean) {
  addStyleImage(imageId, scale, bitmap.toMapboxImage(), sdf, emptyList(), emptyList(), null).orThrow("addStyleImage")
}

internal fun MapboxMap.removeStyleImageChecked(imageId: String) {
  require(hasStyleImage(imageId)) { "No image has id \"$imageId\"" }
  removeStyleImage(imageId).orThrow("removeStyleImage")
}

internal fun MapboxMap.setTerrain(options: TerrainOptions) {
  require(sourceType(options.sourceId) == "raster-dem") {
    "No raster DEM source has id \"${options.sourceId}\"; add one with MapStyle.addRasterDemSource"
  }
  val properties = mutableMapOf<String, Any?>("source" to options.sourceId)
  options.exaggeration?.let {
    require(it.isFinite() && it in 0.0..1000.0) { "exaggeration must be between 0 and 1000, got $it" }
    properties["exaggeration"] = it
  }
  setStyleTerrain(properties.toStyleValue("setTerrain")).orThrow("setTerrain")
}

internal fun MapboxMap.clearTerrain() {
  removeTerrain()
}

internal fun MapboxMap.setStandardConfig(config: StandardStyleConfig) {
  val importId = config.importId ?: "basemap"
  require(getStyleImports().any { it.id == importId }) {
    "The loaded style has no import \"$importId\"; load MapStyles.standard to use Standard configuration"
  }
  val properties = mutableMapOf<String, Any?>()
  config.lightPreset?.let { properties["lightPreset"] = it.name.lowercase() }
  config.theme?.let { properties["theme"] = it.name.lowercase() }
  config.show3dObjects?.let { properties["show3dObjects"] = it }
  config.showPointOfInterestLabels?.let { properties["showPointOfInterestLabels"] = it }
  // An object Value holds HashMap<String, Value> (sdk-base/.../interactions/FeatureState.kt:26).
  @Suppress("UNCHECKED_CAST")
  val configs = properties.toStyleValue("setStandardConfig").contents as HashMap<String, Value>
  setStyleImportConfigProperties(importId, configs).orThrow("setStandardConfig")
}

internal fun MapboxMap.apply(projection: MapProjection) {
  val name = if (projection == MapProjection.GLOBE) "globe" else "mercator"
  setStyleProjection(mapOf("name" to name).toStyleValue("projection")).orThrow("projection")
}

private fun MapboxMap.requireNewSource(sourceId: String) {
  require(!styleSourceExists(sourceId)) { "A source with id \"$sourceId\" already exists" }
}

private fun MapboxMap.sourceType(sourceId: String): String? =
  styleSources.firstOrNull { it.id == sourceId }?.type

private fun requireGeoJson(text: String, field: String) {
  try {
    val type = JSONObject(text).getString("type")
    require(type in GEOJSON_TYPES) { "$field is not valid GeoJSON: unknown type \"$type\"" }
  } catch (error: JSONException) {
    throw IllegalArgumentException("$field is not valid GeoJSON: ${error.message}")
  }
}

private val GEOJSON_TYPES = setOf(
  "Feature", "FeatureCollection", "Point", "MultiPoint", "LineString",
  "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection",
)
