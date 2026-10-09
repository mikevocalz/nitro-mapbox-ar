#if os(iOS)
import MapboxMaps
import NitroModules

/// A marker group backed by the SDK's `PointAnnotationManager`.
///
/// The SDK draws it with a persistent layer, so it survives style reloads
/// (`AnnotationOrchestrator.swift:86`, `AnnotationManagerImpl.swift:141-142`).
/// It is released by `removeFromMap()` or when its map view unmounts.
final class HybridPointAnnotationManager: HybridPointAnnotationManagerSpec {
  let id: String
  private weak var orchestrator: AnnotationOrchestrator?
  private var manager: MapboxMaps.PointAnnotationManager?
  private let taps = ListenerRegistry<String>()

  init(orchestrator: AnnotationOrchestrator) {
    let manager = orchestrator.makePointAnnotationManager(id: "nitro-point-\(UUID().uuidString)")
    self.id = manager.id
    self.orchestrator = orchestrator
    self.manager = manager
    super.init()
  }

  func setAnnotations(annotations: [PointAnnotation]) throws -> Promise<Void> {
    MainThreadPromise.run {
      guard let manager = self.manager, self.orchestrator != nil else {
        throw RuntimeError.error(withMessage: "PointAnnotationManager \"\(self.id)\" was removed from the map")
      }
      var seen = Set<String>()
      for annotation in annotations where !seen.insert(annotation.id).inserted {
        throw RuntimeError.error(withMessage: "Duplicate annotation id \"\(annotation.id)\"")
      }
      let taps = self.taps
      manager.annotations = try annotations.map { annotation in
        try annotation.mapboxAnnotation { taps.emit($0) }
      }
    }
  }

  func addOnAnnotationTapListener(listener: @escaping (String) -> Void) throws -> ListenerSubscription {
    taps.add(listener)
  }

  func removeFromMap() throws -> Promise<Void> {
    MainThreadPromise.run {
      self.release()
    }
  }

  /// Removes the SDK manager. Idempotent; called by `removeFromMap()` and by
  /// the map view on unmount.
  func release() {
    guard manager != nil else { return }
    manager = nil
    orchestrator?.removeAnnotationManager(withId: id)
    taps.removeAll()
  }
}
#endif
