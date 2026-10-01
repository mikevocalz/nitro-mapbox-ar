import assert from 'node:assert/strict'
import test from 'node:test'

import { MapboxNavigationClient } from '../src/navigation/client'
import { summarizeRouteTraffic } from '../src/navigation/traffic'

test('driving-traffic directions request asks for traffic annotations', async () => {
  let requested = ''
  const client = new MapboxNavigationClient({
    accessToken: 'pk.test',
    fetchImpl: (async (input: RequestInfo | URL) => {
      requested = String(input)
      return new Response(JSON.stringify({ code: 'Ok', routes: [] }), { status: 200 })
    }) as typeof fetch,
  })

  await client.directions([
    { longitude: -73.99, latitude: 40.73 },
    { longitude: -73.97, latitude: 40.75 },
  ])

  assert.match(requested, /directions\/v5\/mapbox\/driving-traffic/)
  assert.match(requested, /overview=full/)
  assert.match(requested, /congestion_numeric/)
  assert.match(requested, /closure/)
})

test('map matching validates per-point radius arrays', async () => {
  const client = new MapboxNavigationClient({
    accessToken: 'pk.test',
    fetchImpl: (async () => new Response('{}', { status: 200 })) as typeof fetch,
  })

  await assert.rejects(
    client.mapMatch(
      [
        { longitude: 0, latitude: 0 },
        { longitude: 1, latitude: 1 },
      ],
      { radiuses: [10] },
    ),
    /radiuses must match/,
  )
})

test('traffic summary preserves null data instead of inventing congestion', () => {
  const summary = summarizeRouteTraffic({
    distance: 10,
    duration: 10,
    legs: [
      {
        distance: 10,
        duration: 10,
        annotation: {
          congestion_numeric: [10, null, 85, 95],
          closure: [{}, {}],
        },
      },
    ],
  })

  assert.equal(summary.segments, 4)
  assert.equal(summary.reportedSegments, 3)
  assert.equal(summary.maxCongestion, 95)
  assert.equal(summary.severeSegments, 2)
  assert.equal(summary.closures, 2)
  assert.equal(summary.averageCongestion, 190 / 3)
})
