export interface MapboxARCore {
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
