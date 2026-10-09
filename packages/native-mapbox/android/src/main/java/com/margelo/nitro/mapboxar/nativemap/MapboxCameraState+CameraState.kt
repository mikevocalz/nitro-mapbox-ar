package com.margelo.nitro.mapboxar.nativemap

/** Converts the SDK's rendered camera to the Nitro value. */
internal fun com.mapbox.maps.CameraState.toNitroCameraState(density: Float): CameraState =
  CameraState(
    center = center.toGeographicCoordinate(),
    zoom = zoom,
    bearingDeg = bearing,
    pitchDeg = pitch,
    padding = padding.toNitroInsets(density),
  )
