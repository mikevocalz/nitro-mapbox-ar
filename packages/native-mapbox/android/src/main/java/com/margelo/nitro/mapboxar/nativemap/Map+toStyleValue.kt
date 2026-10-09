package com.margelo.nitro.mapboxar.nativemap

import com.mapbox.bindgen.Value
import org.json.JSONObject

/**
 * Builds an SDK [Value] from JSON-compatible Kotlin maps, lists and arrays,
 * as `AnyMap.toHashMap()` returns them.
 *
 * SDK: `Value.fromJson` (used the same way in extension-style
 * `types/PromoteId.kt:59`).
 */
internal fun Map<String, Any?>.toStyleValue(operation: String): Value =
  Value.fromJson(JSONObject(this).toString()).orThrow(operation)
