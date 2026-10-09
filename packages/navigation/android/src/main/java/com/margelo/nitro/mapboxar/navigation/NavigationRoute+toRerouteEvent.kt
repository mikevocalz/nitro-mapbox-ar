package com.margelo.nitro.mapboxar.navigation

import com.mapbox.navigation.base.route.NavigationRoute
import org.json.JSONArray
import org.json.JSONObject

/**
 * The route as a `RerouteEvent`: a one-route response built from
 * `DirectionsRoute.toJson()` and a request URL from
 * `RouteOptions.toUrl(accessToken)` (mapbox-java 7.10.1).
 */
internal fun NavigationRoute.toRerouteEvent(accessToken: String): RerouteEvent {
  val route = directionsRoute
  val response = JSONObject()
    .put("code", "Ok")
    .put("routes", JSONArray().put(JSONObject(route.toJson())))
  return RerouteEvent(
    routes = NavigationRoutesInput(
      responseJson = response.toString(),
      requestUrl = route.routeOptions()?.toUrl(accessToken)?.toString() ?: "",
      primaryRouteIndex = 0.0,
    ),
    legs = (route.legs() ?: emptyList()).map { it.toRouteLeg() }.toTypedArray(),
  )
}
