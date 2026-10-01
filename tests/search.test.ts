import assert from 'node:assert/strict'
import test from 'node:test'

import { MapboxSearchClient } from '../src/search/client'
import { getSpatialSearchAnchor } from '../src/search/anchor'

test('suggest uses Search Box session billing parameters', async () => {
  let requested = ''
  const client = new MapboxSearchClient({
    accessToken: 'pk.test token',
    fetchImpl: (async (input: RequestInfo | URL) => {
      requested = String(input)
      return new Response(JSON.stringify({
        suggestions: [{ mapbox_id: 'poi.1', name: 'Coffee' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch,
  })

  const suggestions = await client.suggest('coffee', {
    sessionToken: 'session-1',
    proximity: { longitude: -73.98, latitude: 40.75 },
    types: ['poi'],
  })

  assert.equal(suggestions[0].mapbox_id, 'poi.1')
  assert.match(requested, /search\/searchbox\/v1\/suggest/)
  assert.match(requested, /session_token=session-1/)
  assert.match(requested, /proximity=-73\.98%2C40\.75/)
})

test('retrieve can request rich venue metadata', async () => {
  let requested = ''
  const client = new MapboxSearchClient({
    accessToken: 'pk.test',
    fetchImpl: (async (input: RequestInfo | URL) => {
      requested = String(input)
      return new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [],
      }), { status: 200 })
    }) as typeof fetch,
  })

  await client.retrieve('poi.abc', {
    sessionToken: 's',
    attributeSets: ['photos', 'visit', 'venue'],
  })

  assert.match(requested, /attribute_sets=photos%2Cvisit%2Cvenue/)
})

test('geocoding requests public-preview building entrances explicitly', async () => {
  let requested = ''
  const client = new MapboxSearchClient({
    accessToken: 'pk.test',
    fetchImpl: (async (input: RequestInfo | URL) => {
      requested = String(input)
      return new Response(JSON.stringify({
        type: 'FeatureCollection',
        features: [],
      }), { status: 200 })
    }) as typeof fetch,
  })

  await client.geocode('30 Rockefeller Plaza', {
    entrances: true,
    types: ['address'],
  })

  assert.match(requested, /search\/geocode\/v6\/forward/)
  assert.match(requested, /entrances=true/)
})

test('spatial anchors prefer physical entrances over routable defaults and centroids', () => {
  const feature = {
    type: 'Feature' as const,
    geometry: { type: 'Point', coordinates: [-73.98, 40.75] },
    properties: {
      coordinates: {
        routable_points: [
          { name: 'default', coordinates: [-73.981, 40.751] },
          { name: 'entrance', coordinates: [-73.982, 40.752] },
        ],
      },
    },
  }

  assert.deepEqual(getSpatialSearchAnchor(feature), {
    longitude: -73.982,
    latitude: 40.752,
    source: 'entrance',
    feature,
  })
})
