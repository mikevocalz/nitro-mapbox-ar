package com.margelo.nitro.mapboxar.nativemap

import com.mapbox.bindgen.Expected

/** Returns the value, or throws with the SDK's error string. */
internal fun <V> Expected<String, V>.orThrow(operation: String): V {
  error?.let { throw IllegalStateException("$operation failed: $it") }
  return value ?: throw IllegalStateException("$operation returned no value")
}
