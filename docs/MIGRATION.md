# Migration

Two moves are covered here: from the `@mapbox/react-native-mapbox-ar*` packages (the revival before the modernization, and the 2018 SDK before it) to `@mikevocalz/nitro-mapbox-ar*` `0.1.0`, and the API breaks inside that move. The removed 2018 code is in Git history; [LEGACY_2018.md](LEGACY_2018.md) maps it to its replacements.

## Package names

| Before | After |
| --- | --- |
| `@mapbox/react-native-mapbox-ar` | `@mikevocalz/nitro-mapbox-ar` |
| `@mapbox/react-native-mapbox-ar-native-map` | `@mikevocalz/nitro-mapbox-ar-maps` |
| `@mapbox/react-native-mapbox-ar-reactvision` | `@mikevocalz/nitro-mapbox-ar-reactvision` |
| `@mapbox/react-native-mapbox-ar-agent-mcp` | `@mikevocalz/nitro-mapbox-ar-agent-mcp` |
| none | `@mikevocalz/nitro-mapbox-ar-navigation` (new: Navigation SDK trip sessions) |
| none | `@mikevocalz/nitro-mapbox-ar-specs` (new: Spectacles Navigation Kit adapter) |
| none | `@mikevocalz/nitro-mapbox-ar/core` (new subpath: JS-only entry) |

None of the `@mapbox/react-native-mapbox-ar*` names were published from this repository. Replace the imports and the `package.json` entries; there is no compatibility re-export.

## Breaking changes

### Access token: one process-wide value

Before, the core had four token methods on a lazily created native object, and the map view took a token prop:

```ts
import { getMapboxARCore } from '@mapbox/react-native-mapbox-ar'

const core = getMapboxARCore()
core.setAccessToken(token)
core.assertAccessToken()

<MapboxMapView accessToken={token} styleURI="..." camera={camera} />
```

After, `MapboxAR` is a constant and the token is a writable property. The maps view and navigation trip sessions read it; there is no per-view token.

```ts
import { MapboxAR } from '@mikevocalz/nitro-mapbox-ar'

MapboxAR.accessToken = token

<MapboxMapView styleUri={MapStyles.standard} camera={target} />
```

| Removed | Use |
| --- | --- |
| `getMapboxARCore()` | the `MapboxAR` constant |
| `setAccessToken(t)` / `getAccessToken()` | assign / read `MapboxAR.accessToken` |
| `hasAccessToken()` | `MapboxAR.accessToken !== ''` |
| `assertAccessToken()` | nothing: the operation that needs the token rejects with `Mapbox access token is not set (<operation>)` |
| `MapboxMapView` `accessToken` prop | `MapboxAR.accessToken` |

The JS clients (`MapboxNavigationClient`, `MapboxSearchClient`, the raster and vector clients) still take `accessToken` in their options, as before.

### Terrain-RGB decode

`decodeTerrainRgb(rgba, heightModifier)` keeps its signature and output. Inputs above 1 MiB (one 512 × 512 tile) now throw and name the new `decodeTerrainRgbAsync`, which decodes on a C++ worker queue. On native the error is an `Error` (Nitro rethrows C++ exceptions as `jsi::JSError`, prefixed with the method name); on web it is a `RangeError`. Match on the message, not the class.

### Maps: every method is async

| Before (`MapboxMapViewMethods`) | After |
| --- | --- |
| `getCamera(): MapCamera` (sync) | `getCameraState(): Promise<CameraState>` |
| `setCamera(camera): void` | the `camera` prop (jump), or `flyTo` / `easeTo` / `fitBounds`, each `Promise<CameraAnimationEnd>` |
| `loadStyle(styleURI): void` | `loadStyle(uri): Promise<MapStyle>`, resolved once the style has loaded |
| `styleURI` prop, with `'standard'` / `'standard-satellite'` aliases | `styleUri` prop taking a full URI; presets in `MapStyles` (`MapStyles.standard`, `MapStyles.standardSatellite`) |
| `MapCamera { latitude, longitude, zoom, bearing, pitch }` | `CameraTarget { center?: { latitude, longitude }, zoom?, bearingDeg?, pitchDeg?, padding? }` for requests, `CameraState` for what rendered |
| `MapboxMapViewHybrid` type | `MapboxMapViewSpec` |

