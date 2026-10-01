# Direct GPU terrain rendering

PR #9 removes the last reason for the modern terrain path to generate a mesh on
the CPU.

## Pipeline

```text
Mapbox Terrain-RGB pngraw
        ↓
Skia native image decode
        ↓
Graphite / Dawn GPU texture
        ↓
TypeGPU height decode
        ↓
GPUBuffer<float> heights
        ↓
WebGPU vertex_index terrain shader
        ↓
Graphite-compatible color texture
        ↓
Skia / spatial compositor
```

There is no OBJ, glTF, temporary mesh file, CPU vertex array, or CPU normal
generation in this path.

## Vertex generation

The draw uses a triangle list with six logical vertices per terrain cell.
`@builtin(vertex_index)` derives:

- the terrain cell;
- the triangle corner;
- the source Terrain-RGB texel;
- the local X/Z position;
- the UV.

Only the height field exists as a GPU buffer.

## Normals

Normals are reconstructed in the vertex shader from neighboring height samples.
The shader uses central differences where possible and clamps at tile edges.

This means changing LOD does not require a normals rebuild.

## LOD

`lodStride` controls how many source texels each rendered cell spans.

Examples for a 512×512 height field:

- stride 1: 511×511 cells;
- stride 2: 256×256 cells;
- stride 4: 128×128 cells;
- stride 8: 64×64 cells.

The final source row/column is always included by clamping the last cell to the
tile edge.

This PR deliberately exposes stride instead of inventing a distance heuristic.
A later spatial-camera PR can choose stride from projected screen error, device
class, thermal state, or XR distance without changing the renderer.

## Graphite composition

`createTerrainRenderTarget()` allocates the color/depth textures on the same
Graphite/Dawn device used by Skia.

After rendering, the color texture can be passed directly to
`makeSkiaImageFromWebGPUTexture()` without a GPU→CPU readback.

That is the key path for:

- Skia HUD/compositing;
- React Native WebGPU scenes;
- later Viro/ReactVision texture integration;
- future visionOS work once a validated Graphite-enabled Skia build exists.

## Lifetime

The renderer owns only its uniform buffers and pipeline state.

The caller still owns:

- the `GpuTerrainTile` and its height/source textures;
- any render targets;
- any Skia image created from the target texture.

Dispose those resources independently.
