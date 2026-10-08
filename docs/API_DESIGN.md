# API design: nitro-mapbox-ar modernization, Phase 2

Status: **approved 2026-10-08** with the decisions recorded in section 11. Written 2026-10-08 on `feat/modernization-v1`, against master `addbca6` (PR #35, provider-neutral `RouteLeg` / `RouteStep` / `NavigationManeuver`), not the pack's `b29503b`.

| Package | Root | Native |
| --- | --- | --- |
| `@mikevocalz/nitro-mapbox-ar` | `MapboxAR` | C++ (iOS + Android) |
| `@mikevocalz/nitro-mapbox-ar` `/core` entry | none (plain functions and classes) | none |
| `@mikevocalz/nitro-mapbox-ar-maps` | `MapboxMaps` + `MapboxMapView` host component | Swift / Kotlin over Mapbox Maps SDK |
| `@mikevocalz/nitro-mapbox-ar-navigation` | `MapboxNavigation` | Swift / Kotlin over Mapbox Navigation SDK |
| `@mikevocalz/nitro-mapbox-ar-reactvision` | `getSpatialHostCapabilities` | none (JS over Viro) |
| `@mikevocalz/nitro-mapbox-ar-agent-mcp` | unchanged by this phase | none |

The public types live as a typechecked sketch in `tests/api-sketch/`, one file per type or HybridObject, split the way the `.nitro.ts` files will be split in Phase 3–5. Every example below is copied from `tests/api-sketch/call-sites.ts`; `tests/api-sketch/negative.ts` holds 22 `@ts-expect-error` fixtures for uses that must not compile.

```sh
npx tsc --noEmit -p tests/api-sketch/tsconfig.json   # exit 0 on 2026-10-08
```

The sketch imports the real `src/navigation/*` types (`RouteLeg`, `NavigationManeuver`, `GeographicCoordinate`, `NavigationProgressSnapshot`, `ElectronicHorizonSnapshot`, `NativeNavigationCapabilities`) so reuse is checked by the compiler, not asserted.

## 1. Handle graph

```
MapboxAR (root, C++)            accessToken  ──read by──►  maps view, trip sessions
  ├─ decodeTerrainRgb()        sync, one tile
  └─ decodeTerrainRgbAsync()   worker queue

MapboxMaps (root)               isMapViewAvailable, sdkVersion
<MapboxMapView hybridRef>       one per mounted view
  ├─ capabilities: MapCapabilities             (struct, readonly)
  ├─ loadStyle() ──────────► MapStyle          (replaced on every style load)
  ├─ addOnStyleLoadedListener ─► MapStyle
  ├─ createPointAnnotationManager() ─► PointAnnotationManager  (until removeFromMap)
  ├─ queryRenderedFeatures() ─► RenderedFeature[]              (lazy GeoJSON)
  ├─ flyTo / easeTo / fitBounds ─► CameraAnimationEnd
  └─ addOn*Listener ─► ListenerSubscription { remove }

MapboxNavigation (root)         capabilities: NativeNavigationCapabilities
  └─ createTripSession() ──► TripSession       (one active; ends at stop())
        ├─ setRoutes(NavigationRoutesInput)
        ├─ addOnProgress / Reroute / ErrorListener ─► ListenerSubscription
        └─ getElectronicHorizon() ─► ElectronicHorizonSnapshot | undefined

getSpatialHostCapabilities(probe) ─► SpatialHostCapabilities (struct)
ColocationPeer { peerId, platform }  ─► canShareColocationFrame(a, b)
```

Every arrow that points at a HybridObject is the only way to get one. Commands that need a loaded style live on `MapStyle`; commands that need a running trip live on `TripSession`. Neither parent carries "maybe ready" methods.

## 2. `MapboxAR` root

Sketch: `tests/api-sketch/core/MapboxAR.nitro.ts`, `core/index.ts`.

```ts
export interface MapboxAR extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  accessToken: string
  decodeTerrainRgb(rgba: ArrayBuffer, heightModifier: number): ArrayBuffer
  decodeTerrainRgbAsync(rgba: ArrayBuffer, heightModifier: number): Promise<ArrayBuffer>
}
export const MapboxAR = NitroModules.createHybridObject<MapboxAR>('MapboxAR')
```

| Member | Kind | Sync / async | Reason |
| --- | --- | --- | --- |
| `MapboxAR` | HybridObject, root, default-constructible | n/a | Holds process state (the token) and owns a worker queue; autolinked so JS can construct it |
| `accessToken` | writable property | sync | Assigning is the command; storing a string is cheap and cannot fail. Replaces `setAccessToken` / `getAccessToken` / `hasAccessToken` / `assertAccessToken` |
| `decodeTerrainRgb` | method | sync | One 512² tile is 1 MiB in, 1 MiB out of arithmetic on the calling thread. Inputs above 1 MiB throw and point to the async form |
| `decodeTerrainRgbAsync` | method | `Promise` | Stitched regions block the JS thread; runs on a queue the C++ core owns, crossing threads once |

Results stay `ArrayBuffer`: the caller wraps them in `Float32Array` and hands them to GPU upload or the mesh builder, so byte access is the contract.

**Lifecycle.** One instance per JS runtime, never disposed. No handles.

**Errors (`@throws`).**

- `decodeTerrainRgb`: `Error` when `byteLength % 4 !== 0`, when `byteLength > 1048576` (message names `decodeTerrainRgbAsync`), when `heightModifier` is not finite. Message text matches today's C++ (`Terrain-RGB input must contain exactly 4 bytes per pixel`, `heightModifier must be finite`).
- `decodeTerrainRgbAsync`: rejects for the same input errors, no size limit.
- Missing token: `MapboxAR` itself needs no token. Native work that does (map style loads, `createTripSession`) rejects with a message starting `Mapbox access token is not set` and naming the operation. Errors are plain `Error`: Nitro does not carry JS subclasses across the boundary, so the stable part is the message prefix.

**Native symbol.** No Mapbox SDK symbol. It wraps `terrain::decodeTerrainRgb` in `cpp/TerrainRgbCodec.hpp` (already tested by `tests/terrain-rgb-codec.cpp`); the C++ class will inherit the generated `HybridMapboxARSpec` instead of today's hand-written `loadHybridMethods()` in `cpp/HybridMapboxARCore.cpp`. The token reaches the Mapbox SDKs through `MapboxOptions.accessToken`, which the repo already sets in `packages/native-mapbox/ios/HybridMapboxMapView.swift:18,73` and `packages/native-mapbox/android/src/main/java/com/margelo/nitro/mapboxar/nativemap/HybridMapboxMapView.kt:35,103`. `MapboxOptions` is defined in MapboxCommon, which is not installed locally (only MapboxMaps 11.3.0 sources are; see section 9).

**Migration.** `getMapboxARCore()` (lazy singleton with `??=` in `src/native/MapboxARCore.ts`) becomes the `MapboxAR` constant. `setAccessToken(t)` becomes `MapboxAR.accessToken = t`; `assertAccessToken()` is dropped in favour of the failing operation naming the missing token.

Happy path:

```ts
MapboxAR.accessToken = MAPBOX_TOKEN

// One 512 x 512 tile: decode on the JS thread.
const tileHeights = new Float32Array(MapboxAR.decodeTerrainRgb(tileRgba, 1))
drawHeights(tileHeights)

// A stitched region: decode off the JS thread.
const regionHeights = await MapboxAR.decodeTerrainRgbAsync(regionRgba, 1)
drawHeights(new Float32Array(regionHeights))
```

Unavailable capability (no Nitro runtime):

```ts
// Web harness or Lens Studio: no Nitro runtime, so no MapboxAR root.
// The `core` entry decodes in JS with the same contract.
const heights = new Float32Array(decodeTerrainRgb(tileRgba, 1))
drawHeights(heights)
```

Invalid input and cleanup:

```ts
const truncated = tileRgba.slice(0, tileRgba.byteLength - 1)
try {
  MapboxAR.decodeTerrainRgb(truncated, 1)
} catch (error) {
  // "Terrain-RGB input must contain exactly 4 bytes per pixel"
  console.warn((error as Error).message)
}

// Sign-out: clear the token. Native maps and trip sessions created after
// this reject with "Mapbox access token is not set".
MapboxAR.accessToken = ''
```

## 3. Maps: `MapboxMaps`, `MapboxMapView`, `MapStyle`, `PointAnnotationManager`

Sketch: `tests/api-sketch/maps/*`. One `.nitro.ts` per HybridObject; every struct and literal union in its own `.ts`.

### Objects

| Type | Struct or HybridObject | Why |
| --- | --- | --- |
| `MapboxMaps` | HybridObject, root | Reports `isMapViewAvailable` before a view is mounted (visionOS has no Maps SDK slice unless 11.32.0 ships one) |
| `MapboxMapView` | Hybrid View (`getHostComponent`, raw) | Owns the native `MapView`; props for declarative state, methods via `hybridRef` |
| `MapStyle` | HybridObject | Bound to one loaded style; becomes stale on the next style load. Holding it as a handle stops calls landing on a style the caller never saw |
| `PointAnnotationManager` | HybridObject | Owns a native annotation layer until `removeFromMap()` |
| `RenderedFeature` | HybridObject | Query results can be hundreds of features with large geometry; `toGeoJson()` serialises only the ones the caller reads |
| `MapCapabilities`, `CameraState`, `CameraTarget`, `EdgeInsets`, `CoordinateBounds`, `FitBoundsOptions`, `CameraAnimationOptions`, `MapTapEvent`, `ScreenPoint`, `ScreenBox`, `RenderedFeatureQuery`, `GeoJsonSource`, `RasterDemSource`, `VectorSource`, `StyleLayer`, `TerrainOptions`, `StandardStyleConfig`, `PointAnnotation` | structs | Small immutable values, cheap to convert eagerly |
| `MapProjection`, `CameraAnimationEnd`, `StyleLayerType`, `StandardLightPreset` | string literal unions | Closed sets |
| `ListenerSubscription` | struct with `remove: () => void` | Per the Nitro skill: flat struct, not a HybridObject |

### Props

| Prop | Type | Notes |
| --- | --- | --- |
| `styleUri` | `string` | Loaded on mount and on change; fires `addOnStyleLoadedListener`. Presets in `MapStyles` (`as const satisfies Record<string, string>`) |
| `camera?` | `CameraTarget` | Jump on mount and on change. The map never writes back; live camera via `getCameraState()` / `addOnCameraChangedListener` |
| `projection?` | `MapProjection` | Omitted means the style's projection |
| `enableGestures?` | `boolean` | Default `true` |

There is no `accessToken` prop. The pack listed one; this design deviates (open question 1): the SDK token is process-wide (`MapboxOptions.accessToken`), so a per-view prop would be a second source of truth that silently overwrites the first. The view reads `MapboxAR.accessToken`.

`styleURI` is renamed `styleUri` (acronym casing that matches `requestUrl` elsewhere). The `'standard'` / `'standard-satellite'` aliases resolved in today's Swift/Kotlin `resolvedStyleURI` are dropped; callers pass full URIs or `MapStyles.*`.

### Methods, sync vs async

Every method that touches the native map is `async`. Mapbox Maps on iOS and Android is bound to the UI thread, and Nitro view methods run on the JS thread, so a sync `getCamera()` would hide a thread hop (today's `getCamera()` does exactly that). The exceptions:

| Member | Sync | Reason |
| --- | --- | --- |
| `capabilities` | readonly property | Resolved once when the view is created; reading it is a field load |
| `addOn*Listener` | sync, returns `ListenerSubscription` | Registration only appends to a JS-thread list; the native side subscribes to the SDK signal once and multiplexes |

| Method | Returns | Wraps |
| --- | --- | --- |
| `loadStyle(uri)` | `Promise<MapStyle>` | resolves after the style-loaded event, so the handle is ready by construction |
| `createPointAnnotationManager()` | `Promise<PointAnnotationManager>` | |
| `flyTo` / `easeTo(target, options?)` | `Promise<CameraAnimationEnd>` | resolves from the SDK's animation completion; `interrupted` is a normal outcome, not a rejection |
| `fitBounds(bounds, options?)` | `Promise<CameraAnimationEnd>` | camera-for-coordinates, then ease |
| `getCameraState()` | `Promise<CameraState>` | |
| `queryRenderedFeatures(query)` | `Promise<RenderedFeature[]>` | the SDK API is callback-based already |
| `addOnCameraChangedListener`, `addOnMapTapListener`, `addOnStyleLoadedListener`, `addOnMapLoadingErrorListener` | `ListenerSubscription` | |

`MapStyle`: `addGeoJsonSource`, `setGeoJsonSourceData`, `addRasterDemSource`, `addVectorSource`, `removeSource`, `addLayer(layer, belowLayerId?)`, `removeLayer`, `setTerrain({ sourceId, exaggeration? })`, `clearTerrain`, `setStandardConfig(config)`, all `Promise<void>`, plus `readonly uri`. `PointAnnotationManager`: `readonly id`, `setAnnotations`, `addOnAnnotationTapListener`, `removeFromMap`.

The pack's single `addSource(source)` became one method per source kind. While sketching, nitrogen 0.37.1 (`node_modules/nitrogen/src/syntax/createType.ts`) was read: a field typed as a single string literal (`type: 'geojson'`) throws `String literal ... cannot be represented in C++`, and a variant of structs is told apart by shape, which cannot separate `{ id, url }` raster DEM from `{ id, url }` vector. Separate methods need neither.

### Lifecycle

```
mount ──► view created ──(token set, SDK available)──► native MapView
                     └─(no token / SDK missing)──► map loading error listener; methods reject

styleUri change or loadStyle() ──► style A loaded ──► MapStyle(A)
                                   style B loaded ──► MapStyle(B); MapStyle(A) rejects "This MapStyle was replaced"
                                   sources / layers / terrain from A are gone; re-add in addOnStyleLoadedListener

createPointAnnotationManager() ──► manager (survives style reloads) ──removeFromMap()──► every method rejects
unmount ──► managers, styles, subscriptions released; pending promises reject
```

### Error contract

| Call | Rejects when |
| --- | --- |
| any map method before the native map exists | message names the cause: `Mapbox access token is not set (MapboxMapView.loadStyle)` or `Mapbox Maps SDK is unavailable on this platform` |
| `loadStyle` | malformed URI; HTTP failure (status in message); `Style load superseded` when another load starts first |
| `flyTo` / `easeTo` / `fitBounds` | non-finite numbers, coordinates outside WGS84, negative `durationMs`, `southwest.latitude > northeast.latitude` |
| `queryRenderedFeatures` | area outside the view, inverted box, empty `layerIds`, unknown layer id |
| `MapStyle.*` | stale handle; duplicate id; unknown source/layer/`belowLayerId`; GeoJSON parse failure; `exaggeration` outside 0–1000; `setTerrain` when `capabilities.supportsTerrain` is false; `setStandardConfig` on a style without that import (message suggests `MapStyles.standard`) |
| `PointAnnotationManager.setAnnotations` | duplicate annotation id; coordinate outside WGS84; manager removed |

Asynchronous failures with no pending call (tile, sprite, glyph, source loads) go to `addOnMapLoadingErrorListener`; nothing is logged and dropped.

### Native symbols

iOS symbols below were read from **MapboxMaps 11.3.0** sources, the only copy on this machine: `~/whatsupps/apps/expo/ios/Pods/MapboxMaps/Sources/MapboxMaps/` (another project's Pods; Podfile.lock pins `MapboxMaps (11.3.0)`). The target is 11.32.0, so each must be re-checked in Phase 4 and written to `docs/MAPS_SDK_INVENTORY.md`. Paths are relative to that folder.

| API | iOS symbol (11.3.0) |
| --- | --- |
| view, managers | `MapView.mapboxMap`, `.camera`, `.gestures`, `.location`, `.annotations`, `.viewport` (`Foundation/MapView.swift:16,29,23,33,36,46`) |
| style handle | `public final class MapboxMap: StyleManager` (`Foundation/MapboxMap.swift:164`); `StyleManager.mapStyle` (`Style/StyleManager.swift:416`) |
| `addGeoJsonSource` / `addRasterDemSource` / `addVectorSource` | `StyleManager.addSource(_:dataId:)` (`Style/StyleManager.swift:247`), `addSource(withId:properties:)` (`:820`) |
| `removeSource` | `StyleManager.removeSource(withId:)` (`:830`) |
| `addLayer` | `StyleManager.addLayer(with:layerPosition:)` (`:615`), `addLayer(_:layerPosition:)` (`:88`) |
| `removeLayer` | `StyleManager.removeLayer(withId:)` (`:693`) |
| `setTerrain` | `StyleManager.setTerrain(_:)` (`:1137`), `public struct Terrain` (`Style/Generated/Terrain.swift:8`, fields `source`, `exaggeration`) |
| `setStandardConfig` | `StyleManager.setStyleImportConfigProperties(for:configs:)` (`:579`) |
| `projection` prop | `StyleManager.setProjection(_:)` (`:1473`); `StyleProjectionName.mercator` / `.globe` (`Style/Generated/Properties/Properties.swift:591,594`) |
| `MapStyles.standard` | `StyleURI.standard = "mapbox://styles/mapbox/standard"` (`Style/StyleURI.swift:56`). `standardSatellite` is not in 11.3.0; the repo already uses `.standardSatellite` (`packages/native-mapbox/ios/HybridMapboxMapView.swift:127`) against its 11.31.1 pin |
| `flyTo` / `easeTo` | `CameraAnimationsManager.fly(to:duration:curve:completion:)` (`Camera/CameraAnimationsManager.swift:41`), `ease(to:duration:curve:completion:)` (`:61`); `cancelAnimations()` (`:21`) |
| `fitBounds` | `MapboxMap.camera(for:padding:bearing:pitch:...)` overloads (`Foundation/MapboxMap.swift:516,549,570`) |
| `getCameraState` | `MapboxMap.cameraState` (`Foundation/MapboxMap.swift:763`), `struct CameraState` (`Foundation/CameraState.swift:5`) |
| `addOnCameraChangedListener` | `MapboxMap.onCameraChanged: Signal<CameraChanged>` (`:1098`) |
| `addOnStyleLoadedListener` | `MapboxMap.onStyleLoaded` (`:1082`) |
| `addOnMapLoadingErrorListener` | `MapboxMap.onMapLoadingError` (`:1076`) |
| `addOnMapTapListener` | `GestureManager.onMapTap: Signal<MapContentGestureContext>` (`Gestures/GestureManager.swift:110`) |
| `queryRenderedFeatures` | `MapboxMap.queryRenderedFeatures(with: CGPoint / CGRect, options:completion:)` (`Foundation/MapboxMap.swift:967,953`) |
| `createPointAnnotationManager` | `AnnotationOrchestrator.makePointAnnotationManager(id:layerPosition:clusterOptions:...)` (`Annotations/AnnotationOrchestrator.swift:80`) |
| `removeFromMap` | `AnnotationOrchestrator.removeAnnotationManager(withId:)` (`:139`) |
| `setAnnotations` | `PointAnnotationManager.annotations` (`Annotations/Generated/PointAnnotationManager.swift:23`), `PointAnnotation.init(id:coordinate:...)` (`Annotations/Generated/PointAnnotation.swift:152`) |
| `addOnAnnotationTapListener` | `PointAnnotation.tapHandler` (`Annotations/Generated/PointAnnotation.swift:28`) |

Android: no Mapbox Maps AAR or sources exist under `~/.gradle`, `~/.m2` or the repo. The only Android symbols seen are the ones the repo already compiles against 11.31.1 in `packages/native-mapbox/android/src/main/java/com/margelo/nitro/mapboxar/nativemap/HybridMapboxMapView.kt`: `MapboxOptions.accessToken` (`:35`), `MapView` (`:105`), `mapboxMap.loadStyle` (`:114`), `mapboxMap.cameraState` (`:63`), `CameraOptions.Builder` (`:151`), `Style.STANDARD` / `Style.STANDARD_SATELLITE` (`:160-161`). Every other Android binding (camera animation plugin, annotation plugin, gestures plugin, style source/layer/terrain calls, rendered-feature queries): to be inventoried in Phase 4 (MAPS_SDK_INVENTORY.md), against https://github.com/mapbox/mapbox-maps-android/releases (v11.32.0 tag, not fetched today).

`MapCapabilities` values per platform also come from that inventory. The Standard config keys `lightPreset`, `show3dObjects`, `showPointOfInterestLabels` are Mapbox Standard style configuration names, not SDK symbols; verify them against the 11.32.0 Standard style in Phase 4.

Happy path:

```ts
const map = mapRef.current
if (map === null) throw new Error('MapboxMapView is not mounted')

const style = await map.loadStyle(MapStyles.standard)
await style.addRasterDemSource({
  id: 'mapbox-dem',
  url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
})
await style.setTerrain({ sourceId: 'mapbox-dem', exaggeration: 1.4 })
await style.setStandardConfig({ lightPreset: 'dusk', show3dObjects: true })

const cameraSub = map.addOnCameraChangedListener((state) => {
  store.setZoom(state.zoom)
})
const end = await map.flyTo(
  { center: { latitude: 40.7484, longitude: -73.9857 }, zoom: 15, pitchDeg: 60 },
  { durationMs: 2000 },
)
if (end === 'interrupted') console.info('user took over the camera')

return () => cameraSub.remove()
```

Unavailable capability:

```ts
if (!MapboxMaps.isMapViewAvailable) {
  // For example visionOS without a Maps SDK slice: do not mount the view.
  renderFallbackMap()
  return
}

const map = mapRef.current
if (map === null) return
const style: MapStyle = await map.loadStyle(MapStyles.standard)
if (map.capabilities.supportsTerrain) {
  await style.addRasterDemSource({
    id: 'mapbox-dem',
    url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
  })
  await style.setTerrain({ sourceId: 'mapbox-dem' })
}
// Without terrain support the map stays flat; setTerrain would reject.
```

Invalid input and cleanup:

```ts
const map = mapRef.current
if (map === null) return

const markers = await map.createPointAnnotationManager()
const tapSub = markers.addOnAnnotationTapListener((id) => console.info(id))
const errorSub = map.addOnMapLoadingErrorListener((error) => {
  console.warn(error.message)
})
try {
  await markers.setAnnotations([
    { id: 'a', coordinate: { latitude: 40.75, longitude: -73.99 } },
    { id: 'a', coordinate: { latitude: 40.76, longitude: -73.98 } },
  ])
} catch (error) {
  // Rejects: duplicate annotation id "a".
  console.warn((error as Error).message)
} finally {
  tapSub.remove()
  errorSub.remove()
  await markers.removeFromMap()
}
```

## 4. Navigation: `MapboxNavigation` and `TripSession`

Sketch: `tests/api-sketch/navigation/*`.

| Type | Struct or HybridObject | Sync / async | Reason |
| --- | --- | --- | --- |
| `MapboxNavigation` | HybridObject, root | `capabilities` sync property; `createTripSession` `Promise` | Session setup requests location, starts the SDK's trip session and checks capabilities; the factory resolves with a ready object |
| `TripSession` | HybridObject | all commands `Promise`; listeners sync | Owns the native trip session and location source; one active at a time |
| `TripSessionOptions`, `NavigationRoutesInput`, `TripProgress`, `RerouteEvent` | structs | | |
| `TripLocationSource` | literal union `'device' \| 'replay-primary-route'` | | Replay is what the Phase 5 recorded-drive gate and Meta Quest need |

**Reused shapes (compiler-checked in the sketch).**

| Existing type (`src/navigation/`) | Used as |
| --- | --- |
| `NativeNavigationCapabilities` (`contracts.ts`) | `MapboxNavigation.capabilities`, unchanged |
| `ElectronicHorizonSnapshot` / `ElectronicHorizonEdge` (`contracts.ts`) | `TripSession.getElectronicHorizon()` result, unchanged |
| `NavigationProgressSnapshot` (`contracts.ts`) | `TripProgress` has the same fields minus `route` (an open `[key: string]: unknown` record cannot cross Nitro). `negative.ts` asserts `TripProgress` is assignable to `Omit<NavigationProgressSnapshot, 'route'>` |
| `NavigationManeuver` (`route.ts`, PR #35) | `TripProgress.upcomingManeuver` |
| `RouteLeg` / `RouteStep` (`route.ts`, PR #35) | `RerouteEvent.legs` |
| `NavigationCoordinate` (`client.ts`) | `TripProgress.location` |

`setRoutes` takes `NavigationRoutesInput { responseJson, requestUrl, primaryRouteIndex? }`: the native SDK rebuilds routes from the raw Directions response plus its request URL (it reroutes with the same options). The parsed `NavigationRoute` from `MapboxNavigationClient` cannot be sent: it is an open record. Open question 4 covers adding a raw-response method to the client.

**Lifecycle.**

```
MapboxNavigation.createTripSession(options) ──► TripSession (active)
   second createTripSession while active ──► rejects "call TripSession.stop() first"
TripSession.setRoutes(...) ──► guidance; progress / reroute / error listeners fire
TripSession.stop() ──► stopped: every method rejects "TripSession was stopped", listeners silent; root can create a new one
```

**Errors.** `createTripSession` rejects when `MapboxAR.accessToken` is empty (`Mapbox access token is not set (MapboxNavigation.createTripSession)`), when `capabilities.activeGuidance` is false, when a session is active, when `locationSource: 'device'` lacks location permission, and when `enableElectronicHorizon` is requested but `capabilities.electronicHorizon` is false. `setRoutes` rejects on unparseable JSON, `primaryRouteIndex` out of range, or a stopped session. `getElectronicHorizon` rejects when the session was created without `enableElectronicHorizon`, and resolves `undefined` until the position is matched to a road. Reroute request failures and a stopped location source go to `addOnErrorListener`.

**When to use which.**

| Need | Use |
| --- | --- |
| Plan a route, draw it, project it into AR, run on web / Lens Studio | JS `NavigationSession` + `MapboxNavigationClient` (core entry, no native SDK) |
| Turn-by-turn progress from device GPS, rerouting, electronic horizon, replayed drives | `MapboxNavigation.createTripSession` |
| Both, one API | `NavigationSession` with a `nativeProvider` adapter over `TripSession` (Phase 5: the adapter keeps the last `TripProgress` to answer `NativeNavigationProvider.getProgress()`) |

**Native symbols.** The Navigation SDK is not installed anywhere on this machine (no `MapboxNavigationCore` pod, no `com.mapbox.navigationcore` artifact). Every binding (trip session start/stop, route setting from a Directions response, progress and reroute observers, electronic horizon observer, replay location provider) is to be inventoried in Phase 5 against https://github.com/mapbox/mapbox-navigation-ios (3.27.3) and https://github.com/mapbox/mapbox-navigation-android (3.32.0). No symbol names are proposed here.

Happy path:

```ts
const requestUrl =
  'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/' +
  '-73.9857,40.7484;-73.9680,40.7851' +
  `?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`
const response = await fetch(requestUrl)
const responseJson = await response.text()

const trip = await MapboxNavigation.createTripSession({
  enableElectronicHorizon: true,
})
const progressSub = trip.addOnProgressListener((progress) => {
  store.setProgress(progress)
})
const rerouteSub = trip.addOnRerouteListener((event) => {
  console.info(`rerouted: ${event.legs.length} legs`)
})
await trip.setRoutes({ responseJson, requestUrl })
const horizon = await trip.getElectronicHorizon()
if (horizon !== undefined) console.info(horizon.edges.length)

return async () => {
  progressSub.remove()
  rerouteSub.remove()
  await trip.stop()
}
```

Unavailable capability:

```ts
if (!MapboxNavigation.capabilities.activeGuidance) {
  // No native guidance on this host: plan with the JS session instead.
  const session = new NavigationSession({
    client: new MapboxNavigationClient({ accessToken: MAPBOX_TOKEN }),
  })
  const planned = await session.planRoute([
    { longitude: -73.9857, latitude: 40.7484 },
    { longitude: -73.968, latitude: 40.7851 },
  ])
  await session.start(planned.primary)
  return
}
```

Invalid input and cleanup:

```ts
const trip = await MapboxNavigation.createTripSession({
  locationSource: 'replay-primary-route',
})
const errorSub = trip.addOnErrorListener((error) => console.warn(error.message))
try {
  await trip.setRoutes({ responseJson, requestUrl, primaryRouteIndex: 7 })
} catch (error) {
  // Rejects: primaryRouteIndex 7 is out of range.
  console.warn((error as Error).message)
} finally {
  errorSub.remove()
  await trip.stop()
}
```

## 5. `SpatialHostCapabilities`

Sketch: `tests/api-sketch/reactvision/*`. Plain TypeScript; the ReactVision package is JS over Viro, so no HybridObject.

```ts
interface SpatialHostCapabilities {
  readonly isImmersive: boolean
  readonly supportsGeospatialAnchors: boolean
  readonly supportsVps: boolean
  readonly supportsColocation: boolean
  readonly supportsGaze: boolean
  readonly isGraphiteAvailable: boolean
  readonly hasDeviceLocation: boolean
}
declare function getSpatialHostCapabilities(probe: SpatialHostProbe): Promise<SpatialHostCapabilities>
```

It replaces `ReactVisionRuntimeCapabilities` and the `ReactVisionPlatform` literal in `packages/reactvision/src/xr.ts`, where `normalizeReactVisionCapabilities` derives every flag from `platform`. Nothing in the new struct names a platform: Quest's missing GPS, visionOS's missing Graphite and a future host's features are runtime values.

`getSpatialHostCapabilities` is async because Viro's queries are (`isColocationAvailable(): Promise<boolean>`, `isGeospatialModeSupported(): Promise<...>`). It takes a `SpatialHostProbe` so tests inject a fake host instead of switching on a platform string.

| Field | Source (Viro 3.0.2 installed; Phase 1 moves to 3.0.3, re-check) |
| --- | --- |
| `isImmersive` | `isQuest` (`node_modules/@reactvision/react-viro/dist/components/Utilities/ViroPlatform.d.ts:7`), `isVisionOS` (`:17`) |
| `supportsGeospatialAnchors` | `arSceneNavigator.isGeospatialModeSupported(): Promise<ViroGeospatialSupportResult>` (`dist/components/AR/ViroARSceneNavigator.d.ts:777`; result `{ supported: boolean }`, `dist/components/Types/ViroEvents.d.ts:645`) |
| `supportsVps` | same geospatial support; per-location availability stays `checkVPSAvailability(lat, lng)` (`ViroARSceneNavigator.d.ts:782`), which is a query, not a capability |
| `supportsColocation` | `isColocationAvailable(): Promise<boolean>` (`dist/components/AR/ViroColocation.d.ts:63`) |
| `supportsGaze` | headset hosts (`isQuest`, `isVisionOS`) until Viro exposes a gaze query; Phase 6 to confirm |
| `isGraphiteAvailable` | the renderer probe (`getGraphiteWebGPUContext` / `isGraphiteWebGPUAvailable` in `src/rendering/graphite.ts`), not Viro. Replaces `graphiteOnVisionOS` |
| `hasDeviceLocation` | `false` on Quest per Meta's React Native docs (GPS, heading, geocoding not available); location permission state elsewhere |

`platform` survives only on `ColocationPeer { peerId, platform: ColocationPlatform }`, because a peer can run a different platform from this device. `canShareColocationFrame(a, b)` takes two peers.

`selectRendererBackend` (`src/rendering/backend.ts`) keeps its signature; callers fill `RendererCapabilities.graphite` and `sharedDawnDevice` from `isGraphiteAvailable`, so `'auto'` lands on `webgpu` on visionOS without a platform check.

Dropped from today's struct, pending open question 5: `mixedReality`, `webRenderer`, `replicatedState`.

Happy path:

```ts
const host = await getSpatialHostCapabilities(viroProbe)
const backend = selectRendererBackend('auto', {
  graphite: host.isGraphiteAvailable,
  webgpu: true,
  sharedDawnDevice: host.isGraphiteAvailable,
  nitro: true,
})
// visionOS reports isGraphiteAvailable: false, so 'auto' lands on 'webgpu'.
console.info(backend)
```

Unavailable capability (Meta Quest):

```ts
const host = await getSpatialHostCapabilities(viroProbe)
if (!host.hasDeviceLocation || !host.supportsGeospatialAnchors) {
  // Meta Quest: no GPS. Anchor the route to a table, never to
  // getCameraGeospatialPose().
  anchorRouteToTable()
  return
}
anchorRouteToGeospatialPose()
```

Invalid input and cleanup:

```ts
const phone = { peerId: 'p1', platform: 'ios' } as const
const browser = { peerId: 'w1', platform: 'web' } as const
if (!canShareColocationFrame(phone, browser)) {
  console.info('web peers join as spectators, not in the shared frame')
}

try {
  return await getSpatialHostCapabilities(viroProbe)
} catch (error) {
  // A probe query rejected; the message names it. Report nothing as
  // available rather than guessing from the platform.
  console.warn((error as Error).message)
  return {
    isImmersive: false,
    supportsGeospatialAnchors: false,
    supportsVps: false,
    supportsColocation: false,
    supportsGaze: false,
    isGraphiteAvailable: false,
    hasDeviceLocation: false,
  }
}
```

## 6. The JS-only `core` entry

Sketch: `tests/api-sketch/core/core-entry.ts`, `FetchLike.ts`, `HttpClientOptions.ts`, `ProposedClients.ts`.

`@mikevocalz/nitro-mapbox-ar/core` is for consumers without React Native: the web harness and Lens Studio (Specs). It builds to plain ESM plus `.d.ts`.

**Rule.** No module reachable from the `core` entry may import `react`, `react-native`, `react-native-nitro-modules`, `@shopify/react-native-skia`, `react-native-webgpu` or `typegpu`, directly or transitively.

Every module under `src/` was classified today by walking relative imports (script kept in the session scratchpad; Phase 9 turns it into `scripts/check-core-imports.mjs` and a CI gate).

| Exported from `core` (transitively clean) | Excluded (reaches a native/GPU import) |
| --- | --- |
| `core/config`, `geo/bbox`, `mapbox/raster`, `mapbox/tiles`, `mapbox/vector`, `rendering/backend`, `terrain/cache/budget`, `terrain/cache/neighborhood`, `terrain/gpu/grid`, `terrain/gpu/multitile`, `terrain/session/plan`, `search/client`, `search/anchor`, `navigation/client`, `navigation/route`, `navigation/traffic`, `navigation/advanced`, `navigation/session`, `navigation/contracts` (types), `agent/runtime`, `agent/types`, `indoor/contracts`, `experimental/registry`, `types`, plus a JS `decodeTerrainRgb` | `native/MapboxARCore.ts` (Nitro), `rendering/graphite.ts` (Skia, WebGPU), `terrain/gpu/root.ts` and `terrain/gpu/terrainRgb.ts` (TypeGPU), and through them `terrain/gpu/{tile,imagery,draw,target,surface,batch}`, `terrain/cache/residency.ts`, `terrain/session/session.ts`, `session/spatialTileSession.ts` |

The core entry has no `MapboxAR` root and no process-wide token: each client takes `accessToken` in its options, as it does today.

**Injectable fetch.** Today `MapboxNavigationClient`, `MapboxSearchClient`, `MapboxRasterClient`, `MapboxVectorClient` and `MapboxAdvancedNavigationClient` all accept `fetchImpl?: typeof fetch`. `typeof fetch` requires DOM typings and a WHATWG `Response`, which Lens Studio's fetch module does not promise. The proposal widens the option to

```ts
type FetchLike = (url: string, init?: { readonly signal?: AbortSignal }) => Promise<{
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
  arrayBuffer(): Promise<ArrayBuffer>
}>
```

which is exactly what the five clients call today (`url`, `{ signal }`, `ok`, `status`, `json()`, `arrayBuffer()`). `globalThis.fetch` still satisfies it, so no caller breaks. `signal` is omitted when the caller passed none, so hosts without `AbortSignal` never see it. The sketch models the proposal as `HttpClientOptions`; the source change lands with Phase 9 (this phase does not edit `src/`).

Happy path:

```ts
// Web harness: global fetch exists, so fetchImpl is optional.
const search = new MapboxSearchClient({ accessToken: MAPBOX_TOKEN })
const places = await search.forward('Empire State Building', { limit: 1 })
console.info(places.features.length)
```

Unavailable capability (no global fetch):

```ts
// Lens Studio: no global fetch. Pass the host's transport.
const navigation = new MapboxNavigationClient({
  accessToken: MAPBOX_TOKEN,
  fetchImpl: lensFetch,
})
const response = await navigation.directions([
  { longitude: -73.9857, latitude: 40.7484 },
  { longitude: -73.968, latitude: 40.7851 },
])
console.info(response.routes.length)
```

Invalid input and cleanup:

```ts
const navigation = new MapboxNavigationClient({
  accessToken: MAPBOX_TOKEN,
  fetchImpl: lensFetch,
})
const controller = new AbortController()
try {
  // Throws RangeError: at least two coordinates are required.
  await navigation.directions([{ longitude: 0, latitude: 0 }], {
    signal: controller.signal,
  })
} catch (error) {
  console.warn((error as Error).message)
} finally {
  controller.abort()
}
```

## 7. Constraints found while sketching

- **String-literal discriminators.** nitrogen 0.37.1 rejects a field typed as one string literal and inline literal unions (`createType.ts`). Hence per-kind `add*Source` methods. Unions of named structs work only when their shapes differ (`RenderedFeatureQuery.area: ScreenPoint | ScreenBox` qualifies).
- **`ManeuverType` is open.** `NavigationManeuver.kind` is `ManeuverType`, whose last member is `(string & {})`. nitrogen cannot represent that union. Phase 5 needs the native-facing `NavigationManeuver.kind` typed as `string` while JS keeps `ManeuverType` (open question 6).
- **Readonly arrays.** `RouteLeg.steps` is `readonly RouteStep[]`; nitrogen support for `readonly T[]` was not verified today.
- **Root constant and spec type share a name.** TypeScript 7.0.2 reports TS2323 for `export type { MapboxAR } from './MapboxAR.nitro'` beside `export const MapboxAR`. The sketch barrels use `import type { MapboxAR as MapboxARSpec }` plus `export type MapboxAR = MapboxARSpec`. Phase 3 should check this against the real `NitroModules.createHybridObject` line.
- **Cross-package structs.** `ListenerSubscription` and `GeographicCoordinate` are defined once in core and imported by maps and navigation in the sketch. Whether nitrogen resolves a struct from another Nitro package's spec was not verified; the fallback is one copy per package with identical shape.

## 8. api-design checklist

| Rule | How the design satisfies it |
| --- | --- |
| Sketch the TS API and 2–3 call sites first, incl. error and cleanup | 15 examples in `call-sites.ts`, 3 per API, each with a failure or cleanup path |
| Verify exported TS with repo tooling | `npx tsc --noEmit -p tests/api-sketch/tsconfig.json` exit 0, extends root `tsconfig.json` |
| API freshness from current sources | Versions from `npm view` today (section 10); SDK symbols from installed sources with paths, none from memory |
| Single source of truth | `accessToken` property replaces 4 methods; no per-view token (deviation, open question 1); `camera` prop is jump-only, live camera comes from the map |
| Option objects at 3+ params | `CameraAnimationOptions`, `FitBoundsOptions`, `TripSessionOptions`, `NavigationRoutesInput`. `decodeTerrainRgb(rgba, heightModifier)` keeps 2 positional params of different types |
| Specific input types | `durationMs: number`, `MapProjection`, `TripLocationSource`; `styleUri` takes a URI, aliases dropped |
| No "does everything" objects | Style mutations on `MapStyle`, markers on `PointAnnotationManager`, guidance on `TripSession` |
| Inventory workflows before simplifying | Live trip session kept beside the JS planner; reroute and electronic horizon kept; dropped capability flags listed in open question 5 |
| Literal unions over enums; kebab-case values | All unions are string literals; `replay-primary-route`, `raster-dem`-style names; no runtime enums |
| No untyped dictionaries | **Exception:** `StyleLayer.paint` / `layout` are `AnyMap`. The Style Specification has hundreds of properties per layer type; typing them is Phase 4 work generated from the spec, and the SDK accepts JSON properties (`addLayer(with:layerPosition:)`). Revisit in Phase 4 |
| Optional boolean, not two-case string | `enableGestures?`, `enableRerouting?`, `enableElectronicHorizon?` with documented defaults |
| No nullable clusters; variants instead | Separate source structs; `CameraTarget.center` keeps lat/lng together; `TripProgress.upcomingManeuver` is one optional struct |
| `undefined` for absence | `getElectronicHorizon(): Promise<... \| undefined>`. Existing `NavigationSession` still uses `null`; unchanged here |
| Model intent separately from resolved state | `CameraTarget` (request) vs `CameraState` (rendered); `TripSessionOptions` vs `capabilities` |
| No ambient `platform` field | Removed from capabilities; kept only on `ColocationPeer`, where it is another device's data |
| Do not freeze the platform matrix into types | `MapCapabilities`, `SpatialHostCapabilities`, `MapboxMaps.isMapViewAvailable` are runtime booleans. **Exception:** `ColocationPlatform` stays a closed literal (open question 7) |
| One options object, no `ios`/`android` bags | None exist |
| Requirements throw, preferences degrade | `setTerrain` throws when terrain is unsupported (visible correctness); `projection: 'globe'` on a host without globe renders Mercator and reports `supportsGlobeProjection: false` |
| Split by semantic capability | Maps and Navigation are separate packages and roots; one-shot planning (JS) vs live session (native) |
| Capability discovery separate from object contracts | Once `createTripSession` resolves, every `TripSession` method is guaranteed; electronic horizon is requested at creation and the factory rejects if unsupported |
| Encode lifecycle in the object graph | `loadStyle` → `MapStyle`; `createTripSession` → `TripSession`; `createPointAnnotationManager` → manager |
| Avoid stale state | Old `MapStyle` rejects after a reload; stopped `TripSession` rejects |
| No JS facade over a public HybridObject | Roots exported 1:1. Deliberate JS layers stay: `NavigationSession`, `MapboxViroRoute`, `createReactVisionSpatialBridge` (Viro is not Nitro) |
| `all` modelled explicitly | Not needed: `layerIds` omitted means all layers, documented; empty array rejects |
| No half-initialised objects | `loadStyle` and `createTripSession` resolve ready handles; no `prepare()` |
| Small public root per package | `MapboxAR`, `MapboxMaps`, `MapboxNavigation` |
| `undefined` returns only for domain absence | Electronic horizon before map matching; documented |
| Plain value vs resource | Structs for camera/events; HybridObjects for `MapStyle`, managers, `RenderedFeature` |
| `string` for text, `ArrayBuffer` for bytes | GeoJSON and Directions JSON are `string`; Terrain-RGB is `ArrayBuffer` |
| One public type per file; barrels only | One file per type; three tightly coupled exceptions (`StyleLayer` + `StyleLayerType`, `StandardStyleConfig` + `StandardLightPreset`, `ColocationPeer` + `ColocationPlatform`). Sketch barrels add one `type X = XSpec` line each (section 7) |
| Shared fields on a base | Nothing repeats today; `HybridObject` base supplies `name` / `dispose` |
| Helpers on the smallest receiver | `RenderedFeature.toGeoJson()` is on the feature, not the query |
| No `void 0`, no `??=` / `\|\|=` / `&&=` | grep of `tests/api-sketch` finds none. The lazy `??=` in `src/native/MapboxARCore.ts` goes away with the root constant |
| Verb + subject names, unit suffixes | `addOnCameraChangedListener`, `durationMs`, `bearingDeg`, `pitchDeg`, `tileSizePx`. **Exception:** reused `NavigationProgressSnapshot` fields (`distanceRemaining`, `durationRemaining`) keep their unitless names to stay identical to the existing contract; units are in JSDoc |
| `is*` / `has*` / `supports*` for observed state; `enable*` for preferences | `isMapViewAvailable`, `supportsTerrain`, `hasDeviceLocation`, `enableGestures`. **Exception:** reused `NativeNavigationCapabilities` (`activeGuidance`, `rerouting`, ...) keeps its names (open question 8) |
| Properties for cheap state, methods for work | `capabilities`, `uri`, `id` are properties; everything that crosses to the UI thread is a method |
| No package prefix on every type | `CameraState`, `MapStyle`, `TripSession`, not `MapboxCameraState` |
| `readonly` for observed state; writable only when assignment is the command | Only `MapboxAR.accessToken` is writable; `negative.ts` proves the rest reject assignment |
| Writable properties cheap and infallible | `accessToken` stores a string, no validation that can throw |
| Sync only for immediate local work | `decodeTerrainRgb` (bounded), property reads, listener registration |
| Promise for one-shot async, listeners for repeated events | Camera moves, queries, setup are Promises; camera, tap, style, progress, reroute, errors are listeners |
| Avoid the main thread; no hidden hops | Map methods are async because the SDK is UI-thread bound; decode runs on an owned worker queue |
| Explicit sync and async pair for heavy transforms | `decodeTerrainRgb` / `decodeTerrainRgbAsync` |
| No timeouts or sleeps for ordering | `loadStyle` resolves on the style-loaded event; superseded loads reject explicitly |
| `addOn...Listener` returning `ListenerSubscription { remove }` | Every repeated event; no `setOn...` slots, no numeric ids (`negative.ts` checks) |
| Never swallow errors | Async failures without a pending call go to `addOnMapLoadingErrorListener` / `TripSession.addOnErrorListener` |
| Real `Error` objects, specific messages | Messages name the value, range, missing capability or alternative (`decodeTerrainRgbAsync`, `MapStyles.standard`, `TripSession.stop()`) |
| Cross-platform concepts, no native class names | `CameraAnimationEnd`, not `UIViewAnimatingPosition`; no SDK type leaks into JS |
| JSDoc on every export with resolving `{@linkcode}` | Every exported declaration in the sketch has JSDoc; a script checked that each `{@linkcode X}` root is imported or declared in its file, and each `X.member` exists |

## 9. SDK symbol index

Cited, with location:

- MapboxMaps 11.3.0 (iOS), `~/whatsupps/apps/expo/ios/Pods/MapboxMaps/Sources/MapboxMaps/`: `MapView` managers, `MapboxMap`, `StyleManager.{addSource, removeSource, addLayer, removeLayer, setTerrain, setStyleImportConfigProperties, setProjection, mapStyle}`, `Terrain`, `StyleProjectionName.{mercator, globe}`, `StyleURI.standard`, `CameraAnimationsManager.{fly, ease, cancelAnimations}`, `MapboxMap.{camera(for:...), cameraState, onCameraChanged, onStyleLoaded, onMapLoadingError, queryRenderedFeatures}`, `CameraState`, `GestureManager.onMapTap`, `AnnotationOrchestrator.{makePointAnnotationManager, removeAnnotationManager}`, `PointAnnotationManager.annotations`, `PointAnnotation.{init(id:coordinate:), tapHandler}`. Line numbers in section 3.
- Repo usage against the 11.31.1 pin: iOS `MapboxOptions.accessToken`, `MapView(frame:mapInitOptions:)`, `mapboxMap.setCamera(to:)`, `StyleURI.standardSatellite` (`packages/native-mapbox/ios/HybridMapboxMapView.swift`); Android `MapboxOptions.accessToken`, `MapView`, `mapboxMap.loadStyle`, `mapboxMap.cameraState`, `CameraOptions.Builder`, `Style.STANDARD`, `Style.STANDARD_SATELLITE` (`.../nativemap/HybridMapboxMapView.kt`).
- Viro 3.0.2, `node_modules/@reactvision/react-viro/dist/`: `isQuest`, `hasOpenXRSupport`, `isVisionOS` (`components/Utilities/ViroPlatform.d.ts:7,16,17`), `isColocationAvailable` (`components/AR/ViroColocation.d.ts:63`), `isGeospatialModeSupported`, `getCameraGeospatialPose`, `checkVPSAvailability` (`components/AR/ViroARSceneNavigator.d.ts:777,781,782`), `ViroGeospatialSupportResult` (`components/Types/ViroEvents.d.ts:645`).
- Nitro 0.37.1, `node_modules/react-native-nitro-modules/lib/typescript/`: `HybridObject`, `HybridView`, `HybridViewProps`, `HybridViewMethods`, `HybridRef`, `ReactNativeView`, `getHostComponent`, `AnyMap`.

Not installed locally (inventory in Phase 4/5, `MAPS_SDK_INVENTORY.md`):

- Mapbox Maps SDK **11.32.0**, iOS and Android: https://github.com/mapbox/mapbox-maps-ios/releases/tag/v11.32.0 and https://github.com/mapbox/mapbox-maps-android/releases. The 11.3.0 iOS copy above is a stand-in, not the target.
- Any Android Maps symbol not already used by the repo (camera, annotation, gestures, location, viewport plugins; style source/layer/terrain; rendered-feature query).
- `MapboxCommon` (`MapboxOptions` definition).
- Mapbox Navigation SDK: iOS `MapboxNavigationCore` 3.27.3 (https://github.com/mapbox/mapbox-navigation-ios), Android 3.32.0 (https://github.com/mapbox/mapbox-navigation-android). No symbol is cited for any `TripSession` method.

## 10. Freshness

`npm view <pkg> version` on 2026-10-08:

| Package | Latest | Installed in repo | Note |
| --- | --- | --- | --- |
| `react-native-nitro-modules` | 0.37.1 | 0.37.1 | sketch typechecks against it |
| `nitrogen` | 0.37.1 | 0.37.1 | source read for the constraints in section 7 |
| `react-native-webgpu` | 0.13.0 | per Phase 1 | |
| `@shopify/react-native-skia` | 2.14.0 | per Phase 1 | |
| `@reactvision/react-viro` | 3.0.3 | 3.0.2 | symbols above read from 3.0.2; re-check after Phase 1 |
| `@reactvision/react-native-visionos` | 0.86.4 | not installed | |

## 11. Open questions for review

1. **Per-view token.** The pack lists an `accessToken` prop on `MapboxMapView`. This design removes it and reads `MapboxAR.accessToken`, because the SDK token is process-wide. Accept the deviation? If yes, Phase 3 must pick the mechanism by which Swift/Kotlin read a C++ root's state (a shared C++ token store linked by all three packages, or the core setter writing `MapboxOptions.accessToken` through a small platform shim). The Nitro skill warns against relying on Swift/Kotlin calling C++ HybridObjects without verification.
2. **Sync decode limit.** `decodeTerrainRgb` throws above 1 MiB (one 512² tile) and points to the async form. Keep the hard limit, or make it documentation only?
3. **Async map methods.** Every map method is a Promise because the SDK is UI-thread bound. Today's `getCamera()` is sync. Accept the break?
4. **Raw Directions response.** `TripSession.setRoutes` needs the response JSON and request URL. Add a method to `MapboxNavigationClient` that returns both (it currently returns only the parsed body)? The URL contains the token; the native SDK needs it for rerouting.
5. **Dropped capability flags.** `mixedReality`, `webRenderer`, `replicatedState` from `ReactVisionRuntimeCapabilities` are not in the pack's seven fields. Drop, or add as `supportsPassthrough` / `supportsReplicatedState`? (`webRenderer` is covered by renderer selection.)
6. **`ManeuverType` across Nitro.** Type the native-facing `NavigationManeuver.kind` as `string` (JS keeps `ManeuverType`), or close the union?
7. **`ColocationPlatform`.** Keep the closed literal on peer data, or widen to `string` so a new headset can join without a release?
8. **Rename `NativeNavigationCapabilities` fields** to `supports*` (`supportsActiveGuidance`, ...)? Breaks `NavigationSession.capabilities` consumers; kept as-is here.
9. **`StyleLayer` paint/layout as `AnyMap`** until Phase 4 generates typed layer properties. Accept the interim exception?
10. **Annotation lifetime.** `PointAnnotationManager` survives style reloads (the SDK keeps annotation layers across style changes as far as 11.3.0 shows). Confirm against 11.32.0 in Phase 4, or scope managers to a `MapStyle`?
11. **`MapboxMaps` root.** Not in Phase 2's list; added so apps can check `isMapViewAvailable` before mounting. Keep it, or report unavailability only through the view's loading-error listener?

### Decisions (2026-10-08)

| # | Disposition | Decision |
| --- | --- | --- |
| 1 | BUILD | Accept the deviation: one process-wide token on `MapboxAR.accessToken`, no per-view prop. Phase 3 picks the mechanism after reading the installed Nitro and Mapbox sources, and records it in `docs/NITRO.md`. Swift/Kotlin never call into a C++ HybridObject unless that path is verified first. |
| 2 | BUILD | Keep the 1 MiB hard limit on `decodeTerrainRgb`. The `RangeError` names `decodeTerrainRgbAsync` as the alternative. |
| 3 | BUILD | Every map method is a Promise, including `getCamera()`. The break goes in `docs/MIGRATION.md`. |
| 4 | BUILD | Add a `MapboxNavigationClient` method that returns the response JSON and the request URL. The URL carries the token, so it is never logged and the JSDoc says so. |
| 5 | BUILD | Add `supportsPassthrough` and `supportsReplicatedState`. Drop `webRenderer`; renderer selection covers it. |
| 6 | BUILD | The native-facing `kind` is `string`; JS keeps the `ManeuverType` union and maps unknown values to `'unknown'`. A new SDK maneuver must not crash the bridge. |
| 7 | BUILD | Widen `ColocationPlatform` to `string`, so a new headset can join without a release. |
| 8 | DEFER | Keep the `NativeNavigationCapabilities` field names. Harlem Might reads them today; rename at 1.0 with a migration note. |
| 9 | BUILD | Accept `AnyMap` for layer paint/layout until Phase 4 generates typed properties. |
| 10 | BUILD | Phase 4 checks annotation lifetime against the installed 11.32.0 SDK and records the result in `docs/MAPS_SDK_INVENTORY.md`. Managers stay unscoped unless the SDK says otherwise. |
| 11 | BUILD | Keep the `MapboxMaps` root with `isMapViewAvailable`. |