The Maps SDK runs on the UI thread, so a sync `getCamera()` hid a thread hop. Code that read the camera synchronously now awaits it, or subscribes with `addOnCameraChangedListener` and removes the returned subscription on unmount.

Sources, layers, terrain and Standard style config live on the `MapStyle` handle that `loadStyle` and `addOnStyleLoadedListener` give you. A handle from an earlier style rejects with `This MapStyle was replaced`; re-add sources in the style-loaded listener.

### Maps: capabilities live on the root

`MapCapabilities` is read from `MapboxMaps.capabilities`, not from a mounted view. Check `MapboxMaps.isMapViewAvailable` before mounting: it is `false` on visionOS, where the Maps SDK does not link.

### ReactVision: host capabilities replace the platform model

| Removed | Use |
| --- | --- |
| `ReactVisionPlatform` (`'ios' \| 'android' \| 'quest' \| 'visionos' \| 'web'`) | nothing for the local device; read capabilities instead. A remote peer's platform is `ColocationPeer.platform`, an open `string` |
| `ReactVisionRuntimeCapabilities` | `SpatialHostCapabilities` |
| `normalizeReactVisionCapabilities({ platform, ... })` | `await getSpatialHostCapabilities(createViroSpatialHostProbe({ navigator, hasDeviceLocation, isGraphiteAvailable }))` |
| `graphiteOnVisionOS` | `isGraphiteAvailable`, reported by the renderer probe on every host |
| `canShareColocationFrame(platformA, platformB)` | `canShareColocationFrame(peerA, peerB)` taking `ColocationPeer { peerId, platform }`; throws `TypeError` on an empty platform |

Field renames on the capability struct:

| `ReactVisionRuntimeCapabilities` | `SpatialHostCapabilities` |
| --- | --- |
| `immersive` | `isImmersive` |
| `mixedReality` | `supportsPassthrough` |
| `geospatialAnchors` | `supportsGeospatialAnchors` (now `false` whenever `hasDeviceLocation` is `false`) |
| `vps` | `supportsVps` |
| `colocation` | `supportsColocation` |
| `replicatedState` | `supportsReplicatedState` |
| `gaze` | `supportsGaze` |
| `graphiteOnVisionOS` | `isGraphiteAvailable` |
| `webRenderer` | removed; renderer selection (`selectRendererBackend`) covers it |
| `platform` | removed |
| none | `hasDeviceLocation` (new; `false` on Meta Quest) |

The old function guessed every flag from the platform name. The new one asks the host, so Quest's missing GPS and visionOS's missing Graphite come from the device.

### Navigation

`NavigationSession` and `MapboxNavigationClient` keep their API. Three additions:

- `MapboxNavigationClient.directionsWithRequestUrl()` returns the response and the request URL, which `TripSession.setRoutes` needs. The URL contains the access token; do not log it.
- The client `fetchImpl` option accepts any `FetchLike`, not only `typeof fetch`, so Lens Studio's fetch module fits.
- Native guidance is the separate `@mikevocalz/nitro-mapbox-ar-navigation` package. `createNativeNavigationProvider(MapboxNavigation, options, onError?)` returns a `NativeNavigationProvider` backed by a trip session, so `NavigationSession` can use native guidance through its existing `nativeProvider` option.

## From the 2018 SDK

| 2018 | Now |
| --- | --- |
| React Native 0.50, `NativeModules.MapboxARModule` | React Native 0.86+, Nitro Modules (`MapboxAR` C++ HybridObject) |
| `react-viro` 2.5 | `@reactvision/react-viro` 3.x through the optional ReactVision package |
| Mapbox v4 raster URLs | current Raster Tiles, Search Box, Geocoding v6, Directions and Map Matching |
| Objective-C / Java terrain generators | Terrain-RGB decoded on the GPU (TypeGPU) or in C++ |
| `Terrain-RGB → Bitmap stitch → CPU geometry → OBJ → filesystem → Viro OBJ parser` | `pngraw → Skia Graphite decode → shared Dawn texture → TypeGPU height field → direct WebGPU draw` |

There is no OBJ or filesystem round trip in the current terrain path. The browser entry excludes Nitro and Graphite: native falls back Graphite/WebGPU → WebGPU → Nitro C++ CPU, web falls back browser WebGPU → JS CPU.
