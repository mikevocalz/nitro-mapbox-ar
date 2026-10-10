import type { MapStyle } from '../specs/MapStyle.nitro'

/**
 * How {@linkcode MapStyle.addStyleImage} registers an image.
 *
 * @see {@linkcode MapStyle.addStyleImage}
 */
export interface StyleImageOptions {
  /**
   * Treat the image as a signed distance field, so `icon-color` and
   * `icon-halo-*` can recolor it. Use it for single-color template art.
   * @default false
   */
  sdf?: boolean
  /**
   * Image pixels per screen point. Pass `2` for `@2x` art so a 64 px wide
   * image draws 32 points wide. Must be greater than 0.
   * @default 1
   */
  scale?: number
}
