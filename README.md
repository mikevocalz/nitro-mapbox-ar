# Nitro Mapbox AR

A revival of Mapbox's original React Native AR terrain experiment, rebuilt around Nitro Modules, Skia Graphite, WebGPU, TypeGPU, and a portable terrain pipeline.

> Status: active modernization. The original 2018 implementation is still present while the new stack lands in small, reviewable PRs.

## Direction

The new architecture is **Graphite-first**:

- **Skia Graphite** is the compositor and shared GPU-device owner.
- **react-native-webgpu** supplies WebGPU/Dawn access.
- **Three.js WebGPURenderer** renders 3D terrain using `three/webgpu`.
- **TypeGPU** handles typed compute work such as elevation decode and normal generation.
- **Nitro Modules** replaces the legacy React Native bridge and provides native/cache/CPU fallback services.
- **Mapbox Terrain-DEM / Raster Tiles APIs** remain the lightweight data source.
- The full native **Mapbox Maps SDK v11** is optional rather than a mandatory core dependency.
- **Viro** remains the AR/spatial host integration target.

The renderer boundary is intentionally platform-neutral so a future React Vision / visionOS target can be tested without rewriting terrain logic.

See:

- [Revival architecture](docs/ARCHITECTURE.md)
- [PR-by-PR revival plan](docs/REVIVAL_PLAN.md)

## Legacy project

The repository began as the Mapbox Augmented Reality SDK for React Native beta in 2018. The existing `javascript/`, `ios/`, `android/`, and `RNMapboxARDemo/` trees are the historical implementation and will be migrated incrementally rather than replaced in one unreviewable commit.

## License

MIT
