import type { MapboxAR } from './MapboxAR.nitro'

/**
 * JS implementation of Terrain-RGB decoding for the `core` entry, where no
 * Nitro runtime exists. Same input, output and errors as
 * {@linkcode MapboxAR.decodeTerrainRgb}, without the 1 MiB limit.
 *
 * @param rgba Packed RGBA bytes, 4 per pixel.
 * @param heightModifier Dimensionless multiplier; `1` returns metres.
 * @returns Packed Float32 heights in metres.
 * @throws {RangeError} When `rgba.byteLength` is not a multiple of 4 or
 * `heightModifier` is not finite.
 */
export declare function decodeTerrainRgb(
  rgba: ArrayBuffer,
  heightModifier: number,
): ArrayBuffer
