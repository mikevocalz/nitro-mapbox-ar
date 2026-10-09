package com.margelo.nitro.mapboxar.nativemap

import android.animation.Animator
import android.animation.AnimatorListenerAdapter

/**
 * Reports how a high-level camera animation ended. The SDK attaches this to
 * the `AnimatorSet` it builds for `flyTo` / `easeTo`
 * (`plugin-animation/.../CameraAnimationsPluginImpl.kt:1014-1018`); a
 * cancelled set calls `onAnimationCancel` and then `onAnimationEnd`.
 */
internal class CameraAnimationEndListener(
  private val onEnd: (CameraAnimationEnd) -> Unit,
) : AnimatorListenerAdapter() {
  private var cancelled = false

  override fun onAnimationCancel(animation: Animator) {
    cancelled = true
  }

  override fun onAnimationEnd(animation: Animator) {
    onEnd(if (cancelled) CameraAnimationEnd.INTERRUPTED else CameraAnimationEnd.FINISHED)
  }
}
