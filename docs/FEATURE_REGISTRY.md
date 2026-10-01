# Feature and preview registry

The SDK now keeps current Mapbox/renderer feature maturity in one explicit
registry instead of scattering preview assumptions throughout the codebase.

## Stable but opt-in Mapbox Standard features

- `standard-indoor`: supported-airport indoor maps via `showIndoor`
- `standard-hd-roads`: lane-level road markings and 3D road infrastructure
  via `showHdRoads`

They are stable product features but remain opt-in because they can materially
change style density and GPU workload.

## Preview/gated features

- Android Vulkan renderer — Public Preview
- Navigation UX Framework — Public Preview
- Electronic Horizon — Public Beta
- Optimization v2 — Public Beta
- EV Routing — Private Preview
- Mapbox Agent Toolkit — Public Preview/request access
- Graphite on visionOS — host validation

No preview feature is default-enabled.
