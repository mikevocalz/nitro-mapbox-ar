import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createHostedMapboxMcpConfig,
  createLocalMapboxMcpConfig,
  createMapboxDevkitMcpConfig,
  MAPBOX_MCP_CAPABILITIES,
} from '../packages/agent-mcp/src/index'

test('hosted MCP config uses the Mapbox OAuth endpoint', () => {
  assert.deepEqual(createHostedMapboxMcpConfig(), {
    transport: 'http',
    url: 'https://mcp.mapbox.com/mcp',
    authentication: 'oauth',
  })
})

test('local MCP configs keep credentials out of generated config', () => {
  assert.deepEqual(createLocalMapboxMcpConfig(), {
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@mapbox/mcp-server'],
    requiredEnvironment: ['MAPBOX_ACCESS_TOKEN'],
  })

  assert.deepEqual(createMapboxDevkitMcpConfig(), {
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@mapbox/mcp-devkit-server'],
    requiredEnvironment: ['MAPBOX_ACCESS_TOKEN'],
  })

  assert.ok(MAPBOX_MCP_CAPABILITIES.includes('directions'))
})
