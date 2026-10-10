#if os(iOS)
import Foundation
import NitroModules
import UIKit

/// Reads and decodes the image behind `MapStyle.addStyleImage` off the main
/// thread. `file://` reads on a global queue, `http(s)://` downloads through
/// `URLSession.shared`, and base64 decodes on a global queue; `completion`
/// runs once, on whichever background queue finished.
extension StyleImageSource {
  func loadImage(scale: Double, completion: @escaping (Result<UIImage, Error>) -> Void) {
    switch (uri, base64) {
    case (let uri?, nil):
      Self.load(uri: uri, scale: scale, completion: completion)
    case (nil, let base64?):
      DispatchQueue.global(qos: .userInitiated).async {
        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else {
          completion(.failure(RuntimeError.error(withMessage: "image.base64 is not valid base64")))
          return
        }
        completion(Self.decode(data, scale: scale, label: "image.base64"))
      }
    default:
      completion(.failure(RuntimeError.error(withMessage: "Set exactly one of image.uri and image.base64")))
    }
  }

  private static func load(uri: String, scale: Double, completion: @escaping (Result<UIImage, Error>) -> Void) {
    guard let url = URL(string: uri), let scheme = url.scheme?.lowercased() else {
      completion(.failure(RuntimeError.error(withMessage: "Malformed image URI \"\(uri)\"")))
      return
    }
    switch scheme {
    case "file":
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          completion(decode(try Data(contentsOf: url), scale: scale, label: "Image \"\(uri)\""))
        } catch {
          completion(.failure(RuntimeError.error(withMessage: "Could not read image \"\(uri)\": \(error.localizedDescription)")))
        }
      }
    case "http", "https":
      URLSession.shared.dataTask(with: url) { data, response, error in
        if let error {
          completion(.failure(RuntimeError.error(withMessage: "Could not download image \"\(uri)\": \(error.localizedDescription)")))
        } else if let status = (response as? HTTPURLResponse)?.statusCode, !(200..<300).contains(status) {
          completion(.failure(RuntimeError.error(withMessage: "Image \"\(uri)\" returned HTTP \(status)")))
        } else {
          completion(decode(data ?? Data(), scale: scale, label: "Image \"\(uri)\""))
        }
      }.resume()
    default:
      completion(.failure(RuntimeError.error(withMessage:
        "Unsupported image URI scheme \"\(scheme)\" in \"\(uri)\"; use file://, http:// or https://")))
    }
  }

  /// `preparingForDisplay()` forces the decode here instead of on the main
  /// thread when the SDK first reads the pixels.
  private static func decode(_ data: Data, scale: Double, label: String) -> Result<UIImage, Error> {
    guard let image = UIImage(data: data, scale: CGFloat(scale)) else {
      return .failure(RuntimeError.error(withMessage: "\(label) does not decode as an image"))
    }
    if #available(iOS 15.0, *), let decoded = image.preparingForDisplay()?.cgImage {
      return .success(UIImage(cgImage: decoded, scale: CGFloat(scale), orientation: image.imageOrientation))
    }
    return .success(image)
  }
}
#endif
