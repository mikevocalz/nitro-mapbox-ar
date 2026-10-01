# XR and spatial-AI continuity

The ReactVision adapter normalizes spatial capabilities across:

- iOS
- Android
- Meta Quest
- Apple Vision Pro
- web

## Same-family co-location

ReactVision co-location currently shares frames only within a platform family:

- phone ↔ phone
- Quest ↔ Quest
- Vision ↔ Vision

There is no phone ↔ Quest or Quest ↔ Vision frame conversion. The adapter
models that explicitly with `canShareColocationFrame()`.

## Gaze-aware spatial context

`SpatialContextSnapshot` can carry:

- camera geographic location;
- heading;
- gaze ray / hit target;
- visible anchors;
- co-located peer count;
- application metadata.

On platforms without gaze support, gaze is stripped instead of fabricated.

## Vision Pro + Graphite

ReactVision can run immersive scenes on visionOS through its own Metal renderer.

Skia Graphite remains the preferred shared GPU compositor when the host has a
validated compatible build, but `graphiteOnVisionOS` defaults to `false`.
This prevents the SDK from claiming a published Graphite visionOS binary exists
when it has not been validated for the consuming app.

The safe visionOS path is therefore:

1. ReactVision/Viro Metal renderer for immersive tracking/content;
2. Mapbox Search/Navigation/spatial state shared through this adapter;
3. Graphite-enabled compositing only after explicit host capability validation.
