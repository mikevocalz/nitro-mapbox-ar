import Foundation
import NitroModules

/// Additive JS listeners for one native event.
///
/// JS adds and removes listeners on the JS thread while the map emits on the
/// main thread. The lock covers only the list mutation and the snapshot taken
/// before delivery; listeners run outside it.
final class ListenerRegistry<Event> {
  private let lock = NSLock()
  private var listeners: [(id: UInt64, call: (Event) -> Void)] = []
  private var nextId: UInt64 = 0

  var isEmpty: Bool {
    lock.lock()
    defer { lock.unlock() }
    return listeners.isEmpty
  }

  func add(_ listener: @escaping (Event) -> Void) -> ListenerSubscription {
    lock.lock()
    let id = nextId
    nextId += 1
    listeners.append((id: id, call: listener))
    lock.unlock()
    return ListenerSubscription(remove: { [weak self] in
      self?.remove(id: id)
    })
  }

  func emit(_ event: Event) {
    lock.lock()
    let snapshot = listeners
    lock.unlock()
    for listener in snapshot {
      listener.call(event)
    }
  }

  func removeAll() {
    lock.lock()
    listeners.removeAll()
    lock.unlock()
  }

  private func remove(id: UInt64) {
    lock.lock()
    listeners.removeAll { $0.id == id }
    lock.unlock()
  }
}
