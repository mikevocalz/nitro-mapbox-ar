# Native Navigation SDK binding

`@mikevocalz/nitro-mapbox-ar-navigation` (`packages/navigation`) binds the
Mapbox Navigation SDK v3 on iOS and Android behind two Nitro HybridObjects:

- `MapboxNavigation` (root, autolinked): `capabilities`, `createTripSession(options): Promise<TripSession>`.
- `TripSession` (returned by the root): `setRoutes`, `addOnProgressListener`,
  `addOnRerouteListener`, `addOnErrorListener` (each returns a
  `ListenerSubscription`), `getElectronicHorizon`, `stop`.

Swift and Kotlin implement both. Nitrogen 0.37.1 output is committed under
`packages/navigation/nitrogen/generated`.

**Nothing in this package has been compiled for a device or run on one.** No
`pod install`, Xcode build, Gradle build or recorded drive was done. Every
symbol below was read from SDK source; none was exercised.

## Versions

| | Source read | Default pin | Override |
| --- | --- | --- | --- |
| iOS | `mapbox/mapbox-navigation-ios` tag `v3.27.3` (commit `17c1282`), bound symbols re-checked at tag `3.32.0` | `3.32.0` | env `NITRO_MAPBOX_AR_NAVIGATION_VERSION` |
| Android | `mapbox/mapbox-navigation-android` tag `v3.32.0`, public API from `navigation/api/current.txt` and `base/api/current.txt` | `3.32.0` | root ext `NitroMapboxARNavigationVersion` |
| Android models | `mapbox/mapbox-java` tag `v7.10.1` (the `mapboxSdkServices` version in `gradle/dependencies.gradle` at nav `v3.32.0`) | transitive | |

The modernization pack names iOS 3.27.3. That tag exists, but its
`Package.swift` pins `mapsVersion = "11.27.3"` (exact), while the maps package
pins MapboxMaps 11.32.0. Two MapboxMaps versions cannot link into one app, so
the iOS default is 3.32.0, whose `Package.swift` pins `mapsVersion = "11.32.0"`.
The iOS symbols this package uses have the same public declarations at both
tags (compared file by file: `SessionController.swift`,
`ElectronicHorizonController.swift`, `NavigationController.swift`,
`LocationSource.swift`, `RoadGraph.swift`, `RoadGraphPosition.swift`,
`RoutingProvider.swift`, `NavigationCoreApiConfiguration.swift`).
Android nav 3.32.0 uses Maps `11.32.0` (`mapboxMapSdk : "11.${mapboxSdkVersionSuffix}"`
with suffix `32.0` in `gradle/dependencies.gradle`).

## Installing the SDKs

**iOS.** `mapbox-navigation-ios` ships no podspec; the README lists Swift
Package Manager only. The podspec links it with React Native's
`spm_dependency` (`react-native/scripts/react_native_pods.rb`, implemented in
`scripts/cocoapods/spm.rb`, `SPMManager.apply_on_post_install`), requesting the
products `MapboxNavigationCore` and `MapboxDirections`. The products are
attached to the core `NitroMapboxAR` pod target, the same owner the maps
podspec uses for `MapboxMaps`. With static pod libraries Xcode copies a
package's object files into every pod library that lists one of its products;
when the maps and navigation pods each listed their own, the app link failed
with 21,377 duplicate MapboxMaps symbols. The navigation pod compiles against
the package modules through `SWIFT_INCLUDE_PATHS` and `FRAMEWORK_SEARCH_PATHS`
on `${SYMROOT}/${CONFIGURATION}${EFFECTIVE_PLATFORM_NAME}`. React Native still
logs its static-linking warning for `NitroMapboxAR`; static pods link (checked
with the reference app on the iOS Simulator). Stable releases need no `.netrc`
token.

