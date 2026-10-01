# Mapbox MCP and Agent Skills

Mapbox MCP belongs in development tools and server/agent environments, not in
the React Native runtime bundle.

## Hosted MCP

Official hosted endpoint:

`https://mcp.mapbox.com/mcp`

Use OAuth-capable clients when possible.

## Local geospatial MCP

`npx -y @mapbox/mcp-server`

Requires `MAPBOX_ACCESS_TOKEN`.

## Developer MCP

`npx -y @mapbox/mcp-devkit-server`

This is the better fit for coding-agent workflows around Mapbox styles,
developer resources and project automation.

## Repo skill

`skills/nitro-mapbox-ar/SKILL.md` captures this project's architectural rules
for coding agents so future changes keep:

- Graphite/WebGPU zero-copy terrain;
- Nitro native-only boundaries;
- web fallbacks;
- optional heavy Mapbox SDKs;
- Search/Navigation direct fallbacks;
- capability-gated preview products.
