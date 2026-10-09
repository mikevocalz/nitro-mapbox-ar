package com.margelo.nitro.mapboxar.nativemap

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.mapbox.maps.MapboxMap
import java.lang.ref.WeakReference

/**
 * Handle to one loaded style. Every method rejects once another style load
 * starts on the same map, or once the map unmounts.
 */
@Keep
@DoNotStrip
internal class HybridMapStyle(
  override val uri: String,
  private val generation: Long,
  host: MapHost,
) : HybridMapStyleSpec() {
  private val host = WeakReference(host)

  override fun addGeoJsonSource(source: GeoJsonSource): Promise<Unit> =
    mutate("addGeoJsonSource") { it.addGeoJsonSource(source) }

  override fun setGeoJsonSourceData(sourceId: String, data: String): Promise<Unit> =
    mutate("setGeoJsonSourceData") { it.setGeoJsonSourceData(sourceId, data) }

  override fun addRasterDemSource(source: RasterDemSource): Promise<Unit> =
    mutate("addRasterDemSource") { it.addRasterDemSource(source) }

  override fun addVectorSource(source: VectorSource): Promise<Unit> =
    mutate("addVectorSource") { it.addVectorSource(source) }

  override fun removeSource(sourceId: String): Promise<Unit> =
    mutate("removeSource") { it.removeSourceChecked(sourceId) }

  override fun addLayer(layer: StyleLayer, belowLayerId: String?): Promise<Unit> =
    mutate("addLayer") { it.addStyleLayer(layer, belowLayerId) }

  override fun removeLayer(layerId: String): Promise<Unit> =
    mutate("removeLayer") { it.removeLayerChecked(layerId) }

  override fun setTerrain(terrain: TerrainOptions): Promise<Unit> =
    mutate("setTerrain") { it.setTerrain(terrain) }

  override fun clearTerrain(): Promise<Unit> =
    mutate("clearTerrain") { it.clearTerrain() }

  override fun setStandardConfig(config: StandardStyleConfig): Promise<Unit> =
    mutate("setStandardConfig") { it.setStandardConfig(config) }

  private fun mutate(operation: String, body: (MapboxMap) -> Unit): Promise<Unit> =
    MainThreadPromise.run {
      val map = host.get()?.liveStyleMap(generation)
        ?: throw IllegalStateException("This MapStyle was replaced (MapStyle.$operation); use the handle from the latest style load")
      body(map)
    }
}