**Android.** `com.mapbox.navigationcore:navigation-ndk27` (group from
`gradle/artifact-settings.gradle`, `mapboxArtifactGroupId`; artifact
`navigation$ndkVersionSuffix` in `navSdkArtifactSettings`) is served from
`https://api.mapbox.com/downloads/v2/releases/maven`, which needs a **secret
token with the `DOWNLOADS:READ` scope**. `android/build.gradle` reads it from
the `MAPBOX_DOWNLOADS_TOKEN` Gradle property or environment variable. No token
is in the repository, and none may be added. CI and the reference app need
one supplied through their secret stores (open question 2 in the pack).

## Access token

Both platforms read `MapboxARAccessToken.current` (decision 1, `docs/NITRO.md`)
at `createTripSession` and reject with
`Mapbox access token is not set (MapboxNavigation.createTripSession)` when it
is empty.

- iOS passes it to `NavigationCoreApiConfiguration(accessToken:)`
  (`Settings/NavigationCoreApiConfiguration.swift`); `MapboxNavigationProvider.apply(coreConfig:)`
  copies it to `MapboxOptions.accessToken`.
- Android sets `com.mapbox.common.MapboxOptions.accessToken` before
  `MapboxNavigationProvider.create`; `NavigationOptions.Builder` has no token
  field in 3.32.0 (`base/api/current.txt`, `NavigationOptions.Builder`).

The pod depends on `NitroMapboxAR`; the Gradle module depends on
`project(":mikevocalz_nitro-mapbox-ar")`.

## Bound symbols

### Session lifecycle

| Operation | iOS (`Sources/MapboxNavigationCore/...`) | Android |
| --- | --- | --- |
| SDK entry | `MapboxNavigationProvider.init(coreConfig:)`, `.mapboxNavigation` (`MapboxNavigationProvider.swift`) | `MapboxNavigationProvider.create(NavigationOptions)`, `.isCreated()`, `.destroy()` |
| Config | `CoreConfig.init(credentials:routingConfig:locationSource:electronicHorizonConfig:...)` (`Settings/Configuration/CoreConfig.swift`) | `NavigationOptions.Builder(Context).eHorizonOptions(...)` |
| Device location | `LocationSource.live` (`Navigator/LocationClient/LocationSource.swift`) | `MapboxNavigation.startTripSession()` |
| Replayed drive | `LocationSource.simulation(initialLocation:)` | `ReplayRouteSession.onAttached(MapboxNavigation)` (`core/replay/route/ReplayRouteSession.kt`; calls `startReplayTripSession()` and plays the routes set with `setNavigationRoutes`) |
| Rerouting on/off | `RerouteConfig.detectsReroute` (`Settings/RerouteConfig.swift`) in `RoutingConfig.rerouteConfig` | `MapboxNavigation.setRerouteEnabled(Boolean)` |
| Stop | `SessionController.setToIdle()` (`MapboxNavigation/SessionController.swift`) | `MapboxNavigation.stopTripSession()`, then `MapboxNavigationProvider.destroy()` |

iOS allows one provider per process: `MapboxNavigationProvider.checkInstanceIsUnique()`
calls `preconditionFailure("MapboxNavigationProvider was instantiated twice.")`.
`SharedNavigationProvider` creates it once and calls `apply(coreConfig:)` for
each later session; `apply` forwards the new `locationSource` to the
`MultiplexLocationClient`. Android destroys and recreates the provider per
session.

### Routes from a Directions response

Neither SDK accepts an outside Directions response publicly:

- iOS `NavigationRoutes.init(routeResponse:routeIndex:responseOrigin:)` is
  `@_spi(MapboxInternal)` (`Navigator/NavigationRoutes.swift`).
- Android `createNavigationRoutes(directionsResponseJson, routeRequestUrl, ...)`
  lives in `com.mapbox.navigation.base.internal.route` (`NavigationRouteFactory.kt`),
  and `NavigationRoute.create` is `internal` (`NavigationRoute.kt`).

`setRoutes` therefore validates the JSON (it must parse, have `routes`, and
`primaryRouteIndex` must be in range), parses the request URL into route
options, and asks the SDK's router for routes with those options:

