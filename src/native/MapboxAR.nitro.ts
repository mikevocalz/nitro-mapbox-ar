import type { HybridObject } from 'react-native-nitro-modules'

/**
 * The native root of `@mikevocalz/nitro-mapbox-ar`. Holds the Mapbox access
 * token for the process and decodes Terrain-RGB pixels on the CPU when the
 * GPU path is unavailable.
 *
 * There is one instance per JS runtime, exported as `MapboxAR`. The web entry
 * exports a JS object with the same three members.
 *
 * @see {@linkcode MapboxAR.decodeTerrainRgb}
 */
export interface MapboxAR extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  /**
   * The Mapbox access token used by native SDK work in this process: the
   * `@mikevocalz/nitro-mapbox-ar-maps` view and
   * `@mikevocalz/nitro-mapbox-ar-navigation` trip sessions read it.
   *
   * The token is process-wide: every JS runtime in the app reads and writes
   * the same value. Assigning stores the string as given and never throws.
   * Assigning `''` clears the token. Operations that need a token reject with
   * an `Error` whose message starts with `Mapbox access token is not set` and
   * names the operation.
   *
   * @default ''
   */
  accessToken: string

  /**
   * Decodes one Terrain-RGB tile on the calling (JS) thread.
   *
   * Input is packed RGBA, 4 bytes per pixel, as decoded from a `pngraw` tile.
   * Output is packed native-endian Float32, 4 bytes per pixel, in metres:
   * `(-10000 + (R * 65536 + G * 256 + B) * 0.1) * heightModifier`.
   *
   * Use this for a single tile of up to 512 x 512 pixels (1 MiB of input).
   * Use {@linkcode MapboxAR.decodeTerrainRgbAsync} for anything larger or
   * when the JS thread is busy rendering.
   *
   * @param rgba Packed RGBA bytes. Not modified.
   * @param heightModifier Dimensionless multiplier applied to every height.
   * `1` returns metres; `0.5` halves relief.
   * @returns A new buffer of `rgba.byteLength` bytes.
   * @throws {Error} When `rgba.byteLength` is not a multiple of 4.
   * @throws {Error} When `rgba.byteLength` exceeds 1048576 bytes; the message
   * names `decodeTerrainRgbAsync`.
   * @throws {Error} When `heightModifier` is not finite.
   * @platform ios, android: `Error`, because Nitro rethrows the C++ exception
   * as a JS `Error` with the method name prefixed. Web: the same messages as
   * `RangeError`. Match on the message, not the class.
   */
  decodeTerrainRgb(rgba: ArrayBuffer, heightModifier: number): ArrayBuffer

  /**
   * Same contract as {@linkcode MapboxAR.decodeTerrainRgb} without the size
   * limit, decoded on a serial worker thread owned by the native core.
   *
   * The input is copied before this method returns, so the caller may reuse
   * `rgba` immediately. Calls are decoded one at a time in the order they
   * were made, and each promise resolves with the heights for its own input.
   *
   * @param rgba Packed RGBA bytes. Not modified.
   * @param heightModifier Dimensionless multiplier; `1` returns metres.
   * @returns A promise of a new Float32 height buffer.
   * @throws {Error} Rejects when `rgba.byteLength` is not a multiple of 4 or
   * `heightModifier` is not finite.
   */
  decodeTerrainRgbAsync(
    rgba: ArrayBuffer,
    heightModifier: number,
  ): Promise<ArrayBuffer>
}
