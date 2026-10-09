package com.margelo.nitro.mapboxar.nativemap

import android.os.Handler
import android.os.Looper
import com.margelo.nitro.core.Promise

/**
 * Settles a Nitro promise from work that must run on the main thread.
 *
 * Mapbox Maps requires the main thread for every `MapView` / `MapboxMap`
 * call, while Nitro view methods arrive on the JS thread. Each public map
 * method crosses to main once, here.
 */
internal object MainThreadPromise {
  private val main = Handler(Looper.getMainLooper())

  /** Runs [body] on the main thread and resolves with its result. */
  fun <T> run(body: () -> T): Promise<T> {
    val promise = Promise<T>()
    main.post {
      try {
        promise.resolve(body())
      } catch (error: Throwable) {
        promise.reject(error)
      }
    }
    return promise
  }

  /**
   * Runs [body] on the main thread and resolves when it calls `settle`. For
   * SDK calls that report through a callback. Only the first `settle` takes
   * effect; a throw from [body] rejects.
   */
  fun <T> complete(body: (settle: (Result<T>) -> Unit) -> Unit): Promise<T> {
    val promise = Promise<T>()
    main.post {
      var settled = false
      val settle: (Result<T>) -> Unit = { result ->
        if (!settled) {
          settled = true
          result.fold({ promise.resolve(it) }, { promise.reject(it) })
        }
      }
      try {
        body(settle)
      } catch (error: Throwable) {
        settle(Result.failure(error))
      }
    }
    return promise
  }
}
