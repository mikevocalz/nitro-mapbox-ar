package com.margelo.nitro.mapboxar.navigation

import com.mapbox.api.directions.v5.models.RouteOptions
import java.net.URL
import org.json.JSONObject

/**
 * Checks `responseJson` and `primaryRouteIndex`, then parses `requestUrl`
 * with `RouteOptions.fromUrl` (mapbox-java 7.10.1). Messages never include
 * the URL: it carries the access token.
 */
internal fun NavigationRoutesInput.validatedRouteOptions(): Pair<RouteOptions, Int> {
  val routes = try {
    JSONObject(responseJson).getJSONArray("routes")
  } catch (error: Exception) {
    throw IllegalArgumentException("responseJson is not a Directions API response with a routes array")
  }
  val index = primaryRouteIndex?.toInt() ?: 0
  require(index in 0 until routes.length()) {
    "primaryRouteIndex $index is out of range for ${routes.length()} route(s)"
  }
  val options = try {
    RouteOptions.fromUrl(URL(requestUrl))
  } catch (error: Exception) {
    throw IllegalArgumentException("requestUrl is not a Directions API request URL")
  }
  return options to index
}
