import assert from 'node:assert/strict'
import test from 'node:test'

import { MapboxNavigationClient } from '../src/navigation/client'
import { NavigationSession } from '../src/navigation/session'
import type { NativeNavigationProvider } from '../src/navigation/contracts'

function route() {
  return {
    distance: 100,
    duration: 60,
    legs: [{ distance: 100, duration: 60 }],
  }
}

test('core-only navigation can plan and hold an active route without native SDK weight', async () => {
  const client = new MapboxNavigationClient({
    accessToken: 'pk.test',
    fetchImpl: (async () => new Response(JSON.stringify({
      code: 'Ok',
      routes: [route(), { ...route(), duration: 75 }],
    }), { status: 200 })) as typeof fetch,
  })

  const session = new NavigationSession({ client })
  const planned = await session.planRoute([
    { longitude: 0, latitude: 0 },
    { longitude: 1, latitude: 1 },
  ])

  assert.equal(planned.alternatives.length, 1)
  await session.start(planned.primary)
  assert.equal(session.activeRoute?.duration, 60)
  assert.equal(session.capabilities.activeGuidance, false)

  await session.stop()
  assert.equal(session.activeRoute, null)
})

test('native provider receives route and trip-session lifecycle', async () => {
  const calls: string[] = []
  const provider: NativeNavigationProvider = {
    capabilities: {
      activeGuidance: true,
      rerouting: true,
      trafficRefresh: true,
      incidents: true,
      predictiveCaching: true,
      offlineRegions: true,
      electronicHorizon: true,
    },
    async startTripSession() { calls.push('start') },
    async stopTripSession() { calls.push('stop') },
    async setRoute(value) { calls.push(value ? 'route:set' : 'route:clear') },
    async getProgress() { return null },
    async getElectronicHorizon() {
      return { edgeId: 1, percentAlong: 0.5, edges: [] }
    },
  }

  const client = new MapboxNavigationClient({
    accessToken: 'pk.test',
    fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
  })
  const session = new NavigationSession({ client, nativeProvider: provider })

  await session.start(route())
  assert.deepEqual(calls, ['route:set', 'start'])
  assert.equal((await session.electronicHorizon())?.percentAlong, 0.5)

  await session.stop()
  assert.deepEqual(calls, ['route:set', 'start', 'stop', 'route:clear'])
})
