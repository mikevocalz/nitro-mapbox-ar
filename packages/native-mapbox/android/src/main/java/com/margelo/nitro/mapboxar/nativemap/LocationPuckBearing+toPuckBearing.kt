package com.margelo.nitro.mapboxar.nativemap

import com.mapbox.maps.plugin.PuckBearing

/**
 * The SDK bearing source for this prop value, or `null` for
 * [LocationPuckBearing.NONE], which turns puck rotation off.
 *
 * SDK: PuckBearing.HEADING / COURSE (sdk-base ConfigProperties.kt, read from the
 * 11.32.0 AAR with javap).
 */
internal fun LocationPuckBearing.toPuckBearing(): PuckBearing? =
  when (this) {
    LocationPuckBearing.HEADING -> PuckBearing.HEADING
    LocationPuckBearing.COURSE -> PuckBearing.COURSE
    LocationPuckBearing.NONE -> null
  }
