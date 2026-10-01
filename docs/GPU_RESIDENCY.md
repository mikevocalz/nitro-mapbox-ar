# GPU tile residency and prefetch

Terrain decoding is now GPU-resident, which makes explicit resource lifetime
more important than a traditional JavaScript object cache.

`GpuTileResidencyCache` bounds decoded terrain + satellite resources while
preventing eviction of textures or buffers still used by a renderer.

## Leases

`acquireTerrain()` and `acquireSatellite()` return leases.

```ts
const lease = await cache.acquireTerrain(tile)

try {
  if (lease.value.kind === 'tile') {
    // pass lease.value.value to a terrain renderer
  }
} finally {
  lease.release()
}
```

An entry with a live lease is pinned and cannot be evicted.

## Shared in-flight loads

Multiple acquisitions of the same layer/tile/options share one GPU load.

Each caller has its own optional `AbortSignal`. Cancelling one caller does not
cancel the shared load while another lease is waiting.

If the final waiting consumer goes away before the load finishes, the cache
aborts its internal request.

## Memory budget

The cache uses an LRU policy over unleased resources.

Terrain is estimated as:

- rgba8 decoded Terrain-RGB texture: 4 bytes/texel
- Float32 height field: 4 bytes/texel

Satellite imagery is estimated as 4 bytes/texel.

These numbers intentionally exclude driver allocator/alignment overhead. Set
`maxBytes` below the device memory budget you actually want to reserve.

A budget may be temporarily exceeded while every resident entry is pinned.
`stats.overBudget` exposes that state; releasing leases triggers pruning.

## Neighborhood prefetch

`prefetchTerrainNeighborhood()` and
`prefetchSatelliteNeighborhood()` use bounded concurrency (default 4).

The neighborhood helper:

- wraps XYZ x at the antimeridian;
- clamps y at Mercator world edges;
- deduplicates repeated wrapped tiles at low zoom.

This is meant to keep the user's near-future AR/XR terrain warm without issuing
an unbounded burst of network/decode/GPU work.

## Ownership

The cache owns resources it loads.

Do not call `dispose()` on a cached tile directly. Release its lease instead.

Calling `cache.dispose()` is a terminal teardown and destroys all cached
resources, including pinned ones. Use it when the owning scene/session is being
destroyed.
