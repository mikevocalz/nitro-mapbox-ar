package com.margelo.nitro.mapboxar.nativemap

import com.mapbox.geojson.Point

/**
 * Returns the SDK point after checking WGS84 bounds.
 *
 * @param field name used in the error message, for example `target.center`.
 */
internal fun GeographicCoordinate.toValidatedPoint(field: String): Point {
  require(
    latitude.isFinite() && longitude.isFinite() &&
      latitude in -90.0..90.0 && longitude in -180.0..180.0,
  ) {
    "$field must be a WGS84 coordinate (latitude -90 to 90, longitude -180 to 180), got $latitude, $longitude"
  }
  return Point.fromLngLat(longitude, latitude)
}