| Step | iOS | Android |
| --- | --- | --- |
| URL to options | `RouteOptions(url:)` (`MapboxDirections/DirectionsOptions.swift`, `convenience init?(url:)`) | `RouteOptions.fromUrl(URL)` (mapbox-java `RouteOptions.java`) |
| Request | `MapboxNavigation.routingProvider().calculateRoutes(options:)` (`Routing/RoutingProvider.swift`, returns `Task<NavigationRoutes, Error>`) | `MapboxNavigation.requestRoutes(RouteOptions, NavigationRouterCallback)`, `cancelRouteRequest(Long)` |
| Pick the primary | `NavigationRoutes.selectingAlternativeRoute(at:)` (index - 1) | reorder the returned list |
| Guide | `SessionController.startActiveGuidance(with:startLegIndex:)` | `MapboxNavigation.setNavigationRoutes(List, Int, RoutesSetCallback)` |

Consequence: the SDK guides along a fresh response for the same request, so
ETAs can differ slightly from the JS response, and an alternative index can be
missing from the fresh response (that case rejects). Errors never include the
URL, which carries the token.

### Progress

| Field | iOS | Android |
| --- | --- | --- |
| stream | `NavigationController.routeProgress` (`RouteProgressState.routeProgress`) combined with `locationMatching` | `registerRouteProgressObserver(RouteProgressObserver)`, `registerLocationObserver(LocationObserver)` |
| `location`, `bearing`, `speedMetersPerSecond` | `MapMatchingState.enhancedLocation` (`CLLocation`; negative course/speed treated as unknown) | `LocationMatcherResult.getEnhancedLocation()` (`com.mapbox.common.location.Location`) |
| `distanceRemaining` / `durationRemaining` / `fractionTraveled` | `RouteProgress.distanceRemaining`, `.durationRemaining`, `.fractionTraveled` (`Navigator/RouteProgress/RouteProgress.swift`) | `RouteProgress.getDistanceRemaining()`, `getDurationRemaining()`, `getFractionTraveled()` |
| `currentLegIndex` | `RouteProgress.legIndex` | `RouteLegProgress.getLegIndex()` |
| `currentStepIndex` | `RouteLegProgress.stepIndex` | `RouteStepProgress.getStepIndex()` |
| `upcomingManeuver` | `RouteProgress.upcomingStep` (`MapboxDirections.RouteStep`: `maneuverType`, `maneuverDirection`, `maneuverLocation`, `initialHeading`, `finalHeading`, `instructions`, `exitIndex`) | `RouteLegProgress.getUpcomingStep()` (`LegStep.maneuver()`: `type()`, `modifier()`, `location()`, `bearingBefore()`, `bearingAfter()`, `instruction()`, `exit()`) |

`NavigationManeuver.kind` and `modifier` are plain strings across the bridge
(decision 6). `toCoreRouteLegs` in the package maps kinds outside the
Directions vocabulary to `'unknown'` and drops unknown modifiers.

### Rerouting and errors

| | iOS | Android |
| --- | --- | --- |
| reroute done | `NavigationController.rerouting`, event `ReroutingStatus.Events.Fetched`, routes from `SessionController.currentNavigationRoutes` | `registerRoutesObserver`, `RoutesUpdatedResult.reason == RoutesExtra.ROUTES_UPDATE_REASON_REROUTE` |
| reroute failed | `ReroutingStatus.Events.Failed.error` | `RerouteController.registerRerouteStateObserver`, `RerouteState.Failed` |
| other errors | `NavigationController.errors` (`NavigatorError`) | none bound |
| `RerouteEvent.routes` | `JSONEncoder` over `NavigationRoute.route` with `userInfo[.options]` (`Directions.swift`, `CodingUserInfoKey.options`); URL from `Directions.url(forCalculating:credentials:)` | `DirectionsRoute.toJson()`, `DirectionsRoute.routeOptions().toUrl(accessToken)` (mapbox-java) |
| `RerouteEvent.legs` | `Route.legs` / `RouteLeg.steps` | `DirectionsRoute.legs()` / `RouteLeg.steps()`; step `geometry` is left out because `LegStep.geometry()` is an encoded polyline whose precision depends on the request |

