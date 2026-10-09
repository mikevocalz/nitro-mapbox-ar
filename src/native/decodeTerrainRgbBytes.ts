/**
 * Validates and decodes Terrain-RGB bytes in JS. Shared by the web
 * `MapboxAR` object; messages match `cpp/TerrainRgbCodec.hpp`.
 *
 * @param rgba Packed RGBA bytes, 4 per pixel.
 * @param heightModifier Dimensionless multiplier; `1` returns metres.
 * @returns Packed Float32 heights in metres.
 * @throws {RangeError} When `rgba.byteLength` is not a multiple of 4 or
 * `heightModifier` is not finite.
 */
export function decodeTerrainRgbBytes(
  rgba: ArrayBuffer,
  heightModifier: number,
): ArrayBuffer {
  if (rgba.byteLength % 4 !== 0) {
    throw new RangeError('Terrain-RGB input must contain exactly 4 bytes per pixel')
  }
  if (!Number.isFinite(heightModifier)) {
    throw new RangeError('heightModifier must be finite')
  }

  const source = new Uint8Array(rgba)
  const output = new ArrayBuffer(rgba.byteLength)
  const heights = new Float32Array(output)
  for (let pixel = 0; pixel < heights.length; pixel += 1) {
    const offset = pixel * 4
    const encoded = source[offset] * 65536 + source[offset + 1] * 256 + source[offset + 2]
    heights[pixel] = (-10000 + encoded * 0.1) * heightModifier
  }
  return output
}
