# Nitro core

The revived native core is a manually registered C++ Nitro HybridObject.

Why manual C++ instead of generated Swift/Kotlin bindings for this layer:

- terrain fallback math is platform-neutral;
- one implementation covers iOS and Android;
- the same C++ seam can be reused by a future visionOS package;
- large height buffers use Nitro ArrayBuffer directly instead of the legacy React Native bridge;
- GPU buffers still stay on the GPU and do not travel through Nitro.

## Hybrid Object

JS name: `MapboxARCore`

Methods:

- `setAccessToken(token)`
- `getAccessToken()`
- `hasAccessToken()`
- `assertAccessToken()`
- `decodeTerrainRgb(rgba, heightModifier)`

`decodeTerrainRgb` accepts a packed RGBA ArrayBuffer and returns a packed
Float32 ArrayBuffer of elevations in meters. This is the CPU fallback. The
Graphite/WebGPU path will use TypeGPU compute instead.

## Registration

- iOS: Objective-C++ `+load` registers the C++ object with Nitro's
  `HybridObjectRegistry`.
- Android: `NitroMapboxARPackage` loads the C++ library; `JNI_OnLoad`
  registers the same HybridObject.
