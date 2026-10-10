import type { MapStyle } from '../specs/MapStyle.nitro'

/**
 * Encoded image data for {@linkcode MapStyle.addStyleImage}. Set exactly one
 * field. PNG and JPEG decode on both platforms.
 *
 * @see {@linkcode MapStyle.addStyleImage}
 */
export interface StyleImageSource {
  /**
   * `file://`, `http://` or `https://` URI of an encoded image. Remote images
   * are downloaded each time the method runs; nothing is cached.
   */
  uri?: string
  /** Base64 of the encoded image bytes, without a `data:` prefix. */
  base64?: string
}
