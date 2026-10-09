# @mikevocalz/nitro-mapbox-ar-specs

Feeds Mapbox routes into the Snap Spectacles
[Navigation Kit](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/component-list)
from Lens Studio TypeScript. JS only: no React Native, Nitro or GPU imports.
It depends on the `@mikevocalz/nitro-mapbox-ar/core` entry, which builds to
plain ESM.

- `routeToPlaces(route, { distanceToVisit })` returns one
  `GeoLocationPlaceInput` per manoeuvre, in travel order, skipping
  departures. Build a `GeoLocationPlace` from each and pass it to
  `NavigationDataComponent.addPlace`.
- `userPositionToProgress(userPosition, route)` reads
  `UserPosition.getGeoPosition()` and `getBearing()` and returns a
  `NavigationProgressSnapshot`, or `undefined` while there is no location fix.

```ts
const client = new MapboxNavigationClient({
  accessToken,
  // Lens Studio has no global fetch.
  fetchImpl: (url) => internetModule.fetch(url),
})
const { routes } = await client.directions([origin, destination], { profile: 'walking' })
for (const input of routeToPlaces(routes[0])) {
  const geoPosition = GeoPosition.create()
  geoPosition.latitude = input.latitude
  geoPosition.longitude = input.longitude
  navigation.addPlace(new GeoLocationPlace(
    geoPosition, input.distanceToVisit, input.name, icon, input.description,
    navigation.getUserPosition(),
  ))
}
```

`examples/specs-lens` in the repository compiles this flow with `tsc`
against the built core entry.

## Sources and limits

- The `GeoLocationPlace` constructor and the `distanceToVisit` arrival rule
  come from the kit's source at
  [specs-devs/packages@df8820c](https://github.com/specs-devs/packages/tree/df8820c0c4970f052e545b8da1dd288c2516d912/SpecsNavigationKit/Assets/SpecsNavigationKit.lspkg/NavigationDataComponent).
  The component list page documents neither, and lists an `arrivalRadius`
  property that the source does not have.
- `UserPosition.getBearing()` is radians clockwise from true north. The kit
  negates it in the Lens Studio editor, so bearings read in the editor are
  mirrored.
- Remaining distance and duration assume constant speed along the route.
- Spectacles' fetch does not support `signal`, `Response.arrayBuffer()` or a
  global `fetch`
  ([Internet Access](https://developers.snap.com/spectacles/about-spectacles-features/apis/internet-access)).
  The Directions and Search clients send no `signal` unless the caller passes
  one and only call `json()`.
