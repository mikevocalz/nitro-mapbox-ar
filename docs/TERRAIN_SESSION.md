# Moving terrain neighborhood session

`TerrainNeighborhoodSession` is the high-level runtime controller that ties
the GPU residency cache to the multi-tile renderer.

It is intended for the real app loop: location/camera movement changes the
center tile while the renderer keeps a small local terrain neighborhood alive.

## What stays persistent

Across center-tile changes the session reuses:

- one Graphite/WebGPU color target;
- one depth target;
- cached render pipelines;
- cache leases for every tile that remains inside the new neighborhood.

Large framebuffer textures are therefore not reallocated every time the user
crosses an XYZ tile boundary.

## Transactional updates

`setCenter()` does not destroy the old scene first.

It:

1. computes the overlap between current and desired neighborhoods;
2. retains leases for overlapping tiles;
3. acquires only new terrain/imagery;
4. builds the replacement batch against the existing render target;
5. swaps batches;
6. releases tiles that fell out of range.

If acquisition fails or the update is aborted, newly acquired leases are
released and the previous neighborhood remains valid.

## Rapid movement

Starting a new `setCenter()` aborts the previous in-flight update.

The residency cache still preserves shared requests needed by another consumer,
so stale camera movement does not force duplicate network/decode work.

## Example

```ts
const cache = new GpuTileResidencyCache(mapboxClient, {
  maxBytes: 96 * 1024 * 1024,
})

const session = new TerrainNeighborhoodSession(cache, {
  targetWidth: 1170,
  targetHeight: 2532,
  radius: 1,
  imagery: true,
})

await session.setCenter(currentTile)

const frame = session.render({
  viewProjection,
  lodStride: ({ offset }) =>
    Math.hypot(offset.x, offset.z) < 800 ? 1 : 2,
  skirtDepth: 20,
})

await session.prefetchNextRing()
```

## Ownership

The session owns its render target and active leases.

The cache is externally owned so an app can share residency between multiple
views/sessions if desired.

Dispose the session before disposing the shared cache.
