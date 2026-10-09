#if os(iOS)
import Foundation
import NitroModules

extension AnyMap {
  /// The map as a JSON-compatible dictionary for the SDK's
  /// `addLayer(with:layerPosition:)`. JS `null` becomes `NSNull`.
  var styleProperties: [String: Any] {
    toDictionary().mapValues(jsonCompatible)
  }
}

private func jsonCompatible(_ value: Any?) -> Any {
  switch value {
  case .none:
    return NSNull()
  case .some(let array as [Any?]):
    return array.map(jsonCompatible)
  case .some(let object as [String: Any?]):
    return object.mapValues(jsonCompatible)
  case .some(let other):
    return other
  }
}
#endif
