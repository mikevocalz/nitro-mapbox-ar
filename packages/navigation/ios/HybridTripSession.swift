import Combine
import MapboxNavigationCore
import NitroModules

/// A trip session over `MapboxNavigation` (MapboxNavigationCore). All SDK
/// access runs on the main actor, which the SDK's controllers require
/// (`@MainActor` on `SessionController`, `NavigationController` and
/// `ElectronicHorizonController`).
final class HybridTripSession: HybridTripSessionSpec {
  private let navigation: MapboxNavigation
  private let accessToken: String
  private let enableElectronicHorizon: Bool
  private let progressListeners = ListenerRegistry<NavigationProgress>()
  private let rerouteListeners = ListenerRegistry<RerouteEvent>()
  private let errorListeners = ListenerRegistry<Error>()
  @MainActor private var cancellables: Set<AnyCancellable> = []
  @MainActor private var latestHorizon: EHorizonStatus.Events.PositionUpdated?
  @MainActor private var isStopped = false

  @MainActor
  init(navigation: MapboxNavigation, accessToken: String, enableElectronicHorizon: Bool) {
    self.navigation = navigation
    self.accessToken = accessToken
    self.enableElectronicHorizon = enableElectronicHorizon
    super.init()
    subscribe()
    if enableElectronicHorizon {
      navigation.electronicHorizon().startUpdatingEHorizon()
    }
  }

  @MainActor
  private func subscribe() {
    let controller = navigation.navigation()
    controller.routeProgress
      .compactMap { $0?.routeProgress }
      .combineLatest(controller.locationMatching.map(\.enhancedLocation))
      .sink { [progressListeners] progress, location in
        progressListeners.emit(progress.navigationProgress(location: location))
      }
      .store(in: &cancellables)

    controller.rerouting
      .sink { [weak self] status in self?.handle(rerouting: status) }
      .store(in: &cancellables)

    controller.errors
      .sink { [errorListeners] error in
        errorListeners.emit(NavigationSessionError(message: "Navigation SDK error: \(String(describing: error))"))
      }
      .store(in: &cancellables)

    navigation.electronicHorizon().eHorizonEvents
      .compactMap { $0.event as? EHorizonStatus.Events.PositionUpdated }
      .sink { [weak self] update in self?.latestHorizon = update }
      .store(in: &cancellables)
  }

  @MainActor
  private func handle(rerouting status: ReroutingStatus) {
    if let failed = status.event as? ReroutingStatus.Events.Failed {
      errorListeners.emit(NavigationSessionError(message: "Reroute failed: \(failed.error.localizedDescription)"))
      return
    }
    guard status.event is ReroutingStatus.Events.Fetched,
          let routes = navigation.tripSession().currentNavigationRoutes
    else { return }
    do {
      rerouteListeners.emit(try routes.rerouteEvent(accessToken: accessToken))
    } catch {
      errorListeners.emit(error)
    }
  }

  func setRoutes(routes: NavigationRoutesInput) throws -> Promise<Void> {
    let (options, primaryIndex) = try routes.validatedRouteOptions()
    return Promise.async { @MainActor in
      try self.ensureActive()
      let fetched = try await self.navigation.routingProvider().calculateRoutes(options: options).value
      var selected = fetched
      if primaryIndex > 0 {
        guard let alternative = await fetched.selectingAlternativeRoute(at: primaryIndex - 1) else {
          throw NavigationSessionError(message: "primaryRouteIndex \(primaryIndex) is out of range for the routes the Navigation SDK fetched")
        }
        selected = alternative
      }
      try self.ensureActive()
      self.navigation.tripSession().startActiveGuidance(with: selected, startLegIndex: 0)
    }
  }

  func addOnProgressListener(listener: @escaping (NavigationProgress) -> Void) throws -> ListenerSubscription {
    ListenerSubscription(remove: progressListeners.add(listener))
  }

  func addOnRerouteListener(listener: @escaping (RerouteEvent) -> Void) throws -> ListenerSubscription {
    ListenerSubscription(remove: rerouteListeners.add(listener))
  }

  func addOnErrorListener(listener: @escaping (Error) -> Void) throws -> ListenerSubscription {
    ListenerSubscription(remove: errorListeners.add(listener))
  }

  func getElectronicHorizon() throws -> Promise<ElectronicHorizon?> {
    guard enableElectronicHorizon else {
      throw NavigationSessionError(message: "This TripSession was created without enableElectronicHorizon")
    }
    return Promise.async { @MainActor in
      try self.ensureActive()
      guard let update = self.latestHorizon else { return nil }
      return update.electronicHorizon(roadGraph: self.navigation.electronicHorizon().roadMatching.roadGraph)
    }
  }

  func stop() throws -> Promise<Void> {
    Promise.async { @MainActor in
      guard !self.isStopped else { return }
      self.isStopped = true
      self.cancellables.removeAll()
      self.progressListeners.removeAll()
      self.rerouteListeners.removeAll()
      self.errorListeners.removeAll()
      if self.enableElectronicHorizon {
        self.navigation.electronicHorizon().stopUpdatingEHorizon()
      }
      self.navigation.tripSession().setToIdle()
      if SharedNavigationProvider.activeSession === self {
        SharedNavigationProvider.activeSession = nil
      }
    }
  }

  @MainActor
  private func ensureActive() throws {
    if isStopped {
      throw NavigationSessionError(message: "TripSession was stopped")
    }
  }
}
