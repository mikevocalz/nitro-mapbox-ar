# Nitro Mapbox AR development skill

Use this skill when changing this repository or an application that consumes it.

## Architecture rules

- Keep `@mapbox/react-native-mapbox-ar` lightweight.
- Nitro is a native fast path, never the browser runtime.
- Prefer Skia Graphite's shared Dawn device on native when available.
- Prefer browser WebGPU on web; fall back to typed JavaScript CPU work.
- Do not copy GPU terrain data back to JavaScript.
- Do not regenerate OBJ files for the modern terrain path.
- Keep Mapbox Maps and Navigation SDKs optional.
- Keep preview/access-gated Mapbox agent features behind capability checks.
- Preserve direct Search/Navigation fallbacks.
- Treat Terrain-RGB as numeric data; do not apply color correction/filtering.
- Use entrance/routable points for AR place anchors when available.
- Use explicit leases for GPU tile lifetime.
- Avoid per-frame JS/native serialization.

## Rendering

Preferred native path:

1. fetch encoded Mapbox terrain/satellite data;
2. decode through Skia Graphite;
3. adopt textures on the shared react-native-webgpu Dawn device;
4. use TypeGPU for terrain compute;
5. render terrain directly from GPU height fields;
6. composite with Skia or hand spatial state to ReactVision/Viro.

Preferred web path:

1. direct Mapbox REST/Search/Navigation APIs;
2. browser WebGPU where available;
3. typed JS Terrain-RGB CPU fallback otherwise.

## Mapbox services

Use the exact product needed:

- Search Box API for interactive POI/place search;
- Geocoding v6 for address geocoding/entrance points;
- Directions API for route planning;
- Map Matching API for noisy traces;
- native Navigation provider for active guidance/offline/Electronic Horizon;
- hosted/local Mapbox MCP for agent/server geospatial workflows;
- Mapbox Developer MCP for styles/tokens/developer automation.

## Pull requests

Keep changes stacked and single-purpose. Every pure TypeScript/C++ change should
add a host test when practical. Do not claim device/XR support without a real
device build or documented upstream support.
