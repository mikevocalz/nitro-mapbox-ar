# Nitro Mapbox AR — Revival Architecture

## Goal

Revive the original Mapbox AR experiment as a modern React Native terrain/AR toolkit that is fast on current iOS and Android devices, keeps the core package small, and can evolve toward React Vision / visionOS without another renderer rewrite.

The original 2018 implementation does three expensive things that we should no longer keep as the primary path:

1. React Native bridge calls for terrain generation.
2. CPU-side bitmap stitching and elevation decoding.
3. OBJ file generation followed by a second parse/upload into the 3D renderer.

The revived architecture replaces that pipeline with GPU-native buffers and textures.

## Rendering stack

```
Mapbox Raster Tiles / Terrain-DEM
              |
              v
      Tile provider + cache
              |
              v
 TypeGPU / WebGPU compute pipeline
  - Terrain-RGB decode
  - heightfield generation
  - normals / LOD metadata
              |
              +--------------------------+
              |                          |
              v                          v
 direct WebGPU terrain pass       Three.js WebGPU scene
                                  (models/objects, optional)
              |                          |
              +------------+-------------+
                           v
                 shared WebGPU texture
                           |
                    zero-copy wrap
                           |
                           v
                Skia Graphite compositor
  - map texture composition
  - labels / HUD / masks
  - post effects / overlays
                           |
                           v
                 Native / AR host surface
  - iOS / Android now
  - Viro integration
  - React Vision target later
```

The terrain hot path does not require Three.js. Three is an optional high-level
scene layer for content where its object/material ecosystem is useful. This
avoids copying TypeGPU-created terrain buffers into a renderer-owned geometry
allocation or coupling the package to private Three.js backend internals.

## Why Skia Graphite is the rendering spine

Graphite is the preferred backend because it uses Dawn/WebGPU internally and can share the same native GPU device with react-native-webgpu.

The important invariant is: **one Dawn build, one GPU device, no texture copies between WebGPU renderers and Skia**.

The runtime adapter obtains the WebGPU device from Skia whenever Graphite is active:

```ts
import { Skia } from '@shopify/react-native-skia'
import { importDevice } from 'react-native-webgpu'

const device = importDevice(Skia.getNativeDevice())
```

Graphite is experimental upstream, so it stays behind a renderer capability layer. It is the preferred backend, not a hard-coded assumption in public APIs.

## Backend policy

### Preferred

- Skia Graphite
- react-native-webgpu
- TypeGPU for typed WGSL and terrain compute
- direct WebGPU terrain rendering
- Three.js WebGPURenderer as an optional scene layer

### Fallback

- Nitro HybridObject CPU terrain decoder / mesh builder
- non-Graphite Skia where a 2D fallback is appropriate
- legacy terrain generation only during migration; remove once parity tests pass

Android Graphite requires API 26+, so the capability check must happen at runtime/build configuration level rather than forcing every consumer onto one backend.

## Nitro Modules responsibility

Nitro is not used to shuttle every vertex through JSI. GPU work should stay on the GPU.

Nitro owns the platform-specific pieces that benefit from native code:

- token/configuration handoff when native Mapbox APIs are enabled
- disk cache and cache metadata
- CPU Terrain-RGB / Terrain-DEM fallback decoding
- CPU mesh fallback
- platform capability reporting
- optional native Mapbox SDK adapter
- future platform hooks that are not available from JavaScript

The public JS API talks to a small service interface so WebGPU and Nitro implementations can be selected without changing app code.

## Mapbox strategy

The core package should **not** require the full Mapbox Maps SDK just to render AR terrain.

The original package already consumed Mapbox raster endpoints directly. The revival keeps that lightweight model but updates it around current Mapbox terrain/satellite products:

- Mapbox Terrain-DEM for elevation data
- Mapbox Raster Tiles API for raster imagery
- Mapbox Satellite when imagery is requested

A native Mapbox Maps SDK v11 adapter is optional for apps that also need native maps, offline regions, snapshots, or Mapbox-managed tile storage.

