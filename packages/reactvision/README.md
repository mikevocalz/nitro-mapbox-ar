# @mapbox/react-native-mapbox-ar-reactvision

Optional spatial adapter between Nitro Mapbox AR data and
`@reactvision/react-viro` 3.0.2.

## What this package does

It connects geographic Mapbox data to ReactVision's native AR coordinate
system without reviving the old OBJ pipeline.

- validates lat/lng/altitude inputs;
- enables ReactVision geospatial tracking;
- detects reduced/approximate location before waiting on impossible tracking;
- reads the current geospatial camera pose;
- converts GPS coordinates to Viro world positions with ReactVision's
  `gpsToArWorld`;
- creates WGS84, Terrain, or Rooftop anchors;
- checks VPS availability;
- projects route coordinates into AR world space;
- chunks long routes for multiple `ViroPolyline` nodes.

## What it deliberately does not do

It does **not** upload Mapbox terrain meshes through `ViroGeometry`.

The high-volume terrain path remains:

```
Terrain-RGB -> Skia decode -> shared Dawn texture
            -> TypeGPU heights -> direct WebGPU terrain renderer
```

ReactVision owns spatial tracking, anchors, POIs and route placement. Large
terrain data remains GPU-resident.

## ReactVision version

ViroReact 3.0.2 is the current adapter target. The 3.x line is tested around:

- React Native `>=0.86.0 <0.87.0`;
- Expo `>=57.0.0 <58.0.0`;
- optional visionOS support through `@reactvision/react-native-visionos`.

That means a reference/demo app should stay on Expo 57 / RN 0.86 until
ReactVision widens its tested peer range. The core Nitro Mapbox AR package is
not forced to the same upper bound.

## Anchors vs projected route points

Use a real Terrain/WGS84/Rooftop anchor for content that must be locked to a
real-world geographic location.

`projectRoute()` is intentionally lighter. If a route coordinate does not
contain altitude, it falls back to the current camera altitude. This is useful
for an AR guidance ribbon near the user, but it is not a terrain-height
resolver. For terrain-accurate persistent placement, use anchors.

## Long routes

Do not feed a city-scale route to one giant `ViroPolyline`.

`projectRouteChunks()` defaults to 128 points per chunk with a one-point
overlap, keeping each native polyline bounded while preserving continuity.
