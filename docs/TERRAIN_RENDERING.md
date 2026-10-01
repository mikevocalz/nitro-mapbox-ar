# Direct Graphite/WebGPU terrain rendering

The revived terrain renderer deliberately does **not** rebuild the 2018 OBJ
pipeline.

## Data flow

```
Mapbox Terrain-RGB pngraw
        ↓
Skia native image decode
        ↓
Graphite/Dawn texture
        ↓
TypeGPU elevation compute
        ↓
Float32 GPU height buffer
        ↓
WebGPU vertex shader
        ↓
persistent GPU render texture
        ↓
Skia Graphite SkImage (zero-copy)
```

## Bufferless terrain grid

There is no CPU-side position buffer, normal buffer, or index buffer.

The vertex shader derives the terrain cell and triangle corner from
`vertex_index`. It reads height values directly from the TypeGPU-created
storage buffer and derives normals from neighboring samples.

That means changing LOD does not rebuild geometry. A new stride changes only:

- four small grid uniforms;
- the draw vertex count.

A 512×512 height tile renders:

- stride 1: 261,121 cells / 1,566,726 vertices;
- stride 2: 65,536 cells / 393,216 vertices;
- stride 4: 16,384 cells / 98,304 vertices;
- stride 8: 4,096 cells / 24,576 vertices.

The GPU reconstructs positions on demand, so those vertex counts do **not**
represent uploaded vertex payloads.

## Real-world scale

Horizontal spacing is derived from the XYZ tile center latitude, zoom, and the
actual decoded tile width. A 512px `@2x` response therefore gets half the
meters-per-pixel of a 256px response for the same geographic tile.

Elevation stays in meters. `heightScale` is a presentation-only multiplier for
miniature/tabletop terrain.

## Compositing

The terrain pass renders into one persistent WebGPU texture created on Skia
Graphite's imported Dawn device. `Skia.Image.MakeImageFromNativeTexture`
wraps that texture as an SkImage without a CPU copy.

The renderer returns a fresh SkImage after each render. Dispose the previous
SkImage after replacing it, and keep the terrain tile and renderer alive while
an image still references the render target.

## Why not Three.js for the terrain itself?

Three.js remains useful for models, POIs, effects and scene composition, but the
terrain height field is already a GPU storage buffer. Keeping the terrain pass
in raw WebGPU avoids converting or copying that storage just to satisfy another
geometry abstraction.

## Next

The next rendering layers should add:

1. satellite/Standard imagery sampling;
2. frustum/distance-driven LOD selection;
3. skirts or neighbor-aware edge stitching between different LODs;
4. Viro/ReactVision camera + pose synchronization;
5. shared depth/occlusion integration where the target runtime exposes it.
