# @mapbox/react-native-mapbox-ar-agent-mcp

Tiny, optional configuration helpers for connecting development tools or
server-side agents to Mapbox MCP.

This package intentionally does **not** bundle `@mapbox/mcp-server` or
`@mapbox/mcp-devkit-server` into the React Native/browser runtime.

Supported setup paths:

- hosted OAuth endpoint: `https://mcp.mapbox.com/mcp`
- local geospatial MCP: `npx -y @mapbox/mcp-server`
- local developer MCP: `npx -y @mapbox/mcp-devkit-server`

Use Mapbox MCP for agent/server/development workflows. Keep in-app mobile
actions behind the permissioned `SpatialAgentRuntime`.
