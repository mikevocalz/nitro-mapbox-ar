/**
 * The members of the native `MapboxAR` root that the web entry provides, with
 * the same contract and no Nitro dependency, so browser bundles and their
 * typecheck never need `react-native-nitro-modules`.
 *
 * Errors thrown here are real `RangeError`s. The native root cannot carry the
 * subclass across Nitro and throws `Error` with the same message text.
 */
export interface MapboxARWeb {
  /**
   * The Mapbox access token for this page. Stored as given; `''` clears it.
   * @default ''
   */
  accessToken: string

  /**
   * Decodes Terrain-RGB pixels to packed Float32 heights in metres on the
   * calling thread.
   *
   * @param rgba Packed RGBA bytes, 4 per pixel. Not modified.
   * @param heightModifier Dimensionless multiplier; `1` returns metres.
   * @returns A new buffer of `rgba.byteLength` bytes.
   * @throws {RangeError} When `rgba.byteLength` is not a multiple of 4, is
   * above 1048576 bytes (the message names `decodeTerrainRgbAsync`), or
   * `heightModifier` is not finite.
   */
  decodeTerrainRgb(rgba: ArrayBuffer, heightModifier: number): ArrayBuffer

  /**
   * Same contract as {@linkcode MapboxARWeb.decodeTerrainRgb} without the
   * size limit. The input is copied before the promise is returned.
   *
   * @param rgba Packed RGBA bytes, 4 per pixel. Not modified.
   * @param heightModifier Dimensionless multiplier; `1` returns metres.
   * @returns A promise of a new Float32 height buffer.
   * @throws {RangeError} Rejects for the same input errors as the sync form.
   */
  decodeTerrainRgbAsync(
    rgba: ArrayBuffer,
    heightModifier: number,
  ): Promise<ArrayBuffer>
}
