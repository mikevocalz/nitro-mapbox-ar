# Nitro Mapbox AR

Mapbox terrain, maps, routing and AR placement for React Native on Nitro Modules, with a JS-only core for the web and Snap Spectacles.

> Status: `0.1.0-alpha.0`, unreleased pre-release. The API follows [docs/API_DESIGN.md](docs/API_DESIGN.md). Nothing has been published to npm yet, and device performance has not been measured ([docs/PERFORMANCE.md](docs/PERFORMANCE.md)).

This repository started as Mapbox's 2018 React Native AR SDK. The 2018 runtime is gone from the tree; [docs/LEGACY_2018.md](docs/LEGACY_2018.md) maps it to the code that replaced it, and [docs/MIGRATION.md](docs/MIGRATION.md) covers the move.

## Packages

| Package | What it is | Native code |
| --- | --- | --- |
| `@mikevocalz/nitro-mapbox-ar` | Core. The `MapboxAR` root (process-wide access token, Terrain-RGB decode), the Graphite/WebGPU/TypeGPU terrain renderer, routing, search and the spatial agent runtime | C++ HybridObject (iOS, Android) |
| `@mikevocalz/nitro-mapbox-ar/core` | Subpath of the core package: plain ESM with no React Native, Nitro, Skia or WebGPU imports. Routing, search, tile maths, a JS Terrain-RGB decoder | none |
| `@mikevocalz/nitro-mapbox-ar-maps` | Mapbox Maps SDK 11.32.0 as a Nitro Hybrid View: `MapboxMapView`, `MapStyle`, point annotations, rendered-feature queries | Swift, Kotlin |
| `@mikevocalz/nitro-mapbox-ar-navigation` | Mapbox Navigation SDK 3.32.0: `MapboxNavigation.createTripSession()` for turn-by-turn progress, rerouting, electronic horizon and replayed drives | Swift, Kotlin |
| `@mikevocalz/nitro-mapbox-ar-reactvision` | ReactVision/Viro 3.x adapter: host capabilities, WGS84 to ENU projection, route, chevron, building and ground components | none (JS over Viro) |
| `@mikevocalz/nitro-mapbox-ar-specs` | Snap Spectacles Navigation Kit adapter for Lens Studio TypeScript, built on the `/core` entry | none |
| `@mikevocalz/nitro-mapbox-ar-agent-mcp` | Configuration helpers for Mapbox MCP servers in development tools and server-side agents | none |

Install only what you use. An AR-only app does not need the maps or navigation packages and does not carry the Maps SDK.

## Install

```sh
npm install @mikevocalz/nitro-mapbox-ar@0.1.0-alpha.0 react-native-nitro-modules@0.37.1
# optional
npm install @mikevocalz/nitro-mapbox-ar-maps@0.1.0-alpha.0
npm install @mikevocalz/nitro-mapbox-ar-navigation@0.1.0-alpha.0
npm install @mikevocalz/nitro-mapbox-ar-reactvision@0.1.0-alpha.0 @reactvision/react-viro@3.0.3
```

The core package's peers: React 19, React Native 0.86+, `react-native-nitro-modules` 0.37.x, `@shopify/react-native-skia` 2.12+, `react-native-webgpu` 0.13+, `typegpu` 0.12.x, `react-native-reanimated` 4.2+, `react-native-worklets` 0.7+. The ReactVision package pins React Native to 0.86.x until Viro widens its own range. Native packages need a dev client or a bare app; they do not run in Expo Go.

## Access tokens

Two different tokens are involved.

**Runtime token (public, `pk.`).** Set it once per process, before mounting a map or starting a trip session:

```ts
import { MapboxAR } from '@mikevocalz/nitro-mapbox-ar'

MapboxAR.accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ''
```

The maps view and navigation trip sessions read it from there; there is no per-view token. Work that needs a token and finds it empty rejects with an `Error` whose message starts `Mapbox access token is not set` and names the operation. The JS clients (`MapboxNavigationClient`, `MapboxSearchClient`, and everything in `/core`) take `accessToken` in their constructor options instead, because `/core` has no native root.

**Android build token (secret, `DOWNLOADS:READ` scope).** The maps and navigation packages pull their AARs from Mapbox's Maven repository, which needs a secret token at build time. Put it in `~/.gradle/gradle.properties` or the environment as `MAPBOX_DOWNLOADS_TOKEN`. Never ship it in app code or commit it. iOS needs no build token: the maps package uses the `MapboxMaps` CocoaPod and navigation links `MapboxNavigationCore` through Swift Package Manager.

