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
Mapbox Raster Tiles API
  - Terrain-RGB (raw custom terrain)
  - Satellite imagery
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
                           |
                           v
                 Native / AR host surface
```

An optional Mapbox Maps SDK v11 adapter is a separate path for apps that need
Terrain-DEM, native maps, offline regions, snapshots, or Mapbox-managed style
rendering.

## Why Skia Graphite is the rendering spine

Graphite is the preferred backend because it uses Dawn/WebGPU internally and can share the same native GPU device with react-native-webgpu.

The invariant is: **one Dawn build, one GPU device, no texture copies between WebGPU renderers and Skia**.

```ts
import { Skia } from '@shopify/react-native-skia'
import { importDevice } from 'react-native-webgpu'

const device = importDevice(Skia.getNativeDevice())
```

Graphite is experimental upstream, so it stays behind a renderer capability layer.

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
- legacy terrain generation only during migration

Android Graphite requires API 26+, so capability selection is explicit.

## Mapbox strategy

The core package does **not** require the full Mapbox Maps SDK merely to build
custom AR terrain.

### Core custom-renderer path

- `mapbox.terrain-rgb` through Raster Tiles API
- `mapbox.satellite` through Raster Tiles API
- `pngraw` for elevation tiles
- 512px tiles by default to reduce request count
- TypeGPU elevation decode

Terrain-DEM is newer/optimized but is documented as SDK-only rather than
available through the public Raster Tiles API, so it is not falsely modeled as a
drop-in HTTP replacement.

### Optional native Mapbox path

Use Mapbox Maps SDK v11 / `@rnmapbox/maps` only when the consuming app needs
features that justify the native weight: Terrain-DEM, a native map, offline
regions/tile storage, snapshots, or full style rendering.

## Terrain data flow

1. Normalize a geographic bbox.
2. Select source zoom and tile coverage without Turf/tile-cover.
3. Fetch only required Terrain-RGB tiles.
4. Cache compressed tile bytes.
5. Decode image data onto the shared GPU.
6. Decode elevation with TypeGPU.
7. Keep the heightfield GPU-resident.
8. Generate normals and LOD metadata on GPU.
9. Render terrain directly with WebGPU.
10. Composite terrain + optional Three scene content in Skia Graphite.

### What disappears

- temporary `terrain.obj`
- temporary `wall.obj`
- bitmap stitching on the JS/native bridge path
- re-parsing OBJ geometry in Viro
- multiple CPU↔GPU copies

## Memory / performance rules

- no new mesh every frame;
- bounded LRU tile cache;
- lower LOD while moving, refine when settled;
- geometry and imagery LOD are independent;
- reusable grid/index buffers;
- no large vertex arrays through the old bridge;
- no GPU readback just to feed another renderer;
- coalesce identical in-flight tile requests.

## Three.js role

Three.js is optional and uses `three/webgpu` when present.

It is valuable for imported models, object hierarchies, lighting, animation,
and higher-level scene content. It is not the owner of terrain compute
resources.

## Nitro Modules responsibility

Nitro owns platform-native work that benefits from C++/native services:

- configuration/token handoff;
- bounded disk cache;
- CPU Terrain-RGB fallback;
- platform capability reporting;
- optional native Mapbox integration hooks;
- future platform hooks unavailable from JS.

GPU buffers remain on GPU and do not travel through Nitro per frame.

## Viro / AR integration

Viro owns AR tracking, anchors, placement, and spatial interaction.

The terrain renderer exposes portable GPU surfaces/data so Viro can host or
compose the result without generated OBJ files.

## visionOS / React Vision direction

The public terrain/provider interfaces remain platform-neutral. The C++ Nitro
fallback and Graphite/WebGPU adapter are isolated so a future React Vision target
does not require a terrain rewrite.

Published Graphite binaries should not be assumed to contain visionOS support
until explicitly verified/built in the visionOS spike.
