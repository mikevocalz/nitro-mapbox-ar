# Maps SDK 11.32.0 inventory

What `@mikevocalz/nitro-mapbox-ar-maps` binds, and the SDK symbol behind each
member. Phase 4 binds only the rows in this file.

## Sources read

| SDK | Where | Tag / commit |
| --- | --- | --- |
| Mapbox Maps iOS | `github.com/mapbox/mapbox-maps-ios`, `Sources/MapboxMaps` | tag `11.32.0` (commit `357e1447`); this repo tags iOS releases without a `v` |
| MapboxCoreMaps iOS | `MapboxCoreMaps.xcframework-dynamic.zip` from `api.mapbox.com/downloads/v2/mobile-maps-core/releases/ios/packages/11.32.0/`, `ios-arm64` slice: `arm64-apple-ios.swiftinterface` and `Headers/MBM*.h` | sha256 `a69c75a9…e709`, matching `mapbox-core-maps-ios` `v11.32.0` `Package.swift` |
| Turf (iOS) | `github.com/mapbox/turf-swift` `Sources/Turf` | `v4.0.0`, the version `mapbox-common-ios` `v24.32.0` pins |
| Mapbox Maps Android | `github.com/mapbox/mapbox-maps-android`: `maps-sdk`, `sdk-base`, `extension-style`, `plugin-animation`, `plugin-annotation`, `plugin-gestures`, `plugin-locationcomponent` sources and each module's `api/Release/metalava.txt` | tag `v11.32.0` (commit `8020da5a`) |

iOS paths below are relative to `Sources/MapboxMaps/`; Android paths to the
repository root. The Android core classes (`Value`, `Expected`,
`LayerPosition`, `QueriedRenderedFeature`, `MapLoadingError`,
`StyleObjectInfo`, `CameraOptions`, `com.mapbox.common.MapboxOptions`) ship
in binary AARs on the Mapbox Maven repository, which needs a downloads
token; they were read only through their uses in the open sources, cited
per row.

## Managers and plugins bound

| Concern | iOS | Android |
| --- | --- | --- |
| Map view | `MapView.init(frame:mapInitOptions:)` `Foundation/MapView.swift:324`; `MapInitOptions(cameraOptions:styleURI:)` `Foundation/MapInitOptions.swift:58` | `MapView(Context, MapInitOptions)` `maps-sdk/api/Release/metalava.txt:126`; `MapInitOptions(context, …, cameraOptions, …, styleUri)` `maps-sdk/src/main/java/com/mapbox/maps/MapInitOptions.kt:28-36` |
| Token | `MapboxOptions.accessToken` (MapboxCommon, re-exported by `Foundation/Reexports.swift:2`) | `com.mapbox.common.MapboxOptions.accessToken` `maps-sdk/.../MapController.kt:8,103` |
| Style (`MapboxMap` / `MapboxStyleManager`) | `StyleManager` in `Style/StyleManager.swift` | `MapboxStyleManager` in `sdk-base/.../MapboxStyleManager.kt`, API in `sdk-base/api/Release/metalava.txt` |
| Camera animation | `CameraAnimationsManager` `Camera/CameraAnimationsManager.swift:4` (`MapView.camera`, `Foundation/MapView.swift:138`) | `camera` plugin, `plugin-animation/.../CameraAnimationsExt.kt:34` |
| Gestures | `GestureManager` `Gestures/GestureManager.swift:17` (`MapView.gestures`, `:132`); `TapInteraction` `Interactions/Interactions.swift:48` | `gestures` plugin `plugin-gestures/.../GesturesExt.kt:18` |
| Annotations | `AnnotationOrchestrator` `Annotations/AnnotationOrchestrator.swift` (`MapView.annotations`, `Foundation/MapView.swift:145`) | `annotations` plugin `plugin-annotation/.../AnnotationExt.kt:12` |

Not bound: `LocationManager` / `location` plugin, `ViewportManager` /
`viewport` plugin, offline, snapshots, view annotations, model sources,
featureset interactions. `MapCapabilities.supportsLocationPuck` reports
hardware only; there is no puck API in this package.

## Members

### `MapboxMaps` (root)

