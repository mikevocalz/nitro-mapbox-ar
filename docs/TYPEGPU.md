# TypeGPU terrain compute

TypeGPU is used as a typed WebGPU compute layer. It is **not** a second
renderer and it is not allowed to request its own GPU device.

## Shared-device rule

Every terrain compute resource comes from:

```ts
const { device } = getGraphiteWebGPUContext()
const root = tgpu.initFromDevice({ device })
```

The root is cached per imported Graphite device. TypeGPU's
`initFromDevice()` does not own the device, so terrain teardown must destroy
the resources it creates, not Skia's process-lifetime device.

## First compute path: Terrain-RGB

`decodeTerrainRgbOnGpu()` accepts an `rgba8unorm` WebGPU texture and writes
one Float32 elevation per pixel to a storage buffer.

The shader applies Mapbox's Terrain-RGB formula:

```
elevation = -10000 + (R * 256 * 256 + G * 256 + B) * 0.1
```

plus the caller's optional height modifier.

The output never returns to CPU memory. The returned `GPUBuffer` stays on the
shared Graphite device for the future terrain render pipeline.

The C++ Nitro decoder remains the fallback when Graphite/WebGPU is unavailable.

## Why the terrain hot path is not forced through Three.js

Three.js WebGPURenderer is still useful for scene objects, models, lights, and
higher-level materials. It will be added as an optional scene layer.

For terrain generation, however, forcing TypeGPU's existing `GPUBuffer`
through a public Three.js geometry API would currently require either a copy or
relying on renderer internals. That defeats the purpose of this modernization.

The intended split is therefore:

```
Mapbox DEM
   |
TypeGPU compute
   |
raw GPU terrain buffers --------> direct terrain WebGPU pass
                                   |
Three/WebGPU scene (optional) ----+
                                   |
                              shared texture
                                   |
                              Skia Graphite
```

Everything still uses the same Dawn instance/device and is composed by Skia.

## TypeGPU transform requirement

TypeGPU 0.12 shader functions use the `"use gpu"` directive. Applications that
compile this source directly must enable:

```js
plugins: ['unplugin-typegpu/babel']
```

The modern example app will carry that Babel configuration. When the library's
publish/build pipeline is introduced, shader transformation should happen
before published JS is emitted so consumers do not need to know about source
layout.

## Next compute work

The next terrain compute additions should remain separate reviewable commits:

- normal generation;
- optional slope/aspect;
- LOD metadata;
- hillshade/contour passes where useful;
- reusable grid topology and indirect draw metadata.
