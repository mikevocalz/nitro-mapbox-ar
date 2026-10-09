package com.margelo.nitro.mapboxar.nativemap

/** The Mapbox Style Specification name of this layer type. */
internal val StyleLayerType.styleSpecName: String
  get() = name.lowercase().replace('_', '-')
