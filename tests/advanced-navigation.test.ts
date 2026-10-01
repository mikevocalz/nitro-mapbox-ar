import assert from 'node:assert/strict'
import test from 'node:test'

import { MapboxAdvancedNavigationClient } from '../src/navigation/advanced'

test('isochrone validates contour mode and builds traffic-aware URL', async () => {
  let requested = ''
  const client = new MapboxAdvancedNavigationClient({
    accessToken: 'pk.test',
    fetchImpl: (async (input: RequestInfo | URL) => {
      requested = String(input)
      return new Response('{}', { status: 200 })
    }) as typeof fetch,
  })

  await client.isochrone(
    { longitude: -73.98, latitude: 40.75 },
    { profile: 'driving-traffic', minutes: [10, 20], polygons: true },
  )

  assert.match(requested, /isochrone\/v1\/mapbox\/driving-traffic/)
  assert.match(requested, /contours_minutes=10%2C20/)
})

test('matrix applies the 10-coordinate traffic-profile limit', async () => {
  const client = new MapboxAdvancedNavigationClient({
    accessToken: 'pk.test',
    fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
  })
  const points = Array.from({ length: 11 }, (_, i) => ({
    longitude: i,
    latitude: i,
  }))

  assert.throws(
    () => client.matrix(points, { profile: 'driving-traffic' }),
    /2\.\.10/,
  )
})

test('EV route includes required preview parameters', async () => {
  let requested = ''
  const client = new MapboxAdvancedNavigationClient({
    accessToken: 'pk.test',
    fetchImpl: (async (input: RequestInfo | URL) => {
      requested = String(input)
      return new Response('{}', { status: 200 })
    }) as typeof fetch,
  })

  await client.evRoute(
    [
      { longitude: 11.59, latitude: 48.14 },
      { longitude: 11.64, latitude: 48.15 },
    ],
    {
      maxChargeWh: 80000,
      connectorTypes: ['ccs_combo_type2'],
      energyConsumptionCurve: '0,300;20,160;80,140;120,180',
      chargingCurve: '0,100000;40000,70000;60000,30000;80000,10000',
    },
  )

  assert.match(requested, /engine=electric/)
  assert.match(requested, /ev_max_charge=80000/)
  assert.match(requested, /ev_connector_types=ccs_combo_type2/)
})

test('Optimization v2 uses async submit/status endpoint', async () => {
  const requests: Array<{ url: string; method?: string }> = []
  const client = new MapboxAdvancedNavigationClient({
    accessToken: 'pk.test',
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(input), method: init?.method })
      return new Response(JSON.stringify({ id: 'job-1', status: 'processing' }), { status: 200 })
    }) as typeof fetch,
  })

  await client.submitOptimizationV2({ version: 1, vehicles: [], services: [] })
  await client.getOptimizationV2('job-1')

  assert.equal(requests[0].method, 'POST')
  assert.match(requests[0].url, /optimized-trips\/v2\?/)
  assert.match(requests[1].url, /optimized-trips\/v2\/job-1\?/)
})
