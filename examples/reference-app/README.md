# Nitro Mapbox AR reference app

This replaces the 2018 `RNMapboxARDemo` as the modernization testbed.

## Why Expo 57

The current ReactVision adapter targets React Native 0.86. Expo SDK 57 is the
stable Expo release on RN 0.86. SDK 58 beta is RN 0.88, so the reference app
does not jump to it until the ReactVision peer range is validated there.

## Modes

- **Map** — optional Nitro HybridView backed by Mapbox Maps SDK v11.
- **Navigate** — traffic-aware Directions API route planning.
- **AR** — ReactVision/Viro scene entry.
- **Table** — Times Square to Brooklyn Bridge as a miniature on a table, with
  the Mapbox map in a `SpatialWindow` beside it. The route is drawn the same
  way on every host. A "you are here" dot appears only when
  `SpatialHostCapabilities` reports device location and geospatial anchors;
  on Meta Quest both are `false`, so the app never asks Viro for a
  geospatial camera pose there.
- **Agent** — permissioned SpatialAgentRuntime using direct Mapbox Search.

## Run

1. Copy `.env.example` to `.env.local` and add a public Mapbox token.
2. `npm install`
3. `npx expo prebuild --clean`
4. `npm run ios`, `npm run mobile` (Android phone) or `npm run quest`
   (Meta Quest)

Use a development/native build. Expo Go cannot load Nitro native modules.

## Meta Quest

`expo-horizon-core` adds `mobile` and `quest` product flavors, so there is no
plain `debug` variant: `npm run android` runs `mobileDebug`, and
`npm run quest` runs `questDebug`. Install only the `quest` variant on a
headset.

`plugins/withMetaVR.js` survives `expo prebuild --clean` and does two things:

- adds `com.meta.metavrx:metavrx-bom:1.2026.0.0` to `android/app/build.gradle`
  for the `@metavr/layout-compat` and `@metavr/layout-window-compat` AARs;
- writes `android/app/src/mobile/AndroidManifest.xml`, which removes the
  Quest-only features, permissions, `VRActivity` and
  `com.oculus.supportedDevices` that Viro's plugin puts in the main manifest.

Both the Horizon and Viro plugins get the same `supportedDevices` string,
because the manifest merger rejects two different values for
`com.oculus.supportedDevices`.

## visionOS

`@reactvision/react-native-visionos` 0.86.4 is installed alongside
`react-native`. Create the `visionos/` folder once, before prebuild:

```bash
npx @react-native-community/cli@latest init NitroMapboxAR \
  --template github:ReactVision/visionos-template \
  --directory .visionos-template --skip-install
mv .visionos-template/visionos ./visionos && rm -rf .visionos-template
npx expo prebuild
cd visionos && pod install
```

The template's Podfile pins `platform :visionos, '26.0'`, which ViroReactUI
requires; Viro's `withViroVisionOS` plugin raises an older Podfile to 26.0.

The Mapbox map is not available on visionOS. CocoaPods' MapboxMaps 11.32.0
spec declares iOS only, so the visionOS Podfile skips the maps package and
the Map tab shows a notice. Skia is skipped the same way, so
`isGraphiteWebGPUAvailable()` returns `false` and the renderer resolves to
`webgpu`.
