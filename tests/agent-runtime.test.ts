import assert from 'node:assert/strict'
import test from 'node:test'

import { SpatialAgentRuntime } from '../src/agent/runtime'
import { MapboxNavigationClient } from '../src/navigation/client'
import { NavigationSession } from '../src/navigation/session'
import { MapboxSearchClient } from '../src/search/client'

function dependencies() {
  const fetchImpl = (async () => new Response(JSON.stringify({
    code: 'Ok',
    routes: [{ distance: 1, duration: 1, legs: [{ distance: 1, duration: 1 }] }],
    type: 'FeatureCollection',
    features: [],
  }), { status: 200 })) as typeof fetch

  return {
    search: new MapboxSearchClient({ accessToken: 'pk.test', fetchImpl }),
    navigation: new NavigationSession({
      client: new MapboxNavigationClient({ accessToken: 'pk.test', fetchImpl }),
    }),
  }
}

test('agent runtime blocks actions outside the explicit permission policy', async () => {
  const audit: Array<{ action: string; allowed: boolean }> = []
  const runtime = new SpatialAgentRuntime({
    ...dependencies(),
    policy: { allow: ['read-context'] },
    getContext: () => ({}),
    onAudit: (event) => audit.push({ action: event.action, allowed: event.allowed }),
  })

  await assert.rejects(runtime.search('coffee'), /not permitted/)
  assert.deepEqual(audit, [{ action: 'search', allowed: false }])
})

test('AR focus uses entrance-aware search geometry', async () => {
  let focused: unknown
  const runtime = new SpatialAgentRuntime({
    ...dependencies(),
    policy: { allow: ['focus-map'] },
    getContext: () => ({}),
    effects: {
      focusCoordinate(value) {
        focused = value
      },
    },
  })

  await runtime.focusPlace({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [1, 2] },
    properties: {
      coordinates: {
        routable_points: [
          { name: 'entrance', coordinates: [3, 4] },
        ],
      },
    },
  })

  assert.deepEqual(focused, { longitude: 3, latitude: 4 })
})

test('Mapbox Agent Toolkit remains capability gated', async () => {
  const runtime = new SpatialAgentRuntime({
    ...dependencies(),
    policy: { allow: ['mapbox-agent-toolkit'] },
    getContext: () => ({}),
    mapboxToolkit: {
      available: false,
      async invoke() { return null },
    },
  })

  await assert.rejects(
    runtime.invokeMapboxToolkit('add-stop'),
    /Agent Toolkit is unavailable/,
  )
})
