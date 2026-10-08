package com.margelo.nitro.mapboxar

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

/**
 * Read-only view of `MapboxAR.accessToken` for Kotlin code in other modules
 * (the maps and navigation packages).
 *
 * The value is process-wide and may change at any time from JS; read it at
 * the point of use instead of caching it.
 */
@Keep
@DoNotStrip
object MapboxARAccessToken {
  init {
    NitroMapboxAROnLoad.initializeNative()
  }

  /** The current token, or an empty string when none is set. */
  val current: String
    get() = nativeCurrent()

  @JvmStatic
  @DoNotStrip
  private external fun nativeCurrent(): String
}
