package com.margelo.nitro.mapboxar.nativemap

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import java.util.UUID
import com.mapbox.maps.plugin.annotation.AnnotationConfig
import com.mapbox.maps.plugin.annotation.AnnotationPlugin
import com.mapbox.maps.plugin.annotation.generated.OnPointAnnotationClickListener
import com.mapbox.maps.plugin.annotation.generated.PointAnnotationManager
import com.mapbox.maps.plugin.annotation.generated.createPointAnnotationManager

/**
 * A marker group backed by the SDK's [PointAnnotationManager].
 *
 * The SDK draws it with a persistent layer, so it survives style reloads
 * (plugin-annotation/.../AnnotationManagerImpl.kt:195-231; persistence contract in
 * sdk-base/.../MapboxStyleManager.kt:437-441). Released by [removeFromMap] or when its
 * map view unmounts.
 *
 * SDK: AnnotationPlugin.createPointAnnotationManager (generated/PointAnnotationManager.kt:2975),
 * AnnotationConfig(belowLayerId, layerId, sourceId) (sdk-base/.../annotation/AnnotationConfig.kt:6),
 * AnnotationManager.create(List) / deleteAll / addClickListener
 * (AnnotationManagerImpl.kt:578,633; sdk-base/.../AnnotationManager.kt:122),
 * AnnotationPlugin.removeAnnotationManager (sdk-base/.../AnnotationPlugin.kt:28).
 */
@Keep
@DoNotStrip
internal class HybridPointAnnotationManager(plugin: AnnotationPlugin) : HybridPointAnnotationManagerSpec() {
  override val id: String = "nitro-point-${UUID.randomUUID()}"
  private var plugin: AnnotationPlugin? = plugin
  private var manager: PointAnnotationManager? =
    plugin.createPointAnnotationManager(AnnotationConfig(layerId = id, sourceId = id))
  private val taps = ListenerRegistry<String>()

  /** SDK annotation id (a generated UUID) to the caller's id. */
  private var idsBySdkId: Map<String, String> = emptyMap()

  init {
    manager?.addClickListener(
      OnPointAnnotationClickListener { annotation ->
        idsBySdkId[annotation.id]?.let { taps.emit(it) }
        true
      },
    )
  }

  override fun setAnnotations(annotations: Array<PointAnnotation>): Promise<Unit> =
    MainThreadPromise.run {
      val manager = manager ?: throw IllegalStateException("PointAnnotationManager \"$id\" was removed from the map")
      val seen = HashSet<String>()
      annotations.forEach { require(seen.add(it.id)) { "Duplicate annotation id \"${it.id}\"" } }
      val options = annotations.map { it.toPointAnnotationOptions() }
      manager.deleteAll()
      val created = manager.create(options)
      idsBySdkId = created.zip(annotations).associate { (sdk, nitro) -> sdk.id to nitro.id }
    }

  override fun addOnAnnotationTapListener(listener: (annotationId: String) -> Unit): ListenerSubscription =
    taps.add(listener)

  override fun removeFromMap(): Promise<Unit> = MainThreadPromise.run { release() }

  /** Removes the SDK manager. Idempotent; main thread only. */
  fun release() {
    val manager = manager ?: return
    this.manager = null
    plugin?.removeAnnotationManager(manager)
    plugin = null
    taps.removeAll()
  }
}
