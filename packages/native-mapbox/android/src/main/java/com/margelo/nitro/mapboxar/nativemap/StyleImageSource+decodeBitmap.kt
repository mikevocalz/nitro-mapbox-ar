package com.margelo.nitro.mapboxar.nativemap

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Reads and decodes the image behind `MapStyle.addStyleImage` into an
 * ARGB_8888 bitmap, the config `toMapboxImage` copies from. Blocking: call it
 * off the main thread.
 *
 * @throws IllegalArgumentException when both or neither field is set, the base64
 * or URI is malformed, the scheme is unsupported, or the bytes do not decode.
 * @throws IllegalStateException when a download fails or returns a non-2xx status.
 */
internal fun StyleImageSource.decodeBitmap(): Bitmap {
  val uri = uri
  val base64 = base64
  val (bytes, label) = when {
    uri != null && base64 == null -> readUri(uri) to "Image \"$uri\""
    base64 != null && uri == null -> decodeBase64(base64) to "image.base64"
    else -> throw IllegalArgumentException("Set exactly one of image.uri and image.base64")
  }
  val options = BitmapFactory.Options().apply { inPreferredConfig = Bitmap.Config.ARGB_8888 }
  return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    ?: throw IllegalArgumentException("$label does not decode as an image")
}

private fun decodeBase64(base64: String): ByteArray =
  try {
    Base64.decode(base64, Base64.DEFAULT)
  } catch (error: IllegalArgumentException) {
    throw IllegalArgumentException("image.base64 is not valid base64: ${error.message}")
  }

private fun readUri(uri: String): ByteArray {
  val parsed = Uri.parse(uri)
  return when (parsed.scheme?.lowercase()) {
    "file" -> {
      val path = parsed.path ?: throw IllegalArgumentException("Malformed image URI \"$uri\"")
      try {
        File(path).readBytes()
      } catch (error: IOException) {
        throw IllegalStateException("Could not read image \"$uri\": ${error.message}")
      }
    }
    "http", "https" -> download(uri)
    null -> throw IllegalArgumentException("Malformed image URI \"$uri\"")
    else -> throw IllegalArgumentException(
      "Unsupported image URI scheme \"${parsed.scheme}\" in \"$uri\"; use file://, http:// or https://",
    )
  }
}

private fun download(uri: String): ByteArray {
  val connection =
    try {
      URL(uri).openConnection() as HttpURLConnection
    } catch (error: IOException) {
      throw IllegalArgumentException("Malformed image URI \"$uri\": ${error.message}")
    }
  try {
    val status = connection.responseCode
    check(status in 200..299) { "Image \"$uri\" returned HTTP $status" }
    return connection.inputStream.use { it.readBytes() }
  } catch (error: IOException) {
    throw IllegalStateException("Could not download image \"$uri\": ${error.message}")
  } finally {
    connection.disconnect()
  }
}
