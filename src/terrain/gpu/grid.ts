import type { TileId } from '../../mapbox/tiles'

const WEB_MERCATOR_CIRCUMFERENCE_METERS = 40075016.68557849

/**
 * Draw geometry for one terrain tile at one LOD stride, computed by
 * {@linkcode getTerrainGridLayout}. All counts are logical: the vertex shader
 * builds positions from `vertex_index`, so nothing is uploaded.
 */
export interface TerrainGridLayout {
  /** Height samples per row. */
  readonly width: number
  /** Height sample rows. */
  readonly height: number
  /** Sample step between drawn vertices. 1 is full resolution. */
  readonly stride: number
  /** Cells across, `ceil((width - 1) / stride)`. */
  readonly cellColumns: number
  /** Cells down, `ceil((height - 1) / stride)`. */
  readonly cellRows: number
  /** `cellColumns * cellRows`. */
  readonly cellCount: number
  /** Surface vertices drawn, six per cell (two triangles). */
  readonly vertexCount: number
  /** Edge segments around the tile, `2 * cellColumns + 2 * cellRows`. */
  readonly skirtSegmentCount: number
  /** Skirt vertices drawn when skirts are on, six per segment. */
  readonly skirtVertexCount: number
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer`)
  }
}

function assertTile(tile: TileId): void {
  if (!Number.isSafeInteger(tile.z) || tile.z < 0 || tile.z > 30) {
    throw new RangeError('tile.z must be an integer between 0 and 30')
  }

  const extent = 2 ** tile.z
  if (
    !Number.isSafeInteger(tile.x) ||
    !Number.isSafeInteger(tile.y) ||
    tile.x < 0 ||
    tile.y < 0 ||
    tile.x >= extent ||
    tile.y >= extent
  ) {
    throw new RangeError(
      `tile x/y must be within [0, ${extent - 1}] for zoom ${tile.z}`,
    )
  }
}

/**
 * A terrain tile is rendered without a position/index buffer.
 *
 * Each cell expands to two triangles in the vertex shader. LOD changes only
 * the sampling stride and draw vertex count; terrain geometry never has to be
 * rebuilt or uploaded.
 */
export function getTerrainGridLayout(
  width: number,
  height: number,
  stride = 1,
): TerrainGridLayout {
  assertPositiveInteger(width, 'width')
  assertPositiveInteger(height, 'height')
  assertPositiveInteger(stride, 'stride')

  if (width < 2 || height < 2) {
    throw new RangeError('terrain width and height must both be at least 2')
  }

  const cellColumns = Math.ceil((width - 1) / stride)
  const cellRows = Math.ceil((height - 1) / stride)
  const cellCount = cellColumns * cellRows
  const vertexCount = cellCount * 6
  const skirtSegmentCount = 2 * cellColumns + 2 * cellRows
  const skirtVertexCount = skirtSegmentCount * 6

  if (!Number.isSafeInteger(vertexCount) || !Number.isSafeInteger(skirtVertexCount)) {
    throw new RangeError('terrain grid is too large')
  }

  return {
    width,
    height,
    stride,
    cellColumns,
    cellRows,
    cellCount,
    vertexCount,
    skirtSegmentCount,
    skirtVertexCount,
  }
}

/**
 * Latitude at the center of an XYZ Web Mercator tile.
 */
export function tileCenterLatitude(tile: TileId): number {
  assertTile(tile)

  const extent = 2 ** tile.z
  const mercatorY = Math.PI * (1 - (2 * (tile.y + 0.5)) / extent)
  return (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI
}

/**
 * Approximate ground resolution for one decoded pixel in this XYZ tile.
 *
 * This uses the actual decoded tile width, so a 512px @2x Terrain-RGB request
 * correctly has half the meters-per-pixel of a 256px response covering the
 * same geographic tile.
 */
export function tileMetersPerPixel(
  tile: TileId,
  decodedTileWidth: number,
): number {
  assertPositiveInteger(decodedTileWidth, 'decodedTileWidth')
  assertTile(tile)

  const latitudeRadians = (tileCenterLatitude(tile) * Math.PI) / 180
  return (
    (Math.cos(latitudeRadians) * WEB_MERCATOR_CIRCUMFERENCE_METERS) /
    (decodedTileWidth * 2 ** tile.z)
  )
}


/**
 * Ground width/depth of one XYZ tile at its center latitude.
 *
 * This is the local-tangent-plane span used to make adjacent terrain tiles
 * meet exactly at their boundaries.
 */
export function tileGroundSpanMeters(tile: TileId): number {
  assertTile(tile)

  const latitudeRadians = (tileCenterLatitude(tile) * Math.PI) / 180
  return (
    (Math.cos(latitudeRadians) * WEB_MERCATOR_CIRCUMFERENCE_METERS) /
    2 ** tile.z
  )
}

/**
 * Distance between the first and last decoded terrain samples when those
 * samples are stretched to the exact geographic tile boundaries.
 */
export function tileSampleSpacingMeters(
  tile: TileId,
  decodedTileWidth: number,
): number {
  assertPositiveInteger(decodedTileWidth, 'decodedTileWidth')
  if (decodedTileWidth < 2) {
    throw new RangeError('decodedTileWidth must be at least 2')
  }

  return tileGroundSpanMeters(tile) / (decodedTileWidth - 1)
}
