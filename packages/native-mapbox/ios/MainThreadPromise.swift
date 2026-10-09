import Foundation
import NitroModules

/// Settles a Nitro promise from work that must run on the main thread.
///
/// Mapbox Maps requires the main thread for every `MapView` / `MapboxMap`
/// call, while Nitro view methods arrive on the JS thread. Each public map
/// method crosses to main once, here.
enum MainThreadPromise {
  /// Runs `body` on the main queue and resolves with its result.
  static func run<T>(_ body: @escaping () throws -> T) -> Promise<T> {
    let promise = Promise<T>()
    DispatchQueue.main.async {
      do {
        promise.resolve(withResult: try body())
      } catch {
        promise.reject(withError: error)
      }
    }
    return promise
  }

  /// Runs `body` on the main queue and resolves when `body` calls `settle`.
  /// Use it for SDK calls that report through a completion handler. Only the
  /// first `settle` call takes effect; a throw from `body` rejects.
  static func complete<T>(
    _ body: @escaping (_ settle: @escaping (Result<T, Error>) -> Void) throws -> Void
  ) -> Promise<T> {
    let promise = Promise<T>()
    DispatchQueue.main.async {
      var settled = false
      let settle: (Result<T, Error>) -> Void = { result in
        guard !settled else { return }
        settled = true
        switch result {
        case .success(let value):
          promise.resolve(withResult: value)
        case .failure(let error):
          promise.reject(withError: error)
        }
      }
      do {
        try body(settle)
      } catch {
        settle(.failure(error))
      }
    }
    return promise
  }
}
