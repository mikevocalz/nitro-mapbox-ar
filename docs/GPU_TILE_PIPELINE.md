# Encoded Mapbox tile → GPU terrain

This PR closes the gap between the Mapbox HTTP response and the TypeGPU terrain
decoder.

## Pipeline

```
Mapbox Terrain-RGB .pngraw
        |
        | ArrayBuffer (still compressed)
        v
Skia.Image.MakeImageFromEncoded
        |
        | native SkImage
        v
MakeNativeTextureFromImage
        |
        | WGPUTexture pointer on Graphite's device
        v
react-native-webgpu adoptTexture()
        |
        | GPUTexture, same Dawn device
        v
TypeGPU Terrain-RGB compute
        |
        v
Float32 GPU height buffer
```

There is intentionally no:

- `get-pixel`;
- Canvas 2D extraction;
- JS-side RGBA array;
- native bridge pixel serialization;
- PNG rewrite;
- OBJ export;
- GPU readback.

PNG decompression still has to happen somewhere. In this path it happens inside
Skia's native image decoder rather than in JavaScript.

## Lifetime

`GpuTerrainTile.dispose()` destroys:

1. the TypeGPU-produced height buffer;
2. the adopted WebGPU source texture.

The temporary SkImage used for encoded-image decoding is disposed immediately
after its native texture has been created.

## Correctness gate

Terrain-RGB is data, not artwork. The GPU result must be parity-tested against
the existing C++ decoder before the legacy path is removed.

The parity fixture should include:

- known Mapbox RGB triplets with expected meter values;
- a real `pngraw` tile;
- edge values around sea level;
- a fully-water 404 tile;
- height modifiers;
- both 256px and 512px requests.

Do not add visual color correction, sRGB post-processing, filtering, or
premultiplication to the Terrain-RGB compute source. The `pngraw` request is
specifically chosen to preserve the encoded data values.
