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
- converts GPS coordinates to local East-North-Up metres on the WGS84
  ellipsoid (`projectToEnu`, `projectRouteToEnu`) and to camera-relative Viro
  positions (`projectToDeviceFrame`);
- creates WGS84, Terrain, or Rooftop anchors;
- checks VPS availability;
- projects route coordinates into AR world space;
- chunks long routes for multiple `ViroPolyline` nodes;
- renders projected Mapbox routes directly with the `MapboxViroRoute` component.

## Why not `gpsToArWorld`

ReactVision 3.0.2's `gpsToArWorld` measures in spherical Web Mercator and does
not divide by cos(latitude), so every distance comes out 1/cos(latitude) too
long. In Harlem (40.81°N) that is 32%: Apollo Theater to the Schomburg Center
is 913.1 m on the WGS84 ellipsoid and 1206.2 m in Mercator. This package
projects WGS84 to ECEF to ENU instead, and the tests check it against Vincenty
to within 0.5 m.

## MapboxViroRoute

`MapboxViroRoute` is the ready-to-render route layer on top of the projection
helpers. Give it a fixed `origin` (usually the route start) and
Mapbox/Directions coordinates. It projects them into the origin's ENU frame,
splits long routes into overlapping bounded chunks, and renders one
`ViroPolyline` per chunk under a single `ViroNode`.

Geometry depends only on `route` and `origin`, so camera pose updates don't
rebuild it. Viro 3.0.2 has no JS node that follows a geospatial anchor, so
place the origin yourself: create WGS84 anchors at the origin and at a second
route point, then pass their world positions to `solveEnuPlacement`.

```tsx
import {
  MapboxViroRoute,
  projectToEnu,
  solveEnuPlacement,
} from '@mapbox/react-native-mapbox-ar-reactvision'

const origin = {
  frame: { kind: 'route-start', routeId },
  latitude: start.latitude,
  longitude: start.longitude,
  altitude: start.altitude,
}

const placement = solveEnuPlacement({
  originWorldPosition: originAnchor.position,
  referenceWorldPosition: referenceAnchor.position,
  reference: projectToEnu(origin, referencePoint),
})

<MapboxViroRoute
  origin={origin}
  placement={placement}
  route={routeCoordinates}
  color="#00E5FF"
  thickness={0.06}
  verticalOffset={0.04}
/>
```

`EnuOffset` and the `place` / `route-start` frame kinds have the same shape as
`EnuOffset` in `@viro-external/xr-contract`; this package does not depend on it.

Pass `materials` or `materialName` to use an existing Viro material instead
of the component's automatically managed constant-color material. Use
`polylineProps` for shared Viro interaction/rendering props.

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

ViroReact 3.0.2 is the current adapter target. Every published 3.x release up
to 3.0.3 declares:

- React Native `>=0.86.0 <0.87.0`;
- Expo `>=57.0.0 <58.0.0`;
- optional visionOS support through `@reactvision/react-native-visionos`.

This adapter imports no React Native API, only five Viro exports
(`ViroGeospatialPose`, `ViroQuaternion`, `ViroMaterials`, `ViroNode`,
`ViroPolyline`). Its own peer range is therefore wider than ReactVision's:
`react-native >=0.86.0 <0.89.0` and `@reactvision/react-viro >=3.0.2-0 <4.0.0`,
which admits Viro forks published as 3.0.x prereleases on RN 0.88 / Expo 58.
The reference/demo app stays on the versions ReactVision itself declares.

## Route playhead

`routeLengthM(points)` and `pointAlongRoute(points, distanceM)` work on the
metre-space points from `projectRouteToEnu`, so a scrubber can move a marker
along a projected route without re-projecting anything.

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


## XR capability normalization

The adapter also exports XR capability helpers for phone, Quest, visionOS and
web. Co-location is modeled as same-family only, gaze is normalized into a
plain spatial ray, and Graphite on visionOS remains opt-in until the host has
validated a compatible build.
