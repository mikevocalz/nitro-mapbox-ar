import CoreLocation
import NitroMapboxAR
import NitroModules

/// The `MapboxNavigation` root. Creates one `HybridTripSession` at a time on
/// the shared `MapboxNavigationProvider`.
final class HybridMapboxNavigation: HybridMapboxNavigationSpec {
  /// Fixed by what this binding wires up: incidents (`liveIncidentsConfig`)
  /// and offline regions are not configured, so they report `false`.
  let capabilities = NativeNavigationCapabilities(
    activeGuidance: true,
    rerouting: true,
    trafficRefresh: true,
    incidents: false,
    predictiveCaching: true,
    offlineRegions: false,
    electronicHorizon: true
  )

  func createTripSession(options: TripSessionOptions) throws -> Promise<(any HybridTripSessionSpec)> {
    let accessToken = MapboxARAccessToken.current
    guard !accessToken.isEmpty else {
      throw NavigationSessionError(message: "Mapbox access token is not set (MapboxNavigation.createTripSession)")
    }
    if (options.locationSource ?? .device) == .device && !CLLocationManager.hasLocationPermission {
      throw NavigationSessionError(message: "Location permission is not granted; request it before a device trip session, or use locationSource 'replay-primary-route'")
    }
    return Promise.async { @MainActor in
      if SharedNavigationProvider.activeSession != nil {
        throw NavigationSessionError(message: "A trip session is already active; call TripSession.stop() first")
      }
      let provider = SharedNavigationProvider.configured(with: options.coreConfig(accessToken: accessToken))
      let session = HybridTripSession(
        navigation: provider.mapboxNavigation,
        accessToken: accessToken,
        enableElectronicHorizon: options.enableElectronicHorizon ?? false
      )
      SharedNavigationProvider.activeSession = session
      return session
    }
  }
}
