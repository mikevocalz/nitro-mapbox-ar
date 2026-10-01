# Mapbox data strategy

## What changed from the 2018 project

The historical project already used Mapbox's Raster Tiles API directly; it did
**not** embed the native Mapbox Maps SDK.

The revival keeps that lightweight property for custom AR terrain.

## Lightweight terrain path

For the custom Graphite/WebGPU terrain renderer:

- elevation source: `mapbox.terrain-rgb`
- endpoint: Mapbox Raster Tiles API
- format: `pngraw`
- default tile size: 512px (`@2x`) to reduce request count
- decode: TypeGPU on the shared Graphite device
- fully-ocean Terrain-RGB 404 responses: interpreted as zero elevation

This is still the supported public API route for retrieving raw RGB elevation
tiles.

### Why not fetch Terrain-DEM directly?

Mapbox Terrain-DEM is the newer optimized elevation tileset, but Mapbox
documents it as available through Mapbox SDKs rather than the Raster Tiles API.

So there are two intentionally different modes:

### Custom renderer / light package

Use Terrain-RGB + Raster Tiles API.

Pros:

- no full native map renderer in core;
- small integration surface;
- raw pixels are available to our TypeGPU compute pipeline;
- works naturally with our custom AR terrain renderer.

Tradeoff:

- Mapbox stopped applying elevation data updates to Terrain-RGB after
  December 1, 2021.

### Full Mapbox SDK mode

Use current Mapbox Maps SDK v11 when an app needs:

- Terrain-DEM;
- native MapView;
- Mapbox offline regions/tile store;
- snapshots;
- native style rendering;
- other Mapbox-managed features.

This mode should be optional.

## Versions checked on 2026-10-01

- Mapbox Maps SDK for Android: **11.31.1**
- Mapbox Maps SDK for iOS: **11.31.0**
- `@rnmapbox/maps`: **10.3.5**, supporting Mapbox SDK v11

Android's current SDK offers an NDK 27 artifact, which fits the revived Nitro
native toolchain cleanly.

Do not hard-code those version numbers inside the core runtime. Keep the
optional adapter versioned independently so normal terrain-only apps are not
forced to upgrade a large native mapping dependency whenever this package
changes.

## No Turf/tile-cover in the modern core

The new `tilesForBBox()` code computes XYZ coverage directly for rectangular
Web Mercator bounds, including antimeridian crossing.

That removes the need for Turf, `tile-cover`, and
`@mapbox/sphericalmercator` in the modern path.

Those dependencies remain in `package.json` temporarily only because the
legacy `javascript/` runtime still imports them. They can be removed when the
modern TypeScript entrypoint replaces the 2018 implementation.

## Caching

Mapbox Raster Tiles responses include cache headers. The client also coalesces
identical in-flight satellite requests.

A bounded persistent tile cache belongs in the Nitro service so it can enforce a
byte budget and avoid JS heap pressure. That work is deliberately separate from
this provider PR.
