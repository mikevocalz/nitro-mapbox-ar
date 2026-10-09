import Foundation
import MapboxDirections
import MapboxNavigationCore

extension NavigationRoutes {
  /// The main route as a `RerouteEvent`: a one-route response encoded from
  /// `NavigationRoute.route` with the route options in the encoder's
  /// `userInfo[.options]`, and the request URL from
  /// `Directions.url(forCalculating:credentials:)`.
  func rerouteEvent(accessToken: String) throws -> RerouteEvent {
    guard let options = mainRoute.routeOptions else {
      throw NavigationSessionError(message: "Rerouted route has no route options")
    }
    let encoder = JSONEncoder()
    encoder.userInfo[.options] = options
    let routeObject = try JSONSerialization.jsonObject(with: encoder.encode(mainRoute.route))
    let response = try JSONSerialization.data(withJSONObject: ["code": "Ok", "routes": [routeObject]])
    let url = Directions.url(forCalculating: options, credentials: Credentials(accessToken: accessToken))
    return RerouteEvent(
      routes: NavigationRoutesInput(
        responseJson: String(decoding: response, as: UTF8.self),
        requestUrl: url.absoluteString,
        primaryRouteIndex: 0
      ),
      legs: mainRoute.route.legs.map(\.routeLeg)
    )
  }
}
