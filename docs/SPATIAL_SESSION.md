# Spatial tile session runtime

`SpatialTileSession` turns the low-level GPU residency cache into a movement-aware
runtime suitable for map, navigation and AR/XR sessions.

## Responsibilities

- pins the current visible tile neighborhood with explicit leases;
- reuses overlapping leases as the center tile moves;
- releases terrain and satellite resources immediately after they leave the
  visible neighborhood;
- prefetches a larger ring with bounded concurrency;
- cancels stale prefetch work when the user moves again;
- preserves the cache's memory budget and LRU eviction rules.

The default policy is a visible 3×3 neighborhood (radius 1) and a prefetched
5×5 neighborhood (radius 2).

This controller deliberately does not own camera transforms, navigation state,
React state, or rendering. Consumers can feed its snapshots into the terrain
batch renderer, Viro/ReactVision adapter, or a native Mapbox map without
coupling those layers together.
