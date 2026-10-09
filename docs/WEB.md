# Web fallback architecture

Nitro Modules is the native fast path. The web build does not attempt to
emulate Nitro or load native Mapbox SDK binaries.

## Browser entrypoint

The package publishes a browser-specific entrypoint that excludes:

- `react-native-nitro-modules` runtime imports;
- Skia Graphite native-device imports;
- native Mapbox Maps views;
- native GPU tile-residency/rendering modules.

The browser entrypoint keeps the provider-neutral features:

- Mapbox raster/data APIs;
- tile and bbox math;
- Search Box and Geocoding v6;
- Directions and Map Matching;
- NavigationSession;
- SpatialAgentRuntime.

## Terrain fallback

`MapboxAR` in `src/native/MapboxAR.web.ts` implements the same Terrain-RGB formula in typed JavaScript.
It is the final CPU fallback when browser WebGPU is unavailable.

The order on web is:

1. browser WebGPU when a browser renderer is installed;
2. JS CPU Terrain-RGB fallback.

The order on native remains:

1. Skia Graphite + shared Dawn/WebGPU;
2. WebGPU;
3. Nitro C++ CPU fallback.

This keeps the browser bundle independent from Nitro while preserving the same
public service contracts.