| Member | iOS | Android |
| --- | --- | --- |
| `isMapViewAvailable` | `true` in the iOS build. visionOS builds a separate class that returns `false`: the package imports MapboxMaps only under `#if os(iOS)`. MapboxMaps comes from Swift Package Manager (`mapbox-maps-ios` 11.32.0), shared with the navigation package's `MapboxNavigationCore` | `true` |
| `sdkVersion` | `MapboxMaps.json` resource (`{"version": "11.32.0"}`), found the way `Foundation/Extensions/Bundle+MapboxMaps.swift:10-26` finds it; `Bundle.mapboxMapsMetadata` itself is `@_spi(Internal)` | `com.mapbox.maps.base.BuildConfig.MAPBOX_SDK_VERSION` `sdk-base/build.gradle.kts:16,27` |
| `capabilities.supportsGlobeProjection` | `StyleProjectionName.globe` `Style/Generated/Properties/Properties.swift:743` | `true`; GPUs without vertex texture units fall back to Mercator (`extension-style/.../projection/generated/Projection.kt:26-28`), which cannot be detected before a map renders |
| `capabilities.supportsTerrain` | `StyleManager.setTerrain(_:)` `Style/StyleManager.swift:1293` | `setStyleTerrain` `sdk-base/api/Release/metalava.txt:247` |
| `capabilities.supportsModelLayers` | `ModelLayer` `Style/Generated/Layers/ModelLayer.swift:7` | `ModelLayer` `extension-style/.../layers/generated/ModelLayer.kt:29` |
| `capabilities.supportsLocationPuck` | `true` (iPhone hardware) | `PackageManager.FEATURE_LOCATION` |

`capabilities` was a readonly property of `MapboxMapViewMethods` in the
approved sketch. Nitrogen 0.37.1 copies only methods from a Hybrid View's
methods interface (`nitrogen/lib/createPlatformSpec.js`, `methods:
methodsSpec?.methods ?? []`), so a property there is dropped without an
error. It moved to the root, where the values belong anyway: they describe
the device, not one view.

### `MapboxMapView` props

| Prop | iOS | Android |
| --- | --- | --- |
| `styleUri` | `MapboxMap.load(mapStyle:transition:completion:)` `Style/StyleManager.swift:579`, `MapStyle(uri:)` `Style/MapStyle.swift:107`, `StyleURI(rawValue:)` `Style/StyleURI.swift:15` | `MapboxMap.loadStyle(String, OnStyleLoaded)` `maps-sdk/api/Release/metalava.txt:259` |
| `camera` | `MapboxMap.setCamera(to:)` `Foundation/MapboxMap.swift:923`; `CameraOptions.init(center:padding:anchor:zoom:bearing:pitch:)` (CoreMaps swiftinterface) | `MapboxMap.setCamera(CameraOptions)`, `CameraOptions.Builder` |
| `projection` | `StyleManager.setProjection(_:)` `Style/StyleManager.swift:1861`, `StyleProjection(name:)` `Style/StyleProjection.swift:8` | `setStyleProjection(Value)` `sdk-base/api/Release/metalava.txt:238` |
| `enableGestures` | `GestureOptions.panEnabled` … `quickZoomEnabled` `Gestures/GestureOptions.swift:23-68` | `GesturesSettings` `sdk-base/api/Release/metalava.txt:2583-2599`, `updateSettings` |

### `MapboxMapView` methods

