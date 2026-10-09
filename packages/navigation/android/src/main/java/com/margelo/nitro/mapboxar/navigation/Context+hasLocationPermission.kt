package com.margelo.nitro.mapboxar.navigation

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat

/** Whether the app holds coarse or fine location permission. */
internal fun Context.hasLocationPermission(): Boolean =
  listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    .any { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }
