# Multi-tile GPU terrain

The multi-tile renderer composes a local same-zoom terrain neighborhood without
creating one full render target per tile.

## Resource model

Each terrain tile keeps only the resources that are genuinely tile-specific:

- its GPU-resident height field;
- optional GPU-resident satellite imagery;
- two small uniform buffers;
- one bind group.

All tiles with the same color/depth format share the cached WebGPU pipeline.

The batch owns exactly one:

- color target;
- depth target;
- command encoder per frame;
- render pass per frame;
- queue submission per frame.

A 3×3 or 5×5 neighborhood therefore does not create 9 or 25 full-size
offscreen textures.

## Local placement

The first tile (or explicit `originTile`) defines a local tangent plane.

Same-zoom neighbors are positioned in whole tile spans:

```text
x = wrappedTileDeltaX * originTileSpanMeters
z = (tileY - originY) * originTileSpanMeters
```

X deltas wrap across the antimeridian, so the last XYZ column and column zero
remain neighbors.

This approximation is intentionally local. It is appropriate for AR/XR terrain
neighborhoods, not continent-scale rendering.

## One geographic span

Every tile in the batch uses the origin tile's local ground span and derives:

```text
sampleSpacing = originTileSpan / (decodedWidth - 1)
```

That makes adjacent boundaries meet exactly in the batch coordinate system.

## Dynamic LOD

`lodStride` and `skirtDepth` may be either numbers or callbacks.

That lets a caller make the center tile full resolution while peripheral tiles
use progressively coarser sampling without rebuilding or uploading geometry.

```ts
batch.render({
  viewProjection,
  lodStride: ({ offset }) => {
    const distance = Math.hypot(offset.x, offset.z)
    return distance < 500 ? 1 : distance < 1500 ? 2 : 4
  },
  skirtDepth: 20,
})
```

Skirts remain the safe fallback for mixed-LOD edges while a future refinement
can add exact neighbor-aware stitching.
