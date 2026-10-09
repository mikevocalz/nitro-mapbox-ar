package com.margelo.nitro.mapboxar.nativemap

/** Converts SDK insets (pixels) to the Nitro value (dp). */
internal fun com.mapbox.maps.EdgeInsets.toNitroInsets(density: Float): EdgeInsets =
  EdgeInsets(top = top / density, left = left / density, bottom = bottom / density, right = right / density)
