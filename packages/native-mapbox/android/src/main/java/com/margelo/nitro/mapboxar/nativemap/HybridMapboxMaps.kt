package com.margelo.nitro.mapboxar.nativemap

import android.content.pm.PackageManager
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules

/** The `MapboxMaps` root. */
@Keep
@DoNotStrip
class HybridMapboxMaps : HybridMapboxMapsSpec() {
  /** The library only loads where the Maps SDK AAR links. */
  override val isMapViewAvailable: Boolean = true

  /** SDK: `com.mapbox.maps.base.BuildConfig.MAPBOX_SDK_VERSION` (sdk-base/build.gradle.kts:27). */
  override val sdkVersion: String = com.mapbox.maps.base.BuildConfig.MAPBOX_SDK_VERSION

  /**
   * Globe: `ProjectionName.GLOBE` falls back to Mercator on GPUs without vertex texture
   * units (extension-style/.../projection/generated/Projection.kt:26-28); that GL limit is
   * not queryable before a map renders, so this reports the SDK's support.
   * Location puck: `PackageManager.FEATURE_LOCATION`.
   */
  override val capabilities: MapCapabilities = MapCapabilities(
    supportsGlobeProjection = true,
    supportsTerrain = true,
    supportsModelLayers = true,
    supportsLocationPuck = hasLocationFeature(),
  )

  private fun hasLocationFeature(): Boolean {
    val context = NitroModules.applicationContext
      ?: throw IllegalStateException("NitroModules.applicationContext is not set; MapboxMaps was created before React Native started")
    return context.packageManager.hasSystemFeature(PackageManager.FEATURE_LOCATION)
  }
}
