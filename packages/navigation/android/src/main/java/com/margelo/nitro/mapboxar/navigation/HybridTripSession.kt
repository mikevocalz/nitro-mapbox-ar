package com.margelo.nitro.mapboxar.navigation

import android.annotation.SuppressLint
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.mapbox.common.location.Location
import com.mapbox.navigation.base.ExperimentalPreviewMapboxNavigationAPI
import com.mapbox.navigation.base.trip.model.eh.EHorizonPosition
import com.mapbox.navigation.base.trip.model.roadobject.RoadObjectEnterExitInfo
import com.mapbox.navigation.base.trip.model.roadobject.RoadObjectPassInfo
import com.mapbox.navigation.base.trip.model.roadobject.distanceinfo.RoadObjectDistanceInfo
import com.mapbox.navigation.core.MapboxNavigation
import com.mapbox.navigation.core.MapboxNavigationProvider
import com.mapbox.navigation.core.directions.session.RoutesExtra
import com.mapbox.navigation.core.directions.session.RoutesObserver
import com.mapbox.navigation.core.replay.route.ReplayRouteSession
import com.mapbox.navigation.core.reroute.RerouteController
import com.mapbox.navigation.core.reroute.RerouteState
import com.mapbox.navigation.core.trip.session.LocationMatcherResult
import com.mapbox.navigation.core.trip.session.LocationObserver
import com.mapbox.navigation.core.trip.session.RouteProgressObserver
import com.mapbox.navigation.core.trip.session.eh.EHorizonObserver

/**
 * A trip session over one `MapboxNavigation` instance. SDK observers run on
 * the main thread; JS-facing methods hop there once through
 * [SharedNavigation.mainScope].
 */
@Keep
@DoNotStrip
@OptIn(ExperimentalPreviewMapboxNavigationAPI::class)
class HybridTripSession internal constructor(
  private val navigation: MapboxNavigation,
  private val accessToken: String,
  replay: Boolean,
  enableRerouting: Boolean,
  private val enableElectronicHorizon: Boolean,
) : HybridTripSessionSpec() {
  private val progressListeners = ListenerRegistry<NavigationProgress>()
  private val rerouteListeners = ListenerRegistry<RerouteEvent>()
  private val errorListeners = ListenerRegistry<Throwable>()
  private var replaySession: ReplayRouteSession? = null
  private var lastLocation: Location? = null
  private var latestHorizon: EHorizonPosition? = null
  @Volatile private var stopped = false

  private val locationObserver = object : LocationObserver {
    override fun onNewRawLocation(rawLocation: Location) = Unit

    override fun onNewLocationMatcherResult(locationMatcherResult: LocationMatcherResult) {
      lastLocation = locationMatcherResult.enhancedLocation
    }
  }

  private val progressObserver = RouteProgressObserver { progress ->
    progressListeners.emit(progress.toNavigationProgress(lastLocation))
  }

  private val routesObserver = RoutesObserver { result ->
    if (result.reason != RoutesExtra.ROUTES_UPDATE_REASON_REROUTE) return@RoutesObserver
    val primary = result.navigationRoutes.firstOrNull() ?: return@RoutesObserver
    rerouteListeners.emit(primary.toRerouteEvent(accessToken))
  }

  private val rerouteStateObserver = RerouteController.RerouteStateObserver { state ->
    if (state is RerouteState.Failed) {
      errorListeners.emit(IllegalStateException("Reroute failed: ${state.message}", state.throwable))
    }
  }

  private val eHorizonObserver = object : EHorizonObserver {
    override fun onPositionUpdated(position: EHorizonPosition, distances: List<RoadObjectDistanceInfo>) {
      latestHorizon = position
    }

    override fun onRoadObjectAdded(roadObjectId: String) = Unit
    override fun onRoadObjectEnter(objectEnterExitInfo: RoadObjectEnterExitInfo) = Unit
    override fun onRoadObjectExit(objectEnterExitInfo: RoadObjectEnterExitInfo) = Unit
    override fun onRoadObjectPassed(objectPassInfo: RoadObjectPassInfo) = Unit
    override fun onRoadObjectRemoved(roadObjectId: String) = Unit
    override fun onRoadObjectUpdated(roadObjectId: String) = Unit
  }

  init {
    navigation.setRerouteEnabled(enableRerouting)
    navigation.registerLocationObserver(locationObserver)
    navigation.registerRouteProgressObserver(progressObserver)
    navigation.registerRoutesObserver(routesObserver)
    navigation.getRerouteController()?.registerRerouteStateObserver(rerouteStateObserver)
    if (enableElectronicHorizon) navigation.registerEHorizonObserver(eHorizonObserver)
    if (replay) {
      // ReplayRouteSession.onAttached calls startReplayTripSession and plays
      // positions along the routes passed to setNavigationRoutes.
      replaySession = ReplayRouteSession().also { it.onAttached(navigation) }
    } else {
      startDeviceTripSession()
    }
  }

  // Location permission is checked in HybridMapboxNavigation.createTripSession.
  @SuppressLint("MissingPermission")
  private fun startDeviceTripSession() {
    navigation.startTripSession()
  }

  override fun setRoutes(routes: NavigationRoutesInput): Promise<Unit> {
    val (options, primaryIndex) = routes.validatedRouteOptions()
    return Promise.async(SharedNavigation.mainScope) {
      ensureActive()
      val fetched = navigation.awaitRoutes(options)
      check(primaryIndex < fetched.size) {
        "primaryRouteIndex $primaryIndex is out of range for the ${fetched.size} route(s) the Navigation SDK fetched"
      }
      ensureActive()
      val ordered = listOf(fetched[primaryIndex]) + fetched.filterIndexed { index, _ -> index != primaryIndex }
      navigation.awaitSetRoutes(ordered)
    }
  }

  override fun addOnProgressListener(listener: (progress: NavigationProgress) -> Unit): ListenerSubscription =
    ListenerSubscription(progressListeners.add(listener))

  override fun addOnRerouteListener(listener: (event: RerouteEvent) -> Unit): ListenerSubscription =
    ListenerSubscription(rerouteListeners.add(listener))

  override fun addOnErrorListener(listener: (error: Throwable) -> Unit): ListenerSubscription =
    ListenerSubscription(errorListeners.add(listener))

  override fun getElectronicHorizon(): Promise<ElectronicHorizon?> {
    check(enableElectronicHorizon) { "This TripSession was created without enableElectronicHorizon" }
    return Promise.async(SharedNavigation.mainScope) {
      ensureActive()
      latestHorizon?.toElectronicHorizon(navigation.graphAccessor)
    }
  }

  override fun stop(): Promise<Unit> =
    Promise.async(SharedNavigation.mainScope) {
      if (stopped) return@async
      stopped = true
      progressListeners.clear()
      rerouteListeners.clear()
      errorListeners.clear()
      replaySession?.onDetached(navigation)
      replaySession = null
      navigation.unregisterLocationObserver(locationObserver)
      navigation.unregisterRouteProgressObserver(progressObserver)
      navigation.unregisterRoutesObserver(routesObserver)
      navigation.getRerouteController()?.unregisterRerouteStateObserver(rerouteStateObserver)
      if (enableElectronicHorizon) navigation.unregisterEHorizonObserver(eHorizonObserver)
      navigation.stopTripSession()
      MapboxNavigationProvider.destroy()
      if (SharedNavigation.activeSession === this@HybridTripSession) SharedNavigation.activeSession = null
    }

  private fun ensureActive() {
    check(!stopped) { "TripSession was stopped" }
  }
}
