/**
 * Texel dimensions of a decoded tile, as read by
 * {@linkcode estimateTerrainGpuBytes} and {@linkcode estimateSatelliteGpuBytes}.
 * Both must be positive safe integers whose product is also a safe integer.
 */
export interface TerrainGpuFootprint {
  /** Width in texels. */
  readonly width: number
  /** Height in texels. */
  readonly height: number
}

function assertDimensions(
  value: TerrainGpuFootprint,
  label: string,
): number {
  const { width, height } = value

  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new RangeError(`${label} dimensions must be positive safe integers`)
  }

  const pixels = width * height
  if (!Number.isSafeInteger(pixels)) {
    throw new RangeError(`${label} is too large`)
  }

  return pixels
}

/**
 * Approximate GPU footprint of one Terrain-RGB tile after decode.
 *
 * rgba8 source texture: 4 bytes / texel
 * Float32 height buffer: 4 bytes / texel
 *
 * Driver alignment/mip/allocator overhead is intentionally not guessed.
 */
export function estimateTerrainGpuBytes(
  value: TerrainGpuFootprint,
): number {
  return assertDimensions(value, 'terrain tile') * 8
}

/**
 * Approximate GPU footprint of one decoded rgba8 satellite texture.
 */
export function estimateSatelliteGpuBytes(
  value: TerrainGpuFootprint,
): number {
  return assertDimensions(value, 'satellite tile') * 4
}
