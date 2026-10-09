# @mikevocalz/nitro-mapbox-ar-navigation

Optional native trip sessions for Nitro Mapbox AR, backed by the Mapbox
Navigation SDK v3. Install it when an app needs turn-by-turn progress from
device location, rerouting, the electronic horizon, or a replayed drive.
Route planning alone does not need it: the core package's `NavigationSession`
calls the Directions API from JS.

## Native SDK baseline

| Platform | Artifact | Default | Override |
| --- | --- | --- | --- |
| iOS | `MapboxNavigationCore` (Swift Package, linked with `spm_dependency`) | 3.32.0 | `NITRO_MAPBOX_AR_NAVIGATION_VERSION` |
| Android | `com.mapbox.navigationcore:navigation-ndk27` | 3.32.0 | root ext `NitroMapboxARNavigationVersion` |

Both pin Mapbox Maps 11.32.0, the version `@mikevocalz/nitro-mapbox-ar-maps`
uses. Nitro Modules / Nitrogen 0.37.1.

## Setup

- The access token is `MapboxAR.accessToken` from `@mikevocalz/nitro-mapbox-ar`;
  set it before `createTripSession`.
- **Android needs a Mapbox secret download token** (scope `DOWNLOADS:READ`) to
  fetch the Navigation SDK from `api.mapbox.com/downloads/v2/releases/maven`.
  Put it in `~/.gradle/gradle.properties` as `MAPBOX_DOWNLOADS_TOKEN=...` or
  export `MAPBOX_DOWNLOADS_TOKEN` in CI. Never commit it.
- iOS: the SDK is a Swift package. React Native adds it to the Pods project in
  `post_install`; Xcode resolves it from GitHub. `USE_FRAMEWORKS=dynamic` is
  recommended (React Native warns about static linking of Swift packages).
- Device trips need location permission; request it before calling
  `createTripSession`.

## Use

```ts
import { MapboxNavigationClient } from '@mikevocalz/nitro-mapbox-ar/navigation'
import { MapboxNavigation } from '@mikevocalz/nitro-mapbox-ar-navigation'

const { response, requestUrl } = await client.directionsWithRequestUrl(stops)
const trip = await MapboxNavigation.createTripSession({ locationSource: 'device' })
const sub = trip.addOnProgressListener((progress) => store.setProgress(progress))
await trip.setRoutes({ responseJson: JSON.stringify(response), requestUrl })
// later
sub.remove()
await trip.stop()
```

`requestUrl` carries the access token. Do not log it.

To keep one API for both paths, pass
`createNativeNavigationProvider(MapboxNavigation, options)` as the
`nativeProvider` of a core `NavigationSession`.

See `docs/NAVIGATION.md` (which path to use) and `docs/NATIVE_NAVIGATION.md`
(SDK symbols this package binds) in the repository.
