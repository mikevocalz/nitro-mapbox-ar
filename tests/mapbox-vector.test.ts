import assert from 'node:assert/strict'
import test from 'node:test'

import { MapboxRasterClient } from '../src/mapbox/raster'
import { tileBounds, latToTileY, lonToTileX } from '../src/mapbox/tiles'
import { MAPBOX_STREETS_V8, MapboxVectorClient } from '../src/mapbox/vector'
import { mapboxRouteLegs, routeSteps, type NavigationRoute } from '../src/navigation/client'

test('vector tile requests hit the v4 .vector.pbf endpoint with an encoded token', async () => {
  let requested = ''
  const fetchImpl = (async (input: RequestInfo | URL) => {
    requested = String(input)
    return new Response(new Uint8Array([0x1a, 0x00]), { status: 200 })
  }) as typeof fetch
  const client = new MapboxVectorClient({ accessToken: ' pk.a b ', fetchImpl })
  const result = await client.fetchVectorTile({ z: 16, x: 19302, y: 24603 })
  assert.equal(result.kind, 'tile')
  assert.equal(result.kind === 'tile' ? result.bytes.byteLength : -1, 2)
  assert.equal(
    requested,
    `https://api.mapbox.com/v4/${MAPBOX_STREETS_V8}/16/19302/24603.vector.pbf?access_token=pk.a%20b`,
  )
})

test('a 404 vector tile is an empty tile, other failures throw', async () => {
  const notFound = new MapboxVectorClient({
    accessToken: 'pk.t',
    fetchImpl: (async () => new Response(null, { status: 404 })) as typeof fetch,
  })
  assert.deepEqual(await notFound.fetchVectorTile({ z: 1, x: 0, y: 0 }), { kind: 'empty' })

  const failing = new MapboxVectorClient({
    accessToken: 'pk.t',
    fetchImpl: (async () => new Response(null, { status: 401 })) as typeof fetch,
  })
  await assert.rejects(failing.fetchVectorTile({ z: 1, x: 0, y: 0 }), /HTTP 401/)
})

test('vector tile requests validate the tile and tileset before fetching', async () => {
  let calls = 0
  const client = new MapboxVectorClient({
    accessToken: 'pk.t',
    fetchImpl: (async () => {
      calls += 1
      return new Response(null, { status: 200 })
    }) as typeof fetch,
  })
  await assert.rejects(client.fetchVectorTile({ z: 2, x: 4, y: 0 }), RangeError)
  await assert.rejects(client.fetchVectorTile({ z: 2, x: 0, y: 0 }, { tilesetId: '../x' }), RangeError)
  assert.equal(calls, 0)
  assert.throws(() => new MapboxVectorClient({ accessToken: '  ' }), /token is required/)
})

test('satelliteTileUrl matches the URL fetchSatellite requests', async () => {
  let requested = ''
  const client = new MapboxRasterClient({
    accessToken: 'pk.t',
    fetchImpl: (async (input: RequestInfo | URL) => {
      requested = String(input)
      return new Response(new Uint8Array([1]), { status: 200 })
    }) as typeof fetch,
  })
  const tile = { z: 17, x: 38604, y: 49206 }
  await client.fetchSatellite(tile, { format: 'jpg90' })
  assert.equal(client.satelliteTileUrl(tile, { format: 'jpg90' }), requested)
  assert.match(requested, /mapbox\.satellite\/17\/38604\/49206@2x\.jpg90\?access_token=pk\.t$/)
  assert.throws(() => client.satelliteTileUrl({ z: 1, x: 2, y: 0 }), RangeError)
})

test('tileBounds inverts the tile index functions at the corners', () => {
  const lng = -73.9499948
  const lat = 40.8100895
  const tile = { z: 16, x: lonToTileX(lng, 16), y: latToTileY(lat, 16) }
  const bounds = tileBounds(tile)
  assert.ok(bounds.west <= lng && lng < bounds.east)
  assert.ok(bounds.south < lat && lat <= bounds.north)
  assert.equal(lonToTileX(bounds.west + 1e-9, 16), tile.x)
  assert.equal(latToTileY(bounds.north - 1e-9, 16), tile.y)
  assert.throws(() => tileBounds({ z: 3, x: 8, y: 0 }), RangeError)
})

const step = (
  instruction: string,
  location: [number, number],
  type = 'turn',
  geometry?: unknown,
) => ({
  distance: 100,
  duration: 70,
  name: 'W 125th St',
  mode: 'walking',
  maneuver: {
    location,
    bearing_before: -90,
    bearing_after: 450,
    instruction,
    type,
    modifier: 'left' as const,
  },
  ...(geometry ? { geometry } : {}),
})

test('mapboxRouteLegs converts Directions steps to the neutral contract', () => {
  const route: NavigationRoute = {
    distance: 400,
    duration: 280,
    legs: [
      {
        distance: 200,
        duration: 140,
        steps: [
          step('Head east', [-73.95, 40.81], 'depart', {
            type: 'LineString',
            coordinates: [[-73.95, 40.81], [-73.945, 40.808]],
          }),
          step('Arrive', [-73.945, 40.808], 'arrive'),
        ],
      },
      { distance: 200, duration: 140, steps: [step('Head north', [-73.945, 40.808], 'depart'), step('Arrive', [-73.94, 40.814], 'arrive')] },
    ],
  }
  const legs = mapboxRouteLegs(route)
  assert.equal(legs.length, 2)
  const [first] = legs[0]!.steps
  assert.deepEqual(first, {
    maneuver: {
      kind: 'depart',
      modifier: 'left',
      location: { latitude: 40.81, longitude: -73.95 },
      bearingBeforeDeg: 270,
      bearingAfterDeg: 90,
      instruction: 'Head east',
    },
    distanceM: 100,
    durationS: 70,
    streetName: 'W 125th St',
    geometry: [
      { latitude: 40.81, longitude: -73.95 },
      { latitude: 40.808, longitude: -73.945 },
    ],
  })
  assert.equal(legs[0]!.steps[1]!.geometry, undefined)
  assert.deepEqual(
    routeSteps(legs).map((s) => s.maneuver.instruction),
    ['Head east', 'Arrive', 'Head north', 'Arrive'],
  )
})

test('mapboxRouteLegs rejects routes without steps and bad manoeuvre locations', () => {
  assert.throws(
    () => mapboxRouteLegs({ distance: 1, duration: 1, legs: [{ distance: 1, duration: 1 }] }),
    /request steps: true/,
  )
  assert.throws(
    () => mapboxRouteLegs({ distance: 1, duration: 1, legs: [{ distance: 1, duration: 1, steps: [step('x', [-200, 0])] }] }),
    RangeError,
  )
})
