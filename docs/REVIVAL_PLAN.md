# Revival PR Plan

The repository has been dormant since 2018. The work is intentionally split into small PRs so regressions can be isolated and each architectural layer can be reviewed on its own.

## PR 1 — Architecture and migration contract

- document Graphite-first renderer architecture
- define Nitro responsibilities
- define lightweight Mapbox data strategy
- define performance constraints
- define visionOS / React Vision compatibility boundary
- document the stacked PR sequence

No runtime behavior changes.

## PR 2 — Modern package shell

- TypeScript source tree
- modern package exports
- React Native 0.86 / React 19 peer range
- Node/tooling refresh
- test/lint/typecheck scripts
- preserve a compatibility export for the legacy package API where practical
- move the 2018 implementation under `legacy/` instead of deleting it

Goal: make the project buildable and maintainable before replacing native code.

## PR 3 — Nitro Modules bridge

- add `react-native-nitro-modules`
- add Nitrogen config/spec
- replace `NativeModules.MapboxARModule`
- add a Nitro native service for:
  - configuration/token handoff
  - cache paths/metadata
  - CPU terrain decode fallback
  - capability reporting
- remove old `RCTBridgeModule` APIs after parity tests

Goal: no legacy React Native bridge for core services.

## PR 4 — Skia Graphite + shared WebGPU device

- add Graphite build as the preferred renderer
- add `react-native-webgpu`
- implement shared Dawn device bootstrap
- add renderer capability detection
- add zero-copy WebGPU texture → SkImage composition
- add device/version mismatch diagnostics
- retain a fallback backend

Goal: one GPU device and zero-copy composition.

## PR 5 — TypeGPU terrain compute

- add TypeGPU
- Terrain-DEM / Terrain-RGB decode compute
- GPU heightfield creation
- GPU normals
- reusable index buffers
- chunked terrain LOD
- benchmark against legacy OBJ pipeline

Goal: remove CPU bitmap stitch + OBJ generation from the hot path.

## PR 6 — Three.js WebGPU terrain renderer

- use `three/webgpu`
- render terrain from GPU buffers
- render into a texture owned by the Skia Graphite device
- imagery/material pipeline
- frustum culling and LOD
- lifecycle/disposal tests

Goal: modern portable 3D layer with no OpenGL-specific assumptions.

## PR 7 — Mapbox data/provider modernization

- current Terrain-DEM provider
- current Raster Tiles API provider
- satellite imagery provider
- cancellation, retries, request coalescing
- memory/disk LRU
- configurable request budget
- optional `@rnmapbox/maps` v11 adapter, not a core dependency

Goal: current Mapbox APIs without forcing the full Maps SDK into every AR app.

## PR 8 — Modern example app

- rebuild demo on current React Native generation / Expo development build
- Yosemite/Tahoe terrain examples
- performance overlay
- backend switcher (Graphite/WebGPU vs Nitro fallback)
- cache inspector
- Viro AR placement example

Goal: reproducible device testbed.

## PR 9 — Viro integration

- eliminate OBJ requirement
- add native GPU/texture integration path where possible
- preserve AR anchors, gestures, placement, lighting
- add terrain placement and scale controls
- regression tests on iOS/Android

Goal: restore the original AR use case using the new renderer.

## PR 10 — React Vision / visionOS spike

- add React Vision target branch/example
- confirm Nitro build support
- confirm Skia Graphite/Dawn build availability for visionOS
- confirm WebGPU surface/texture path
- test Viro visionOS renderer integration
- document any upstream forks/patches required

Goal: validate future Apple Vision Pro support without compromising iOS/Android.

## Merge discipline

Each PR should:

- be independently buildable from its declared base;
- include tests for the layer it changes;
- avoid drive-by rewrites outside scope;
- include before/after performance data for performance-sensitive changes;
- keep public API changes documented;
- avoid adding heavyweight native dependencies to core unless optional.

## Performance acceptance targets

The exact numbers will be measured on the example app, but the modernization should demonstrate:

- no OBJ write/read round trip on the GPU path;
- no large vertex arrays crossing the legacy bridge;
- bounded tile cache memory;
- no per-frame terrain allocations after warmup;
- terrain generation that does not block interaction;
- stable renderer teardown with no leaked GPU resources;
- backend fallback when Graphite/WebGPU is unavailable.