| Method | iOS | Android |
| --- | --- | --- |
| `loadStyle` | as `styleUri`; `CancelError` `Style/StyleErrors.swift:26` marks a superseded load | as `styleUri`; failures from `subscribeMapLoadingError` with `MapLoadingErrorType.STYLE` (`metalava.txt:357`; enum use at `extension-style/.../GeoJsonSource.kt:91`) |
| `createPointAnnotationManager` | `AnnotationOrchestrator.makePointAnnotationManager(id:layerPosition:clusterOptions:…)` `Annotations/AnnotationOrchestrator.swift:97` | `AnnotationPlugin.createPointAnnotationManager(AnnotationConfig)` `plugin-annotation/.../generated/PointAnnotationManager.kt:2975`; `AnnotationConfig(belowLayerId, layerId, sourceId)` `sdk-base/.../annotation/AnnotationConfig.kt:6` |
| `flyTo` | `CameraAnimationsManager.fly(to:duration:curve:completion:)` `Camera/CameraAnimationsManager.swift:41`; `AnimationCompletion` `Camera/AnimationCompletion.swift:4` | `flyTo(CameraOptions, MapAnimationOptions?, AnimatorListener?)` `plugin-animation/.../CameraAnimationsExt.kt:72`; listener on the `AnimatorSet`, `CameraAnimationsPluginImpl.kt:1014-1018` |
| `easeTo` | `ease(to:duration:curve:completion:)` `Camera/CameraAnimationsManager.swift:61` | `easeTo(…)` `CameraAnimationsExt.kt:53` |
| `fitBounds` | `MapboxMap.camera(for:camera:coordinatesPadding:maxZoom:offset:)` `Foundation/MapboxMap.swift:707`, then `ease` | `cameraForCoordinates(coordinates, camera, coordinatesPadding, maxZoom, offset, result)` `maps-sdk/api/Release/metalava.txt:209`, then `easeTo` |
| `getCameraState` | `MapboxMap.cameraState` `Foundation/MapboxMap.swift:928`; `CameraState` (CoreMaps swiftinterface line 41) | `MapboxMap.cameraState` `maps-sdk/.../MapboxMap.kt:109` |
| `addOnCameraChangedListener` | `MapboxMap.onCameraChanged` `Foundation/MapboxMap.swift:1458`; `CameraChanged.cameraState` `MapEvents/CoreEventsExtensions.swift:9` | `subscribeCameraChanged` `metalava.txt:352`; `it.cameraState` `maps-sdk/.../MapController.kt:128` |
| `addOnMapTapListener` | `MapboxMap.addInteraction(_:)` `Foundation/MapboxMap.swift:2034` with `TapInteraction(action:)` `Interactions/Interactions.swift:61` (`GestureManager.onMapTap` is deprecated at `Gestures/GestureManager.swift:117`) | `addOnMapClickListener` / `removeOnMapClickListener` `plugin-gestures/.../GesturesExt.kt:27,36`; `pixelForCoordinate` `metalava.txt:273` |
| `addOnStyleLoadedListener` | `MapboxMap.onStyleLoaded` `Foundation/MapboxMap.swift:1442` | `subscribeStyleLoaded` `metalava.txt:367` |
| `addOnMapLoadingErrorListener` | `MapboxMap.onMapLoadingError` `Foundation/MapboxMap.swift:1436`; `MapLoadingError.message` `MBMMapLoadingError.h:38` | `subscribeMapLoadingError` `metalava.txt:357`; `it.message` `maps-sdk/.../Snapshotter.kt:67` |
| `queryRenderedFeatures` | `MapboxMap.queryRenderedFeatures(with:options:completion:)` `Foundation/MapboxMap.swift:1225`; `RenderedQueryOptions(layerIds:filter:)` `Foundation/Extensions/Core/RenderedQueryOptions.swift:10` | `queryRenderedFeatures(RenderedQueryGeometry, RenderedQueryOptions, callback)` `metalava.txt:277`; constructors as used in `plugin-annotation/.../AnnotationManagerImpl.kt:969-970` and `maps-sdk/.../MapboxMap.kt:3039` |

### `MapStyle`

| Method | iOS (`Style/StyleManager.swift`) | Android (`sdk-base/api/Release/metalava.txt`) |
| --- | --- | --- |
| `addGeoJsonSource` | `addSource(_:dataId:)` :265, `GeoJSONSource(id:)` `Style/Generated/Sources/GeoJSONSource.swift:91`, `GeoJSONSourceData.string` `Style/Types/GeoJSONSourceData.swift:8` | `addStyleSource(String, Value)` :171 |
| `setGeoJsonSourceData` | `updateGeoJSONSource(withId:geoJSON:dataId:)` :332 | `setStyleGeoJSONSourceData` :228, `GeoJSONSourceData.valueOf(String)` `extension-style/.../GeoJsonSource.kt:112` |
| `addRasterDemSource` | `RasterDemSource(id:)`, `url`, `tileSize` `Style/Generated/Sources/RasterDemSource.swift:67,13,32` | `addStyleSource` :171 |
| `addVectorSource` | `VectorSource(id:)`, `url` `Style/Generated/Sources/VectorSource.swift:73,13` | `addStyleSource` :171 |
| `removeSource` | `removeSource(withId:)` :1006, `allLayerIdentifiers` :844, `layerProperties(for:)` :933 | `removeStyleSource` :213, `styleLayers` :260, `getStyleLayerProperty` :185 |
| `addLayer` | `addLayer(with:layerPosition:)` :714; `LayerPosition.below(String)` (CoreMaps swiftinterface line 85) | `addStyleLayer(Value, LayerPosition?)` :169; `LayerPosition(above, below, at)` as used in `plugin-annotation/.../AnnotationManagerImpl.kt:197` |
| `removeLayer` | `removeLayer(withId:)` :820, `layerExists(withId:)` :834 | `removeStyleLayer` :211, `styleLayerExists` :250 |
| `setTerrain` | `setTerrain(_:)` :1293, `Terrain(sourceId:)` `Style/Generated/Terrain.swift:11`, `sourceProperties(for:)` :1059 | `setStyleTerrain` :247, `styleSources` :263 |
| `clearTerrain` | `removeTerrain()` :1302 | `MapboxStyleManager.removeTerrain()` `extension-style/.../terrain/generated/TerrainExt.kt:31` |
| `setStandardConfig` | `setStyleImportConfigProperties(for:configs:)` :678, `styleImports` :620; keys `lightPreset`, `show3dObjects`, `showPointOfInterestLabels` from `Style/Generated/MapStyle+Standard.swift:101-108` | `setStyleImportConfigProperties` :230, `getStyleImports` :182 |

