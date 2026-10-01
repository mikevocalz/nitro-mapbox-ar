# Skia Graphite + React Native WebGPU

The preferred Nitro Mapbox AR rendering backend is Skia Graphite sharing one
Dawn device with `react-native-webgpu`.

## Why this is the default architecture

The legacy implementation performs terrain work on the CPU, writes OBJ files,
then asks the scene renderer to parse and upload those files again.

The Graphite path keeps geometry and render targets on the GPU:

```
Skia Graphite owns wgpu::Device
          |
          +--> react-native-webgpu importDevice()
                         |
                         +--> TypeGPU compute
                         |
                         +--> Three.js WebGPURenderer
                                      |
                                      v
                               persistent texture
                                      |
                                      v
                    MakeImageFromNativeTexture()
                                      |
                                      v
                              Skia composition
```

The important constraints are **one Dawn copy** and **one Graphite device**.

## Current compatible milestone

This repository's first Graphite implementation targets:

- Skia Graphite milestone: **m154**
- shared Dawn tag: **dawn-chrome-m154**
- `react-native-webgpu`: **0.10.x**

Do not mix a Graphite build from another Skia milestone with WebGPU 0.10.x.

Run:

```sh
npm run check:gpu-stack
```

The check intentionally fails for:

- a normal Ganesh Skia package;
- a Graphite package with no Dawn marker;
- a WebGPU package using a different Dawn milestone.

Native Skia and react-native-webgpu also contain their own build-time guards,
but this script makes the problem visible before a long native build.

## npm channel caveat

Graphite is still a preview upstream. The public stable Skia package remains a
Ganesh build. At the time this revival started, Skia's repository had already
moved its Graphite build to m154, but the public `@next` dist-tag lagged behind
that source state.

For that reason this repository does not pretend that a stale `@next` package
is compatible. Use an m154 Graphite package/source build, then switch to the
official next-channel package as soon as the m154 release is published.

The library keeps the renderer behind a capability boundary so a stable Ganesh
installation can still fall back to WebGPU-only or Nitro CPU operation.

## Runtime bootstrap

`getGraphiteWebGPUContext()` does exactly one device import:

```ts
const nativeDevice = Skia.getNativeDevice()
const device = importDevice(nativeDevice)
```

The imported device is cached for process lifetime. Do not substitute a device
created separately via `navigator.gpu.requestDevice()` for resources that need
zero-copy Skia interop.

## Zero-copy texture path

A texture created on the shared device can be wrapped directly:

```ts
const image = Skia.Image.MakeImageFromNativeTexture(texture.nativePointer)
```

The texture remains the owner of the borrowed pointer. Keep the `GPUTexture`
alive while an `SkImage` references it, and dispose old SkImage wrappers when
frames are replaced.

No `readPixels`, PNG encoding, bridge serialization, or CPU upload belongs in
this path.

## Android

Graphite support should be treated as an API 26+ backend. The package's Nitro
CPU fallback can remain available below that level during migration.

## visionOS / React Vision

The architecture is deliberately neutral about the React Native platform:

- terrain provider interfaces are TypeScript;
- CPU fallback is C++;
- Graphite/WebGPU is behind an adapter;
- Viro owns AR tracking/anchors rather than the terrain renderer.

That gives us a clean React Vision target later.

It does **not** mean the currently published Skia Graphite binaries already ship
a visionOS slice. A future visionOS PR must first confirm or build matching
Graphite + Dawn binaries for visionOS, then reuse this same device/texture
contract.
