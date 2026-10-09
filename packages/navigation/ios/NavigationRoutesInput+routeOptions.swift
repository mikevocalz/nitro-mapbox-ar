import Foundation
import MapboxDirections

extension NavigationRoutesInput {
  /// Checks `responseJson` and `primaryRouteIndex`, then parses `requestUrl`
  /// into route options with `RouteOptions(url:)`
  /// (MapboxDirections/DirectionsOptions.swift). Error messages never
  /// include the URL: it carries the access token.
  func validatedRouteOptions() throws -> (options: RouteOptions, primaryIndex: Int) {
    guard
      let data = responseJson.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let routes = object["routes"] as? [Any]
    else {
      throw NavigationSessionError(message: "responseJson is not a Directions API response with a routes array")
    }
    let index = Int(primaryRouteIndex ?? 0)
    guard index >= 0, index < routes.count else {
      throw NavigationSessionError(message: "primaryRouteIndex \(index) is out of range for \(routes.count) route(s)")
    }
    guard let url = URL(string: requestUrl), let options = RouteOptions(url: url) else {
      throw NavigationSessionError(message: "requestUrl is not a Directions API request URL")
    }
    return (options, index)
  }
}
