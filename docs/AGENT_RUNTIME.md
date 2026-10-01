# Spatial agent runtime

The agent layer is provider-neutral and does not require an LLM SDK.

`SpatialAgentRuntime` exposes typed location actions over the same Search,
Navigation and ReactVision-ready spatial primitives used by the app.

## Permission model

Every action must be explicitly allowed by `SpatialAgentPermissionPolicy`.
Denied actions fail before any map/navigation mutation occurs. An audit callback
receives both allowed and denied attempts.

## Direct fallback first

Search and routing work through the direct Mapbox APIs already in core. This
means agent functionality does not disappear when preview-only provider
features are unavailable.

## Mapbox Agent Toolkit

The Mapbox Agent Toolkit for Maps and Navigation is capability-gated behind
`MapboxAgentToolkitBridge`.

The toolkit bridge is injected only when the host has access. The base runtime
never assumes preview access and never makes it a hard dependency.

## Spatial actions

The runtime supports:

- reading current spatial context;
- place search;
- traffic-aware route creation;
- starting/stopping a navigation session;
- focusing the map on a place;
- entrance-aware AR anchor creation;
- highlighting places;
- invoking an available Mapbox Agent Toolkit control.
