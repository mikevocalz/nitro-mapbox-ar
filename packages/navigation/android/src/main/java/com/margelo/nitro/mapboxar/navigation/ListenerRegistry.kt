package com.margelo.nitro.mapboxar.navigation

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * Additive listeners for one event type. JS adds and removes listeners on its
 * own thread while the SDK emits on the main thread; the concurrent map lets
 * emission iterate a weakly consistent view without holding a lock while a
 * listener runs.
 */
internal class ListenerRegistry<Event> {
  private val nextId = AtomicLong()
  private val listeners = ConcurrentHashMap<Long, (Event) -> Unit>()

  /** Adds [listener] and returns the function that removes it. Idempotent. */
  fun add(listener: (Event) -> Unit): () -> Unit {
    val id = nextId.incrementAndGet()
    listeners[id] = listener
    return { listeners.remove(id) }
  }

  fun emit(event: Event) {
    for (listener in listeners.values) listener(event)
  }

  fun clear() {
    listeners.clear()
  }
}
