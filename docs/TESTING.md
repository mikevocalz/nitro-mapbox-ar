# Testing the revived terrain pipeline

The modern terrain path has two separate correctness gates.

## 1. Host CI

GitHub Actions verifies code that does not require a graphics device:

- strict TypeScript typechecking;
- Web Mercator / antimeridian tile coverage;
- current Mapbox Raster Tiles request semantics;
- ocean 404 handling;
- request coalescing;
- the exact C++ Terrain-RGB elevation codec used by the Nitro CPU fallback.

The C++ codec test compiles as a standalone C++20 binary. This keeps the
elevation math testable without starting React Native or linking Nitro.

## 2. Device GPU parity

The Graphite/WebGPU path must be tested on real graphics hardware because it
depends on Dawn texture adoption and TypeGPU compute.

Before removing the legacy decoder, the device suite must verify:

- RGB triplets immediately below, at, and above sea level;
- a known positive elevation;
- height modifiers;
- 256px and 512px Terrain-RGB tiles;
- a real `.pngraw` fixture;
- fully-ocean 404 behavior;
- exact or epsilon-bounded parity between the TypeGPU result and
  `MapboxARCore.decodeTerrainRgb()`.

No color-space transform, interpolation, premultiplication, or filtering is
allowed on the Terrain-RGB source texture.

## Graphite and visionOS

Graphite is the preferred shared GPU backend because it gives Skia and
`react-native-webgpu` one Dawn device and enables zero-copy texture interop.

As of 2026-10-01, React Native Skia documents Graphite as experimental and its
published platform list does not advertise a visionOS Graphite binary. The
visionOS/React Vision track must therefore remain capability-gated until a
Graphite-enabled visionOS build is validated. Viro/ReactVision's native Metal
renderer remains the XR fallback rather than pretending an unsupported binary
exists.
