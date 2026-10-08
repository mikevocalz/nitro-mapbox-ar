# Nitro Mapbox AR

A revival of Mapbox's original React Native AR terrain experiment, rebuilt around Nitro Modules, Skia Graphite, WebGPU, TypeGPU, modern Mapbox SDKs, and ReactVision.

> Status: active modernization. The obsolete 2018 runtime has been removed from the active tree; its implementation remains preserved in Git history.

## Architecture

The revived stack is **Graphite-first**:

- **Skia Graphite** owns the preferred shared Dawn device and acts as the compositor.
- **react-native-webgpu** exposes that Dawn/WebGPU device and zero-copy native texture interop.
- **TypeGPU** handles typed Terrain-RGB compute on the shared device.
- **Raw WebGPU** renders the terrain directly from the GPU height field; it does not rebuild OBJ/glTF meshes.
- **Nitro Modules** provides the JSI-native service layer and CPU fallback path.
- **Mapbox Terrain-RGB Raster Tiles** power the lightweight custom terrain renderer.
- The full native **Mapbox Maps SDK v11** lives in the optional `@mikevocalz/nitro-mapbox-ar-maps` package.
- **ReactVision/Viro 3.x** lives in the optional `@mikevocalz/nitro-mapbox-ar-reactvision` package for geospatial AR/XR anchors and route projection.

The renderer boundary stays platform-neutral so Graphite/WebGPU can be used wherever the underlying runtime supports the required Dawn device, while ReactVision provides the native spatial host on iOS, Android, Quest, visionOS and web.

## Lightweight core

The modern core no longer requires the 2018 GIS helper stack:

- `@mapbox/sphericalmercator`
- `@mapbox/tile-cover`
- Turf bbox/midpoint helpers

Web Mercator tile coverage and bbox handling are implemented in the modern TypeScript core without those runtime dependencies.

The npm package uses a strict `files` allowlist, and CI rejects any reintroduction of the old Objective-C/Java terrain generators, OBJ exporters, demo app, or `javascript/` runtime into the published payload.

## Optional packages

### Native Mapbox map

`@mikevocalz/nitro-mapbox-ar-maps`

A Nitro HybridView over the current Mapbox Maps SDK v11. It is optional so apps that only need terrain/AR primitives do not carry the full Maps SDK.

### ReactVision spatial bridge

`@mikevocalz/nitro-mapbox-ar-reactvision`

Connects Mapbox coordinates/routes to ReactVision/Viro geospatial tracking and anchors without routing large terrain geometry through Viro. It also exports `MapboxViroRoute`, which projects Mapbox route coordinates and renders bounded `ViroPolyline` chunks.

## Current rendering path

```text
Mapbox Terrain-RGB pngraw
        ↓
Skia native decode
        ↓
shared Graphite / Dawn texture
        ↓
TypeGPU elevation compute
        ↓
GPU-resident Float32 height field
        ↓
direct WebGPU terrain draw
        ↓
shared Graphite texture / Skia compositor
        ↓
ReactVision spatial scene where applicable
```

No GPU → CPU readback, temporary OBJ file, CPU vertex buffer, or Viro OBJ parse is required on the modern terrain path.

## Reference app

The modern replacement for the 2018 demo is the [reference app](docs/REFERENCE_APP.md), with source in `examples/reference-app`.
It exposes Map, Navigate, AR and Agent modes and stays on Expo SDK 57 / React
Native 0.86 while the ReactVision peer range is validated against newer React
Native releases.

See [Migration guide](docs/MIGRATION.md).

## Development docs

- [Revival architecture](docs/ARCHITECTURE.md)
- [PR-by-PR revival plan](docs/REVIVAL_PLAN.md)
- [Graphite integration](docs/GRAPHITE.md)
- [Terrain rendering](docs/TERRAIN_RENDERING.md)
- [Testing](docs/TESTING.md)

## Legacy source

The repository began as the Mapbox Augmented Reality SDK for React Native beta in 2018, written at Mapbox by Nick Italiano with Dave Prukop. The obsolete React Native 0.50 / react-viro 2.x runtime and demo projects have been removed from the active tree. Their useful algorithms remain preserved in Git history and are mapped to modern replacements in [Legacy 2018 implementation](docs/LEGACY_2018.md).

## License

MIT
