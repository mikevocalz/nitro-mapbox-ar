export const MAPBOX_HOSTED_MCP_URL = 'https://mcp.mapbox.com/mcp'
export const MAPBOX_MCP_NPM_PACKAGE = '@mapbox/mcp-server'
export const MAPBOX_DEVKIT_MCP_NPM_PACKAGE = '@mapbox/mcp-devkit-server'

export interface MapboxHostedMcpConfig {
  readonly transport: 'http'
  readonly url: string
  readonly authentication: 'oauth'
}

export interface MapboxStdioMcpConfig {
  readonly transport: 'stdio'
  readonly command: 'npx'
  readonly args: readonly string[]
  readonly requiredEnvironment: readonly string[]
}

export function createHostedMapboxMcpConfig(): MapboxHostedMcpConfig {
  return {
    transport: 'http',
    url: MAPBOX_HOSTED_MCP_URL,
    authentication: 'oauth',
  }
}

export function createLocalMapboxMcpConfig(): MapboxStdioMcpConfig {
  return {
    transport: 'stdio',
    command: 'npx',
    args: ['-y', MAPBOX_MCP_NPM_PACKAGE],
    requiredEnvironment: ['MAPBOX_ACCESS_TOKEN'],
  }
}

export function createMapboxDevkitMcpConfig(): MapboxStdioMcpConfig {
  return {
    transport: 'stdio',
    command: 'npx',
    args: ['-y', MAPBOX_DEVKIT_MCP_NPM_PACKAGE],
    requiredEnvironment: ['MAPBOX_ACCESS_TOKEN'],
  }
}

export const MAPBOX_MCP_CAPABILITIES = [
  'directions',
  'isochrones',
  'geocoding',
  'place-search',
  'static-maps',
  'map-matching',
  'matrix',
  'optimization',
  'offline-geospatial-operations',
] as const

export type MapboxMcpCapability = typeof MAPBOX_MCP_CAPABILITIES[number]
