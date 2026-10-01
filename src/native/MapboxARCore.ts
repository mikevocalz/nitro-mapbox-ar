import {
  NitroModules,
  type HybridObject,
} from 'react-native-nitro-modules'

/**
 * Cross-platform native services that should not be in the WebGPU hot path.
 *
 * This object is intentionally implemented in C++ so the same fallback works
 * on iOS, Android, and future Apple spatial targets without duplicating logic.
 */
export interface MapboxARCore
  extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  setAccessToken(accessToken: string): void
  getAccessToken(): string
  hasAccessToken(): boolean
  assertAccessToken(): void

  /**
   * Decode RGBA Terrain-RGB pixels to a packed Float32 height buffer.
   *
   * Input: 4 bytes per pixel (RGBA)
   * Output: 4 bytes per pixel (Float32 meters)
   */
  decodeTerrainRgb(rgba: ArrayBuffer, heightModifier: number): ArrayBuffer
}

let instance: MapboxARCore | undefined

export function getMapboxARCore(): MapboxARCore {
  instance ??= NitroModules.createHybridObject<MapboxARCore>('MapboxARCore')
  return instance
}
