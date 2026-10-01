package com.margelo.nitro.mapboxar.nativemap

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.mapboxar.nativemap.views.HybridMapboxMapViewManager

class NitroMapboxARNativeMapPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider { HashMap() }

  override fun createViewManagers(
    reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> =
    listOf(HybridMapboxMapViewManager())

  companion object {
    init {
      NitroMapboxARNativeMapOnLoad.initializeNative()
    }
  }
}
