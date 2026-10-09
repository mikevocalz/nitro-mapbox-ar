package com.margelo.nitro.mapboxar.navigation

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * Process-wide state shared by the root and its sessions. The Navigation SDK
 * is `@UiThread` (`MapboxNavigationProvider`, `MapboxNavigation` in
 * navigation/api/current.txt), so every SDK call runs in [mainScope], and
 * [activeSession] is only read or written there.
 */
internal object SharedNavigation {
  val mainScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  var activeSession: HybridTripSession? = null
}
