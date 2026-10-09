import Foundation

/// Additive listeners for one event type. JS adds and removes listeners on
/// its own thread while the SDK emits on the main thread, so the dictionary
/// is guarded by a lock that is never held while a listener runs.
final class ListenerRegistry<Event> {
  private let lock = NSLock()
  private var listeners: [UUID: (Event) -> Void] = [:]

  /// Adds `listener` and returns the closure that removes it. Removing twice
  /// is a no-op.
  func add(_ listener: @escaping (Event) -> Void) -> () -> Void {
    let id = UUID()
    lock.lock()
    listeners[id] = listener
    lock.unlock()
    return { [weak self] in
      guard let self else { return }
      self.lock.lock()
      self.listeners[id] = nil
      self.lock.unlock()
    }
  }

  func emit(_ event: Event) {
    lock.lock()
    let snapshot = Array(listeners.values)
    lock.unlock()
    for listener in snapshot {
      listener(event)
    }
  }

  func removeAll() {
    lock.lock()
    listeners.removeAll()
    lock.unlock()
  }
}
