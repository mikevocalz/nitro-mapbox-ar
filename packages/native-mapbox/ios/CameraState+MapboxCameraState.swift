#if os(iOS)
import MapboxCoreMaps
import NitroModules

extension CameraState {
  /// Builds the Nitro value from the SDK's rendered camera.
  ///
  /// SDK: `MapboxCoreMaps.CameraState` (`center`, `padding`, `zoom`,
  /// `bearing`, `pitch`; MapboxCoreMaps 11.32.0 swiftinterface line 41).
  init(_ state: MapboxCoreMaps.CameraState) {
    self.init(
      center: GeographicCoordinate(state.center),
      zoom: Double(state.zoom),
      bearingDeg: state.bearing,
      pitchDeg: Double(state.pitch),
      padding: EdgeInsets(state.padding)
    )
  }
}
#endif
