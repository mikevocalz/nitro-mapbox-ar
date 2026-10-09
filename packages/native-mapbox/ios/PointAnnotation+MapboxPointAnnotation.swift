#if os(iOS)
import MapboxMaps
import NitroModules

extension PointAnnotation {
  /// Builds the SDK annotation. `onTap` receives this annotation's id and the
  /// tap is consumed, so it does not reach map-level tap listeners.
  ///
  /// SDK: `PointAnnotation.init(id:coordinate:isSelected:isDraggable:)`,
  /// `iconImage`, `textField`, `tapHandler`
  /// (`Annotations/Generated/PointAnnotation.swift:175,196,227,25`).
  func mapboxAnnotation(onTap: @escaping (String) -> Void) throws -> MapboxMaps.PointAnnotation {
    var annotation = MapboxMaps.PointAnnotation(
      id: id,
      coordinate: try coordinate.validated("annotation \"\(id)\" coordinate")
    )
    annotation.iconImage = iconImageId
    annotation.textField = text
    let annotationId = id
    annotation.tapHandler = { _ in
      onTap(annotationId)
      return true
    }
    return annotation
  }
}
#endif
