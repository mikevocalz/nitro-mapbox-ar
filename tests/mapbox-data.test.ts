import assert from 'node:assert/strict'
import test from 'node:test'

import {
  latToTileY,
  lonToTileX,
  tilesForBBox,
} from '../src/mapbox/tiles'
import {
  MapboxRasterClient,
  terrainRgbSourceZoom,
} from '../src/mapbox/raster'

test('Web Mercator helpers clamp to the valid XYZ range', () => {
  assert.equal(lonToTileX(-180, 2), 0)
  assert.equal(lonToTileX(180, 2), 3)
  assert.equal(latToTileY(90, 2), 0)
  assert.equal(latToTileY(-90, 2), 3)
})

test('antimeridian bboxes cover edge columns instead of most of the world', () => {
  const tiles = tilesForBBox([170, -10, -170, 10], 2)
  const xs = new Set(tiles.map((tile) => tile.x))

  assert.deepEqual([...xs].sort((a, b) => a - b), [0, 3])
  assert.ok(tiles.length > 0)
})

test('Terrain-RGB source zoom respects Mapbox source resolution', () => {
  assert.equal(terrainRgbSourceZoom(30, 256), 15)
  assert.equal(terrainRgbSourceZoom(30, 512), 14)
  assert.equal(terrainRgbSourceZoom(8, 512), 8)
})

test('Terrain-RGB requests use pngraw and preserve 512px @2x semantics', async () => {
  let requested = ''

  const fetchImpl = (async (input: RequestInfo | URL) => {
    requested = String(input)
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })
  }) as typeof fetch

  const client = new MapboxRasterClient({
    accessToken: 'pk.test token',
    fetchImpl,
  })

  const result = await client.fetchTerrainRgb(
    { z: 14, x: 4823, y: 6160 },
    { tileSize: 512 },
  )

  assert.equal(result.kind, 'tile')
  assert.match(
    requested,
    /mapbox\.terrain-rgb\/14\/4823\/6160@2x\.pngraw\?access_token=pk\.test%20token$/,
  )
})

test('Terrain-RGB 404 is represented as zero-elevation water', async () => {
  const fetchImpl = (async () => new Response(null, { status: 404 })) as typeof fetch
  const client = new MapboxRasterClient({
    accessToken: 'pk.test',
    fetchImpl,
  })

  const result = await client.fetchTerrainRgb({ z: 4, x: 2, y: 7 })
  assert.deepEqual(result, { kind: 'water' })
})

test('satellite requests without AbortSignal are coalesced', async () => {
  let requests = 0

  const fetchImpl = (async () => {
    requests += 1
    await Promise.resolve()
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'image/webp' },
    })
  }) as typeof fetch

  const client = new MapboxRasterClient({
    accessToken: 'pk.test',
    fetchImpl,
  })

  const tile = { z: 10, x: 301, y: 385 }
  const [a, b] = await Promise.all([
    client.fetchSatellite(tile),
    client.fetchSatellite(tile),
  ])

  assert.equal(requests, 1)
  assert.deepEqual(new Uint8Array(a.bytes), new Uint8Array([1, 2, 3]))
  assert.deepEqual(new Uint8Array(b.bytes), new Uint8Array([1, 2, 3]))
})