### `PointAnnotationManager`

| Method | iOS | Android |
| --- | --- | --- |
| `setAnnotations` | `PointAnnotationManager.annotations` `Annotations/Generated/PointAnnotationManager.swift:16`; `PointAnnotation(id:coordinate:…)` `Annotations/Generated/PointAnnotation.swift:175`; `iconImage` :196, `textField` :227 | `deleteAll()` / `create(List)` `plugin-annotation/.../AnnotationManagerImpl.kt:633,578`; `PointAnnotationOptions.withPoint` / `withIconImage(String)` / `withTextField` `generated/PointAnnotationOptions.kt:787,76,220` |
| `addOnAnnotationTapListener` | `PointAnnotation.tapHandler` `Annotations/Generated/PointAnnotation.swift:25`; returning `true` consumes the tap | `addClickListener(OnPointAnnotationClickListener)` `sdk-base/.../annotation/AnnotationManager.kt:122`; `OnAnnotationClickListener.onAnnotationClick` returns `true` to consume |
| `removeFromMap` | `AnnotationOrchestrator.removeAnnotationManager(withId:)` `Annotations/AnnotationOrchestrator.swift:163` | `AnnotationPlugin.removeAnnotationManager` `sdk-base/.../annotation/AnnotationPlugin.kt:28` |

Android annotation ids are UUIDs the SDK generates (`AnnotationManagerImpl.kt:580`), so the manager keeps a map from SDK id to the caller's id. iOS takes the caller's id directly.

### `RenderedFeature`

| Member | iOS | Android |
| --- | --- | --- |
| `featureId`, `toGeoJson` | Turf 4.0.0 `Feature.identifier` (`FeatureIdentifier.string` / `.number`), `Feature: Codable` | `com.mapbox.geojson.Feature.id()`, `toJson()` |
| `sourceId`, `sourceLayer`, `layerIds` | `QueriedFeature.source` / `.sourceLayer` `MBMQueriedFeature.h:24,30`; `QueriedRenderedFeature.layers` `MBMQueriedRenderedFeature.h:31` | same bindgen class; the Android accessors (`queriedFeature.source`, `.sourceLayer`, `layers`) were not read from source |

## Annotation lifetime across style reloads (decision 10)

Managers survive style reloads on both platforms in 11.32.0, so
`PointAnnotationManager` stays unscoped from `MapStyle`.

- iOS: the manager adds its layer with `addPersistentLayer`
  (`Annotations/AnnotationManagerImpl.swift:141-142`). `StyleManager`
  documents persistent layers as "valid across `style` changes"
  (`Style/StyleManager.swift:104-105`), and `makePointAnnotationManager`
  says "Annotations persist across style changes"
  (`Annotations/AnnotationOrchestrator.swift:85-86`).
- Android: the manager adds its layers with `addPersistentLayer`
  (`plugin-annotation/.../AnnotationManagerImpl.kt:195,208,229`).
  `addPersistentStyleLayer` keeps the layer, its source and images added
  through `addStyleImage` when a new style loads
  (`sdk-base/.../MapboxStyleManager.kt:437-441`). If the new style defines
  the same layer, source or image id, the style's copy wins and a
  `MapLoadingError` fires.

`PointAnnotation.iconImageId` names an image in the style. An image that
came with the old style is gone after a reload unless the new style has it
too.

## Verification

- Swift: every file in `packages/native-mapbox/ios` compiled with
  `xcodebuild` for `generic/platform=iOS Simulator` and
  `generic/platform=visionOS Simulator` against MapboxMaps 11.32.0 built
  from the tagged sources above, with Nitro's Swift runtime and the
  Nitrogen-generated types replaced by plain-Swift stand-ins of the same
  names and signatures. The real Nitro C++ bridge was not compiled.
- Kotlin: not compiled. The Maps Android AARs need a Mapbox downloads
  token and none is configured on this machine.
- No device run. The XCTest and instrumented tests the Phase 4 gate asks
  for on iPhone and Pixel, and the screenshot diffs, have not been run.
