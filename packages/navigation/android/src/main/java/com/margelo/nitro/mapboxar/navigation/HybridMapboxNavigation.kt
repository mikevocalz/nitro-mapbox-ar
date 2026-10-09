package com.margelo.nitro.mapboxar.navigation

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import com.margelo.nitro.mapboxar.MapboxARAccessToken
import com.mapbox.common.MapboxOptions
import com.mapbox.navigation.core.MapboxNavigationProvider

/**
 * The `MapboxNavigation` root. Creates one [HybridTripSession] at a time;
 * each session gets its own `MapboxNavigation` from
 * `MapboxNavigationProvider.create`, destroyed again on `stop()`.
 */
@Keep
@DoNotStrip
class HybridMapboxNavigation : HybridMapboxNavigationSpec() {
  /**
   * Fixed by what this binding wires up: incidents and offline regions are
   * not configured, so they report `false`.
   */
  override val capabilities = NativeNavigationCapabilities(
    activeGuidance = true,
    rerouting = true,
    trafficRefresh = true,
    incidents = false,
    predictiveCaching = true,
    offlineRegions = false,
    electronicHorizon = true,
  )

  override fun createTripSession(options: TripSessionOptions): Promise<HybridTripSessionSpec> {
    val accessToken = MapboxARAccessToken.current
    check(accessToken.isNotEmpty()) { "Mapbox access token is not set (MapboxNavigation.createTripSession)" }
    val context = NitroModules.applicationContext
      ?: throw IllegalStateException("React application context is not available yet")
    val replay = options.locationSource == TripLocationSource.REPLAY_PRIMARY_ROUTE
    check(replay || context.hasLocationPermission()) {
      "Location permission is not granted; request it before a device trip session, or use locationSource 'replay-primary-route'"
    }
    return Promise.async(SharedNavigation.mainScope) {
      check(SharedNavigation.activeSession == null) {
        "A trip session is already active; call TripSession.stop() first"
      }
      if (MapboxNavigationProvider.isCreated()) MapboxNavigationProvider.destroy()
      MapboxOptions.accessToken = accessToken
      val navigation = MapboxNavigationProvider.create(options.navigationOptions(context))
      val session = HybridTripSession(
        navigation = navigation,
        accessToken = accessToken,
        replay = replay,
        enableRerouting = options.enableRerouting ?: true,
        enableElectronicHorizon = options.enableElectronicHorizon ?: false,
      )
      SharedNavigation.activeSession = session
      session
    }
  }
}
