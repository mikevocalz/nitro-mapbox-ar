package com.margelo.nitro.mapboxar.navigation

import android.content.Context
import com.mapbox.navigation.base.options.EHorizonOptions
import com.mapbox.navigation.base.options.NavigationOptions

/** SDK options for a session with these settings. */
internal fun TripSessionOptions.navigationOptions(context: Context): NavigationOptions =
  NavigationOptions.Builder(context)
    .eHorizonOptions(
      EHorizonOptions.Builder()
        .length(500.0)
        .expansion(1)
        .branchLength(50.0)
        .build(),
    )
    .build()
