import type { TileId } from '../../mapbox/tiles'

const WEB_MERCATOR_CIRCUMFERENCE_METERS = 40075016.68557849

export interface TerrainGridLayout {
  readonly width: number
  readonly height: number
  readonly stride: number
  readonly cellColumns: number
  readonly cellRows: number
  readonly cellCount: number
  readonly vertexCount: number
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

  if (!Number.isSafeInteger(vertexCount)) {
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
