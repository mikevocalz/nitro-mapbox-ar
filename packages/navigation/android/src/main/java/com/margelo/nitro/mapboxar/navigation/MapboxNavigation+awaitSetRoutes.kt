package com.margelo.nitro.mapboxar.navigation

import com.mapbox.navigation.base.route.NavigationRoute
import com.mapbox.navigation.core.MapboxNavigation
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

/** `setNavigationRoutes` as a suspend call that fails when the SDK rejects the routes. */
internal suspend fun MapboxNavigation.awaitSetRoutes(routes: List<NavigationRoute>) =
  suspendCancellableCoroutine { continuation ->
    setNavigationRoutes(routes, 0) { result ->
      result.fold(
        { error -> continuation.resumeWithException(IllegalStateException("Navigation SDK rejected the routes: ${error.message}")) },
        { continuation.resume(Unit) },
      )
    }
  }
