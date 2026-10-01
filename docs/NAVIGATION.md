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
