package com.margelo.nitro.mapboxar.nativemap

import com.mapbox.geojson.Point

/** Converts an SDK point to the Nitro value. Altitude is not set. */
internal fun Point.toGeographicCoordinate(): GeographicCoordinate =
  GeographicCoordinate(latitude = latitude(), longitude = longitude(), altitude = null)
