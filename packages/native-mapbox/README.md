# @mikevocalz/nitro-mapbox-ar-maps

Optional native Mapbox Maps UI for the revived Nitro Mapbox AR stack.

This package is intentionally separate from the core package. Apps that only
need Terrain-RGB, WebGPU/TypeGPU terrain rendering, Skia Graphite compositing,
or Viro/ReactVision XR do not need to ship the native Mapbox Maps SDK.

## Current native SDK baseline

- Android Maps SDK: **11.32.0**
- iOS Maps SDK binary: **11.32.0**
- Nitro Modules / Nitrogen: **0.37.1**
- Android uses the `android-ndk27` Mapbox artifact for 16 KB page-size support.

Override the native Mapbox version only when deliberately testing another v11
release:

- Android root ext: `NitroMapboxARMapboxVersion`
- iOS environment: `NITRO_MAPBOX_AR_MAPBOX_VERSION`

## Why a separate package?

The native Maps SDK is useful for full 2D/3D map UI, Standard/Standard
Satellite, annotations, offline packs, route overlays, and Mapbox's native
camera.

It is not required for the direct Terrain-RGB -> Graphite/WebGPU path.

Keeping it optional:

- reduces binary size for AR-only apps;
- prevents duplicate map abstractions in the hot terrain path;
- keeps the core package viable for visionOS/React Vision experiments even
  though Mapbox Maps for iOS is not our visionOS renderer;
- lets Android/iOS apps opt into Mapbox's full native UI when needed.

## API

`MapboxMaps` (root): `isMapViewAvailable`, `sdkVersion`, `capabilities`.

`MapboxMapView` (Nitro Hybrid View, raw `getHostComponent`). Props:
`styleUri`, `camera` (`CameraTarget`, jump on change), `projection`,
`enableGestures`. There is no `accessToken` prop: set
`MapboxAR.accessToken` from `@mikevocalz/nitro-mapbox-ar` before mounting.

Methods through `hybridRef`, all returning promises except listener
registration: `loadStyle` (resolves a `MapStyle`),
`createPointAnnotationManager`, `flyTo`, `easeTo`, `fitBounds`,
`getCameraState`, `queryRenderedFeatures`, and
`addOnCameraChangedListener` / `addOnMapTapListener` /
`addOnStyleLoadedListener` / `addOnMapLoadingErrorListener`, each returning
a `ListenerSubscription`.

`MapStyle` goes stale when the next style load starts. `PointAnnotationManager`
survives style reloads. The SDK symbol behind every member is listed in
`docs/MAPS_SDK_INVENTORY.md`.

On visionOS the pod builds without MapboxMaps: `isMapViewAvailable` is
`false` and every view method rejects.

## Code generation

Nitrogen output is generated during package `prepare` / `prepack`.
From the repo:

```sh
npm run codegen:native-map
```

The published package must include `nitrogen/generated`.

## Android setup

Mapbox's Maven repository requires a secret downloads token with
`DOWNLOADS:READ`.

Expose it as `MAPBOX_DOWNLOADS_TOKEN` in Gradle properties or the environment.
Do not ship that secret token in application code. The runtime `accessToken`
prop is the public Mapbox token.

## iOS setup

The current package uses Mapbox's CocoaPods distribution because React Native
autolinking still consumes a podspec here. Mapbox has announced that new iOS SDK
releases will stop being published to CocoaPods after **December 2026**.

Before that deadline, move this optional Apple package to a Swift Package
Manager-backed integration. The core Graphite/WebGPU/Viro path is unaffected.

## visionOS / React Vision

Do not compile this UIKit Mapbox package into the visionOS target.

For visionOS, keep using the core package's Graphite/WebGPU data/rendering
layers plus Viro/ReactVision's native Metal/CompositorServices renderer. This
separation is deliberate.
