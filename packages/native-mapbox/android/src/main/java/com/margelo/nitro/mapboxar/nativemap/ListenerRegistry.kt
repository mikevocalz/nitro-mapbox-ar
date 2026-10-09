package com.margelo.nitro.mapboxar.nativemap

/**
 * Additive JS listeners for one native event.
 *
 * JS adds and removes listeners on the JS thread while the map emits on the
 * main thread. The lock covers only the list mutation and the snapshot taken
 * before delivery; listeners run outside it.
 */
internal class ListenerRegistry<Event> {
  private val lock = Any()
  private var listeners: List<Pair<Long, (Event) -> Unit>> = emptyList()
  private var nextId = 0L

  val isEmpty: Boolean
    get() = synchronized(lock) { listeners.isEmpty() }

  fun add(listener: (Event) -> Unit): ListenerSubscription {
    val id = synchronized(lock) {
      val id = nextId++
      listeners = listeners + (id to listener)
      id
    }
    return ListenerSubscription(Func_void_java { remove(id) })
  }

  fun emit(event: Event) {
    val snapshot = synchronized(lock) { listeners }
    snapshot.forEach { it.second(event) }
  }

  fun removeAll() {
    synchronized(lock) { listeners = emptyList() }
  }

  private fun remove(id: Long) {
    synchronized(lock) { listeners = listeners.filterNot { it.first == id } }
  }
}
