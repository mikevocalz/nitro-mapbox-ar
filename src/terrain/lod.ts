export interface TerrainGridSize {
  readonly cellsX: number
  readonly cellsY: number
  readonly samplesX: number
  readonly samplesY: number
  readonly vertexCount: number
}

function assertGridDimension(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 2) {
    throw new RangeError(`${label} must be a safe integer >= 2`)
  }
}

export function assertTerrainLodStride(stride: number): void {
  if (!Number.isSafeInteger(stride) || stride < 1) {
    throw new RangeError('lodStride must be a positive safe integer')
  }
}

/**
 * Computes the triangle-list size for a regular terrain grid without creating
 * any CPU-side vertex or index arrays.
 *
 * The final row/column is clamped to the source edge, so arbitrary source
 * dimensions and LOD strides still cover the complete tile.
 */
export function terrainGridSize(
  width: number,
  height: number,
  lodStride = 1,
): TerrainGridSize {
  assertGridDimension(width, 'width')
  assertGridDimension(height, 'height')
  assertTerrainLodStride(lodStride)

  const cellsX = Math.ceil((width - 1) / lodStride)
  const cellsY = Math.ceil((height - 1) / lodStride)
  const vertexCount = cellsX * cellsY * 6

  if (!Number.isSafeInteger(vertexCount)) {
    throw new RangeError('terrain grid is too large')
  }

  return {
    cellsX,
    cellsY,
    samplesX: cellsX + 1,
    samplesY: cellsY + 1,
    vertexCount,
  }
}
