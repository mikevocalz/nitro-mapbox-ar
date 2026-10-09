import MapboxNavigationCore

extension TripSessionOptions {
  /// The SDK configuration for a session with these options.
  func coreConfig(accessToken: String) -> CoreConfig {
    var rerouteConfig = RerouteConfig()
    rerouteConfig.detectsReroute = enableRerouting ?? true
    var routingConfig = RoutingConfig()
    routingConfig.rerouteConfig = rerouteConfig
    let locationSource: LocationSource =
      (self.locationSource ?? .device) == .replayPrimaryRoute ? .simulation(initialLocation: nil) : .live
    return CoreConfig(
      credentials: NavigationCoreApiConfiguration(accessToken: accessToken),
      routingConfig: routingConfig,
      locationSource: locationSource,
      electronicHorizonConfig: ElectronicHorizonConfig(
        length: 500,
        expansionLevel: 1,
        branchLength: 50,
        minTimeDeltaBetweenUpdates: nil
      )
    )
  }
}
