package com.margelo.nitro.mapboxar.navigation

import com.mapbox.geojson.Point

internal fun Point.toGeographicCoordinate(): GeographicCoordinate =
  GeographicCoordinate(latitude(), longitude(), if (hasAltitude()) altitude() else null)
