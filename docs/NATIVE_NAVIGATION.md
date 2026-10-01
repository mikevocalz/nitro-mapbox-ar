# Native Navigation SDK integration

The package intentionally separates the cross-platform routing core from the
full Mapbox Navigation SDK.

## Current upstream target

- Android Navigation SDK: 3.31.1
- iOS Navigation SDK: 3.31.1
- Maps SDK generation: v11

The native provider contract is designed for:

- active guidance and live rerouting;
- continuously refreshed traffic/incidents;
- route progress;
- predictive caching;
- offline regions;
- Electronic Horizon.

## Why the provider is injected

On iOS, Mapbox Navigation SDK v3.31.1 is currently installed with Swift Package
Manager. The existing Nitro native-map package is distributed as a React Native
native package with CocoaPods integration.

Rather than claim a direct iOS bridge that the package manager cannot reliably
link today, `NavigationSession` accepts a `NativeNavigationProvider` supplied
by the host integration. Android and iOS host applications can adapt their
Mapbox Navigation SDK lifecycle into this provider while the base package stays
portable and lightweight.

When no native provider exists, route planning, traffic annotations and map
matching continue to work through the Navigation Service APIs.
