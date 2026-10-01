# GPU satellite imagery

The custom terrain renderer can sample Mapbox satellite imagery without adding
the native Mapbox Maps SDK to the core package.

## Pipeline

```text
Mapbox satellite tile (WebP/JPEG)
        ↓
Skia.Image.MakeImageFromEncoded
        ↓
Graphite native texture
        ↓
react-native-webgpu adoptTexture
        ↓
terrain fragment shader textureSample()
```

No JS-side RGBA array or CPU bitmap copy is created.

`loadSatelliteTileOnGpu()` uses the existing lightweight
`MapboxRasterClient` and returns a GPU-resident texture with explicit
`dispose()` semantics.

## Terrain renderer integration

Pass the loaded imagery when creating the terrain surface renderer:

```ts
const imagery = await loadSatelliteTileOnGpu(client, tile)

const renderer = createTerrainSurfaceRenderer(terrain, {
  targetWidth: 1024,
  targetHeight: 1024,
  imagery,
})
```

The renderer borrows the imagery texture and does not dispose it.

At draw time `imageryOpacity` blends between the base terrain color and the
satellite albedo. If imagery is present and no base color is supplied, the
renderer defaults to white so the satellite colors are not tinted.

## Why this stays separate from the native Mapbox map

The lightweight terrain path is useful for AR/tabletop/XR scenes that need
terrain and imagery but not the full interactive Mapbox map runtime.

The optional native-map package remains the right path for Mapbox Standard,
Standard Satellite, native gestures, labels, offline map UX and the rest of the
full Maps SDK feature set.
