# Navigation and traffic

The core package keeps routing lightweight by calling Mapbox Navigation Service
APIs directly.

## Core path

`MapboxNavigationClient` supports:

- Directions API routes with full GeoJSON geometry;
- traffic-aware `driving-traffic` routing by default;
- distance, duration, speed, congestion, numeric congestion and closure
  annotations;
- alternatives and turn steps;
- Map Matching for noisy GPS traces.

`summarizeRouteTraffic()` derives a compact traffic snapshot without
fabricating values for segments that Mapbox did not report.

## Progress without a native SDK

`NavigationSession.updateLocation({ location, bearing?, speedMetersPerSecond? })`
computes progress for the active route in JS and returns a
`NavigationProgressSnapshot`; `progress()` then reports it. The fix is
projected onto the nearest point of the route's GeoJSON geometry.
`fractionTraveled` is the distance along the line to that point over the
line's length, remaining distance and duration scale the route totals by the
untravelled share (constant speed assumed), and leg and step indexes come
from the legs' and steps' share of `route.distance`. There is no off-route
detection and no rerouting.

`tests/navigation-replay.test.ts` replays a recorded drive
(`tests/fixtures/navigation/recorded-drive.json`) through this path and checks
every fix against closed-form expected values: within 0.002 of
`fractionTraveled`, 2 m of `distanceRemaining`, 0.5 s of `durationRemaining`,
and exact leg and step indexes.

## Which path to use

| Need | Use |
| --- | --- |
| Plan routes, draw them, project them into AR; web, Lens Studio, Meta Quest tabletop | `NavigationSession` + `MapboxNavigationClient` from the core package. No native SDK, no download token |
| Progress from your own location source, or replaying a drive in tests | `NavigationSession.updateLocation` |
| Map-matched progress from device GPS, rerouting, the electronic horizon, SDK replay | `MapboxNavigation.createTripSession` from `@mikevocalz/nitro-mapbox-ar-navigation` (iOS and Android only) |
| One API for both | `NavigationSession` with `nativeProvider: createNativeNavigationProvider(MapboxNavigation, options)`; `planRoute` passes the request URL the native SDK needs |

The native package adds the Navigation SDK binary to the app and, on Android,
needs a Mapbox secret download token at build time. `docs/NATIVE_NAVIGATION.md`
lists the SDK versions and every symbol it binds.

## Native capability boundary

Full mobile navigation remains optional through `NativeNavigationProvider`.
That boundary represents features that belong to the native Navigation SDK,
including:

- active guidance and live rerouting;
- route/traffic refresh;
- incidents;
- predictive caching and offline regions;
- Electronic Horizon.

Keeping those capabilities out of the core dependency graph prevents the
terrain/AR package from forcing the complete Navigation SDK into every app.
