package com.margelo.nitro.mapboxar.navigation

import com.mapbox.api.directions.v5.models.RouteOptions
import com.mapbox.navigation.base.route.NavigationRoute
import com.mapbox.navigation.base.route.NavigationRouterCallback
import com.mapbox.navigation.base.route.RouterFailure
import com.mapbox.navigation.core.MapboxNavigation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

/** `requestRoutes` as a suspend call; cancelling cancels the request. */
internal suspend fun MapboxNavigation.awaitRoutes(options: RouteOptions): List<NavigationRoute> =
  suspendCancellableCoroutine { continuation ->
    val requestId = requestRoutes(
      options,
      object : NavigationRouterCallback {
        override fun onRoutesReady(routes: List<NavigationRoute>, routerOrigin: String) {
          continuation.resume(routes)
        }

        override fun onFailure(reasons: List<RouterFailure>, routeOptions: RouteOptions) {
          val message = reasons.joinToString("; ") { it.message }
          continuation.resumeWithException(IllegalStateException("Route request failed: $message"))
        }

        override fun onCanceled(routeOptions: RouteOptions, routerOrigin: String) {
          continuation.cancel()
        }
      },
    )
    continuation.invokeOnCancellation { cancelRouteRequest(requestId) }
  }
