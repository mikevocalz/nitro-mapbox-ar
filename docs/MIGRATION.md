# Migration from the 2018 SDK

## Package/runtime

Old:
- React Native 0.50
- `NativeModules.MapboxARModule`
- `react-viro` 2.5
- Mapbox v4 raster URLs
- Objective-C/Java terrain services

New:
- React Native 0.86+ core target
- Nitro Modules C++ service fallback
- ReactVision/Viro 3.x optional spatial adapter
- current Mapbox Raster/Search/Navigation services
- optional Mapbox Maps SDK v11 HybridView

## Terrain

Old:
`Terrain-RGB -> Bitmap stitch -> CPU geometry -> OBJ -> filesystem -> Viro OBJ parser`

New:
`pngraw -> Skia Graphite decode -> shared Dawn texture -> TypeGPU height field -> direct WebGPU draw`

No OBJ/filesystem roundtrip exists in the modern path.

## Web

Nitro is not emulated in the browser.

- native: Graphite/WebGPU -> WebGPU -> Nitro C++ CPU
- web: browser WebGPU -> typed JS CPU fallback

The browser entrypoint excludes native Nitro/Graphite imports.

## Search/navigation

Use Search Box, Geocoding v6 entrances, Directions/Map Matching, and an optional
NativeNavigationProvider for live guidance/offline/Electronic Horizon.