### Electronic horizon

| | iOS | Android |
| --- | --- | --- |
| config | `ElectronicHorizonConfig(length: 500, expansionLevel: 1, branchLength: 50, minTimeDeltaBetweenUpdates: nil)` | `EHorizonOptions.Builder().length(500).expansion(1).branchLength(50)` |
| start/stop | `ElectronicHorizonController.startUpdatingEHorizon()` / `stopUpdatingEHorizon()` | `registerEHorizonObserver` / `unregisterEHorizonObserver` (`@ExperimentalPreviewMapboxNavigationAPI`) |
| position | `EHorizonStatus.Events.PositionUpdated.position` (`RoadGraph.Position.edgeIdentifier`, `.fractionFromStart`) | `EHorizonPosition.getEHorizonGraphPosition()` (`getEdgeId()`, `getPercentAlong()`) |
| edges | `PositionUpdated.startingEdge`, `RoadGraph.Edge.identifier/.level/.probability/.outletEdges` | `EHorizon.getStart()`, `EHorizonEdge.getId()/getLevel()/getProbability()/getOut()` |
| shape | `RoadGraph.edgeShape(edgeIdentifier:)` via `ElectronicHorizonController.roadMatching.roadGraph` | `GraphAccessor.getEdgeShape(Long)` via `MapboxNavigation.graphAccessor` |

Edge ids are unsigned 64-bit integers on both SDKs, so they cross as decimal
strings. A string is assignable to the core `ElectronicHorizonSnapshot.edgeId`
type (`string | number`).

## Capabilities

`MapboxNavigation.capabilities` reports what this binding wires up, not
everything the SDK can do: `activeGuidance`, `rerouting`, `trafficRefresh`
(SDK route refresh is on by default, `RoutingConfig.routeRefreshPeriod` 120 s
on iOS), `predictiveCaching` (`PredictiveCacheConfig()` default on iOS) and
`electronicHorizon` are `true`; `incidents` and `offlineRegions` are `false`
because no incidents config or offline region API is bound.

## Threading

- iOS: the SDK controllers are `@MainActor`. Promise methods use
  `Promise.async { @MainActor in ... }` (Nitro `Promise.async` runs an
  `@isolated(any)` closure in a `Task`), so each call crosses to the main actor
  once. Listener registration happens on the JS thread; `ListenerRegistry`
  guards its dictionary with a lock that is never held while a listener runs.
- Android: SDK classes are `@UiThread`. Promise methods use
  `Promise.async(SharedNavigation.mainScope)` with `Dispatchers.Main.immediate`.
  Callback APIs are wrapped once as suspend functions
  (`MapboxNavigation+awaitRoutes.kt`, `MapboxNavigation+awaitSetRoutes.kt`).

## Tests and what is not verified

- `packages/navigation/typecheck/contracts.ts` fails `tsc` if
  `NavigationProgress`, `ElectronicHorizon`, `NativeNavigationCapabilities` or
  `NavigationManeuver` drift from the core contracts (checked by renaming a
  field and watching `tsc` fail).
- `tests/navigation-replay.test.ts` replays `tests/fixtures/navigation/recorded-drive.json`
  through the JS `NavigationSession` and asserts progress within the fixture's
  tolerance. A device drive should record native `NavigationProgress` events
  for the same route and compare them with the same fields and tolerance; that
  comparison has not been run.

Not verified: any Swift or Kotlin compile; `spm_dependency` resolution in a
real Podfile; whether `com.mapbox.common.location.Location` exposes
`altitude`, `bearing` and `speed` as nullable doubles (the Common SDK is not in
the navigation repository); behaviour of `apply(coreConfig:)` when switching
between live and simulated location in one process; replay on Android without
location permission.
