#if os(iOS)
import MapboxMaps

/// The `showUserLocation` and `puckBearing` props as SDK location options.
/// A `nil` puck type hides the puck and stops the SDK's location provider.
///
/// SDK (11.32.0): `LocationOptions(puckType:puckBearing:puckBearingEnabled:)`
/// (`Location/LocationOptions.swift:44`), `PuckBearing.heading` / `.course`
/// (`:56`), `PuckType.puck2D` and `Puck2DConfiguration.makeDefault(showBearing:)`
/// (`Location/Puck/PuckType.swift:6,147`).
extension LocationOptions {
  init(showUserLocation: Bool, puckBearing: LocationPuckBearing) {
    let bearing: PuckBearing?
    switch puckBearing {
    case .heading: bearing = .heading
    case .course: bearing = .course
    case .none: bearing = nil
    }
    self.init(
      puckType: showUserLocation ? .puck2D(.makeDefault(showBearing: bearing != nil)) : nil,
      puckBearing: bearing ?? .heading,
      puckBearingEnabled: bearing != nil
    )
  }
}
#endif
