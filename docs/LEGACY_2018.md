# Legacy Mapbox AR implementation

The active branch no longer carries the 2018 React Native / react-viro runtime.

The original implementation remains preserved in Git history. Useful historical
reference points include:

- `0cf7db839dfa6dc8a43d4aaf3dccd58854a59f7b` — Android/JS terrain mesh generation.
- `359e1299b55b3fa61207088b7f13137f0e3ae2cf` — final 2018 JavaScript terrain/demo updates.
- `e6c3b49ae08f5572dbf059deeaadb685d510484b` — final 2018 iOS TerrainService update.

## What the old implementation did

The original path selected Mapbox Terrain-RGB tiles for a bounding box,
stitched/de-sampled the bitmap on CPU, decoded elevations, generated terrain and
wall geometry, exported OBJ files to the filesystem, and loaded those OBJ files
into Viro with `Viro3DObject`.

That architecture was valuable as the proof of concept, but it is not the
runtime used by Nitro Mapbox AR.

## Where the useful ideas moved

| 2018 concern | Modern implementation |
| --- | --- |
| Terrain-RGB elevation formula | `src/terrain/gpu/terrainRgb.ts` |
| Web Mercator tile selection | `src/mapbox/tiles.ts` |
| Terrain mesh generation | `src/terrain/gpu/*` direct WebGPU renderer |
| Satellite imagery | `src/terrain/gpu/imagery.ts` |
| Viro placement | `packages/reactvision/src/bridge.ts` |
| Route projection | `packages/reactvision/src/route.ts` |
| Route rendering | `packages/reactvision/src/MapboxViroRoute.tsx` |

The active implementation avoids the old bitmap -> CPU geometry -> OBJ ->
filesystem -> Viro parser roundtrip. Git history remains the archive when an old
algorithm or implementation detail needs to be inspected.
