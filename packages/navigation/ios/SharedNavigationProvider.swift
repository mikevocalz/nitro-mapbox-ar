import MapboxNavigationCore

/// The one `MapboxNavigationProvider` this process may have.
/// `MapboxNavigationProvider.init(coreConfig:)` calls `preconditionFailure`
/// when a second instance exists (MapboxNavigationProvider.swift,
/// `checkInstanceIsUnique`), so it is created once and reconfigured per trip
/// session with `apply(coreConfig:)`.
@MainActor
enum SharedNavigationProvider {
  private static var provider: MapboxNavigationProvider?

  /// The session currently using the provider, if any.
  static weak var activeSession: HybridTripSession?

  static func configured(with coreConfig: CoreConfig) -> MapboxNavigationProvider {
    if let provider {
      provider.apply(coreConfig: coreConfig)
      return provider
    }
    let created = MapboxNavigationProvider(coreConfig: coreConfig)
    provider = created
    return created
  }
}