This avoids making every AR-only consumer pay the binary-size and initialization cost of a complete native map renderer.

## Terrain data flow

1. Normalize a geographic bbox.
2. Select zoom and tile coverage.
3. Fetch only required DEM tiles.
4. Cache compressed tile bytes.
5. Decode elevation on the shared GPU using TypeGPU/WebGPU when available.
6. Keep the heightfield GPU-resident.
7. Generate normals and LOD metadata on GPU.
8. Bind imagery separately from height data.
9. Render terrain directly with WebGPU; render optional models/scene content with Three.js WebGPU.
10. Composite GPU render targets inside Skia Graphite.

### What disappears

- temporary `terrain.obj`
- temporary `wall.obj`
- bitmap stitching on the JS/native bridge path
- re-parsing OBJ geometry in Viro
- multiple CPU↔GPU copies

## Memory / performance rules

- Do not allocate a new mesh for every frame.
- Keep height, normal, index, and texture resources resident while a terrain region is active.
- Use an LRU tile cache with a configurable byte budget.
- Decode only visible/needed tiles.
- Prefer 512px imagery where it reduces request count.
- Use lower LOD while moving and refine when camera movement settles.
- Separate terrain geometry LOD from imagery LOD.
- Reuse index buffers across same-sized grid patches.
- Keep render loops off the main JS thread when practical.
- Never serialize large vertex arrays through the old React Native bridge.
- Never read TypeGPU terrain buffers back to CPU merely to feed another renderer.

## Three.js role

Three.js is optional and uses `three/webgpu` when present.

It is valuable for imported models, object hierarchies, lighting, animation, and
higher-level scene content. It is not the owner of terrain compute resources.

Three.js should render using the same shared Graphite WebGPU device and into a
texture that Skia can wrap without copying. No separate device should be
requested for zero-copy content.

## TypeGPU role

TypeGPU is used where it adds concrete value:

- Terrain-RGB / Terrain-DEM decode compute
- heightfield generation
- height exaggeration transforms
- normal generation
- optional contour/hillshade compute
- culling/LOD metadata generation

It is not another renderer. It is a typed WebGPU authoring layer over the shared device.

## Viro / AR integration

The revived package must not depend on a single AR scene engine.

Expose portable terrain data and renderer surfaces so Viro can host the terrain now while the rendering core remains reusable.

For Viro integrations:

- AR anchoring and world tracking remain Viro responsibilities.
- Terrain rendering can be a GPU texture/panel or a Viro-native geometry adapter depending on platform capabilities.
- No generated OBJ files should be required by the modern path.

## visionOS / React Vision direction

React Vision provides a React Native visionOS platform and Viro has a visionOS renderer path. The package therefore avoids iOS-only assumptions in its JS surface.

However, React Native Skia's distributed Graphite binaries should not be treated as guaranteed visionOS support today. The visionOS target is a future compatibility track:

1. keep platform-neutral renderer and terrain interfaces now;
2. keep Graphite/Dawn isolated behind an adapter;
3. add a dedicated visionOS build/adapter when upstream Skia/WebGPU binary support is confirmed or a maintained fork is available;
4. use React Vision for the RN platform target and Viro for spatial tracking/scene integration.

## Public API target

```ts
const client = createMapboxAR({
  accessToken,
  renderer: 'auto',
  cache: {
    memoryBytes: 96 * 1024 * 1024,
    diskBytes: 512 * 1024 * 1024,
  },
})

const terrain = await client.terrain.load({
  bbox,
  imagery: 'satellite',
  exaggeration: 1,
  quality: 'balanced',
})

terrain.dispose()
```

`renderer: 'auto'` prefers Graphite/WebGPU, then falls back to Nitro CPU.

## Compatibility target

Initial revival target:

- React Native 0.86 generation for the first React Vision-compatible example line
- React 19
- iOS 16+
- Android API 26+ for Graphite path
- New Architecture
- Nitro Modules
- Expo development builds supported by the example app
- no Expo Go requirement

The package itself remains usable outside Expo.
