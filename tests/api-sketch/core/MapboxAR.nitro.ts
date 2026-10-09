import type { HybridObject } from 'react-native-nitro-modules'

import type { decodeTerrainRgb } from './decodeTerrainRgb'

/**
 * The native root of `@mikevocalz/nitro-mapbox-ar`. Holds the Mapbox access
 * token for the process and decodes Terrain-RGB pixels on the CPU when the
 * GPU path is unavailable.
 *
 * There is one instance per JS runtime, exported as `MapboxAR`. JS-only
 * consumers (web, Lens Studio) use {@linkcode decodeTerrainRgb} from the
 * `core` entry instead; it has the same input and output contract.
 *
 * @see {@linkcode MapboxAR.decodeTerrainRgb}
 */
export interface MapboxAR extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  /**
   * The Mapbox access token used by native SDK work in this process: the
   * `@mikevocalz/nitro-mapbox-ar-maps` view and
   * `@mikevocalz/nitro-mapbox-ar-navigation` trip sessions read it.
   *
   * Assigning stores the string as given and never throws. Assigning `''`
   * clears the token. Operations that need a token reject with an `Error`
   * whose message starts with `Mapbox access token is not set` and names the
   * operation, for example `MapboxNavigation.createTripSession`.
   *
   * @default ''
   */
  accessToken: string

  /**
   * Decodes one Terrain-RGB tile on the calling (JS) thread.
   *
   * Input is packed RGBA, 4 bytes per pixel, as decoded from a `pngraw` tile.
   * Output is packed little-endian Float32, 4 bytes per pixel, in metres:
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
   * points to `decodeTerrainRgbAsync`.
   * @throws {Error} When `heightModifier` is not finite.
   */
  decodeTerrainRgb(rgba: ArrayBuffer, heightModifier: number): ArrayBuffer

  /**
   * Same contract as {@linkcode MapboxAR.decodeTerrainRgb} without the size
   * limit, decoded on a worker queue owned by the native core. Concurrent
   * calls resolve independently; each result corresponds to its own input.
   *
   * The caller must not mutate `rgba` until the promise settles.
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