## Quick look

```tsx
import { callback } from 'react-native-nitro-modules'
import { MapboxMaps, MapboxMapView, MapStyles } from '@mikevocalz/nitro-mapbox-ar-maps'

if (MapboxMaps.isMapViewAvailable) {
  return (
    <MapboxMapView
      style={{ flex: 1 }}
      styleUri={MapStyles.standardSatellite}
      camera={{ center: { latitude: 40.758, longitude: -73.9855 }, zoom: 14 }}
      hybridRef={callback((map) => {
        const sub = map.addOnStyleLoadedListener(async (style) => {
          if (!MapboxMaps.capabilities.supportsTerrain) return
          await style.addRasterDemSource({ id: 'dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1' })
          await style.setTerrain({ sourceId: 'dem', exaggeration: 1.4 })
        })
        // keep `sub` and call sub.remove() on unmount
      })}
    />
  )
}
```

Every map method returns a Promise because the Maps SDK runs on the UI thread. Full call sites, including error and cleanup paths, are in [docs/API_DESIGN.md](docs/API_DESIGN.md).

## Platforms

| | iOS | Android | Meta Quest (Horizon OS) | visionOS | Web | Lens Studio (Spectacles) |
| --- | --- | --- | --- | --- | --- | --- |
| Core: `MapboxAR`, terrain decode | yes | yes | yes (Android build) | yes | `index.web.ts`: JS root, `RangeError` on bad input | `/core` JS decoder |
| Terrain renderer (`'auto'`) | Graphite, WebGPU, then Nitro CPU | Graphite, WebGPU, then Nitro CPU | Graphite, WebGPU, then Nitro CPU | WebGPU, then Nitro CPU (`isGraphiteAvailable` is `false`) | browser WebGPU, then JS CPU | no |
| Routing and search clients | yes | yes | yes | yes | yes | yes, with an injected `fetch` |
| Maps (`MapboxMapView`) | 11.32.0 | 11.32.0 | 11.32.0 in a 2D panel or `SpatialWindow`; no location puck without location hardware | **not available**: `MapboxMaps.isMapViewAvailable` is `false`, the MapboxMaps pod declares iOS only | no | no |
| Navigation (`TripSession`) | 3.32.0 | 3.32.0 | Android build, not run on a headset yet; no GPS, so use `locationSource: 'replay-primary-route'` | no (iOS-only podspec) | no | no |
| ReactVision adapter | camera AR, geospatial anchors | camera AR, geospatial anchors | passthrough tabletop; `hasDeviceLocation` is `false`, so no geospatial anchors | immersive scene via `ViroScene`; route drawn as dots | no | no |
| Specs adapter | no | no | no | no | no | yes |

Capabilities are reported at runtime, never inferred from the platform name: `MapboxMaps.capabilities`, `MapboxNavigation.capabilities`, and `getSpatialHostCapabilities()` from the ReactVision package. Code against those fields.

Quest and visionOS rows describe what the code does. The reference app has not been profiled on a Quest 3, iPhone or Pixel yet.

## Reference app

`examples/reference-app` (Expo SDK 57, React Native 0.86) has five tabs: Map, Navigate, AR, Table (a tabletop route that runs over passthrough on Quest) and Agent. Setup and build flavours are in [docs/REFERENCE_APP.md](docs/REFERENCE_APP.md); the [accessibility review](docs/reference-app/A11Y.md) and [design critique](docs/reference-app/CRITIQUE.md) are in `docs/reference-app/`.

## Development

```sh
npm install
npm run tooling:install
npm run check:all
```

`check:all` typechecks every workspace and the API sketch, runs the JS and C++ tests, builds `/core`, checks that `/core` imports nothing native, checks Nitrogen output is committed, lints, checks the npm tarballs, and builds the API reference with TypeDoc (warnings fail the build, undocumented exports included).

Further reading: [architecture](docs/ARCHITECTURE.md), [Nitro](docs/NITRO.md), [Graphite](docs/GRAPHITE.md), [terrain rendering](docs/TERRAIN_RENDERING.md), [Maps SDK inventory](docs/MAPS_SDK_INVENTORY.md), [native navigation](docs/NATIVE_NAVIGATION.md), [testing](docs/TESTING.md), [release](docs/RELEASE.md), [changelog](CHANGELOG.md).

## History

The repository began as the Mapbox Augmented Reality SDK for React Native beta in 2018, written at Mapbox by Nick Italiano with Dave Prukop.

## License

MIT
