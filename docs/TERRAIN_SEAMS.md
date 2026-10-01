# Terrain seams and GPU skirts

The direct terrain renderer must solve two different edge problems:

1. geographic tile span;
2. cracks between tiles rendered at different LOD strides.

## Exact tile span

Raster pixel resolution and terrain geometry spacing are not the same thing.

A 512px raster tile has 512 pixel samples, but a terrain mesh with 512 samples
has 511 intervals between the first and last sample.

The old direct renderer used:

```text
(width - 1) * rasterMetersPerPixel
```

which makes a 512-sample tile only 511/512 of its geographic width.

The seam-safe path now computes the exact ground span of the XYZ tile and uses:

```text
sampleSpacing = tileGroundSpan / (decodedWidth - 1)
```

so the first and last terrain samples land on the tile boundaries.

## GPU skirts

Mixed LODs can still expose small cracks because neighboring edge vertices are
sampled at different strides.

`skirtDepth` adds vertical edge quads generated entirely from
`@builtin(vertex_index)`.

No CPU skirt mesh or index buffer is created.

The draw appends:

```text
2 * cellColumns + 2 * cellRows
```

edge segments, six logical vertices per segment.

Set `skirtDepth` to a positive value for multi-tile terrain. A later batch
renderer can select the depth from terrain exaggeration and camera scale.

## Why skirts before stitching

Neighbor-aware edge stitching can remove T-junctions exactly, but it requires
knowledge of each adjacent tile's LOD.

Skirts are local to one tile, cheap, and work even while neighbors are loading
or missing. The multi-tile batching PR can therefore add exact neighbor LOD
coordination on top of a safe fallback rather than making tile loading atomic.
