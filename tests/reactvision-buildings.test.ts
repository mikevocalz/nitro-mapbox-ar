import assert from 'node:assert/strict'
import test from 'node:test'

import { extrudeBuildings, type BuildingMesh } from '../packages/reactvision/src/buildings'
import { projectToEnu, unprojectFromEnu } from '../packages/reactvision/src/enu'
import { groundTileQuad, tilesAroundEnuPoint } from '../packages/reactvision/src/ground'
import { readVectorTileLayer } from '../packages/reactvision/src/mvt'
import { tilePointToLngLat } from '../packages/reactvision/src/tile'
import type { EnuOrigin } from '../packages/reactvision/src/types'
import { latToTileY, lonToTileX } from '../src/mapbox/tiles'
import { encodeVectorTile, exteriorRect, interiorRect } from './helpers/mvt'

// Apollo Theater, from Harlem-Might's explore store (OpenStreetMap Nominatim).
const APOLLO = { latitude: 40.8100895, longitude: -73.9499948 }
const origin: EnuOrigin = {
  frame: { kind: 'place', placeId: 'apollo-theater' },
  ...APOLLO,
  altitude: 0,
}
const TILE = { z: 16, x: lonToTileX(APOLLO.longitude, 16), y: latToTileY(APOLLO.latitude, 16) }
const EXTENT = 4096

const buildingTile = (
  features: Parameters<typeof encodeVectorTile>[0][number]['features'],
): Uint8Array => encodeVectorTile([
  { name: 'water', features: [{ type: 3, rings: [exteriorRect(0, 0, 10, 10)] }] },
  { name: 'building', extent: EXTENT, features },
])

const enuOf = (px: number, py: number) => {
  const { latitude, longitude } = tilePointToLngLat(TILE, px, py, EXTENT)
  return projectToEnu(origin, { latitude, longitude, altitude: 0 })
}

interface Triangle {
  readonly geometric: [number, number, number]
  readonly stored: [number, number, number]
}

function triangles(mesh: BuildingMesh): Triangle[] {
  const out: Triangle[] = []
  const p = mesh.positions
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [mesh.indices[t]!, mesh.indices[t + 1]!, mesh.indices[t + 2]!]
    const u = [p[b * 3]! - p[a * 3]!, p[b * 3 + 1]! - p[a * 3 + 1]!, p[b * 3 + 2]! - p[a * 3 + 2]!]
    const v = [p[c * 3]! - p[a * 3]!, p[c * 3 + 1]! - p[a * 3 + 1]!, p[c * 3 + 2]! - p[a * 3 + 2]!]
    out.push({
      geometric: [
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ],
      stored: [mesh.normals[a * 3]!, mesh.normals[a * 3 + 1]!, mesh.normals[a * 3 + 2]!],
    })
  }
  return out
}

const dot = (a: readonly number[], b: readonly number[]): number =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!

test('readVectorTileLayer reads one layer and its typed properties', () => {
  const bytes = encodeVectorTile([
    { name: 'road', features: [{ type: 2, rings: [[[0, 0], [5, 5]]] }] },
    {
      name: 'building',
      extent: 512,
      features: [
        {
          id: 7,
          type: 3,
          properties: { height: 21.5, min_height: 3, extrude: 'true', type: 'apartments', flag: true, delta: -4, depth: -2048 },
          rings: [exteriorRect(10, 10, 20, 30)],
        },
      ],
    },
  ])
  const layer = readVectorTileLayer(bytes, 'building')
  assert.ok(layer)
  assert.equal(layer.extent, 512)
  assert.equal(layer.features.length, 1)
  const [feature] = layer.features
  assert.equal(feature!.id, 7)
  assert.equal(feature!.type, 'polygon')
  assert.deepEqual(feature!.properties, {
    height: 21.5,
    min_height: 3,
    extrude: 'true',
    type: 'apartments',
    flag: true,
    delta: -4,
    depth: -2048,
  })
  assert.deepEqual(feature!.geometry, [[10, 10, 20, 10, 20, 30, 10, 30]])
  assert.equal(readVectorTileLayer(bytes, 'poi_label'), undefined)
})

test('readVectorTileLayer rejects truncated bytes', () => {
  const bytes = buildingTile([{ type: 3, rings: [exteriorRect(0, 0, 50, 50)] }])
  assert.throws(() => readVectorTileLayer(bytes.subarray(0, bytes.length - 3), 'building'), RangeError)
})

test('a box building becomes a closed prism at the right place and height', () => {
  const mesh = extrudeBuildings(
    buildingTile([{ type: 3, properties: { height: 20, extrude: 'true' }, rings: [exteriorRect(1000, 1000, 1100, 1200)] }]),
    TILE,
    origin,
  )
  assert.equal(mesh.buildingCount, 1)
  assert.equal(mesh.estimatedHeightCount, 0)
  // Roof: 4 vertices, 2 triangles. Walls: 4 quads of 4 vertices, 2 triangles.
  assert.equal(mesh.positions.length / 3, 4 + 16)
  assert.equal(mesh.indices.length / 3, 2 + 8)

  const ys = new Set<number>()
  for (let i = 1; i < mesh.positions.length; i += 3) ys.add(mesh.positions[i]!)
  assert.deepEqual([...ys].sort((a, b) => a - b), [0, 20])

  const nw = enuOf(1000, 1000)
  const se = enuOf(1100, 1200)
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (let i = 0; i < mesh.positions.length; i += 3) {
    minX = Math.min(minX, mesh.positions[i]!)
    maxX = Math.max(maxX, mesh.positions[i]!)
    minZ = Math.min(minZ, mesh.positions[i + 2]!)
    maxZ = Math.max(maxZ, mesh.positions[i + 2]!)
  }
  // Float32 storage: centimetre agreement at a few hundred metres.
  assert.ok(Math.abs(minX - nw.eastM) < 0.01)
  assert.ok(Math.abs(maxX - se.eastM) < 0.01)
  assert.ok(Math.abs(minZ - -nw.northM) < 0.01)
  assert.ok(Math.abs(maxZ - -se.northM) < 0.01)
})

test('every triangle winds counter-clockwise toward its stored normal', () => {
  const mesh = extrudeBuildings(
    buildingTile([
      // An L-shaped footprint (concave) and a raised part with a hole.
      {
        type: 3,
        properties: { height: 30 },
        rings: [[[100, 100], [400, 100], [400, 200], [200, 200], [200, 400], [100, 400]]],
      },
      {
        type: 3,
        properties: { height: 40, min_height: 10 },
        rings: [exteriorRect(1000, 1000, 1400, 1400), interiorRect(1100, 1100, 1300, 1300)],
      },
    ]),
    TILE,
    origin,
  )
  assert.equal(mesh.buildingCount, 2)
  const all = triangles(mesh)
  assert.ok(all.length > 0)
  for (const t of all) {
    assert.ok(dot(t.geometric, t.stored) > 0, `triangle faces away from its normal ${t.stored}`)
  }
})

test('walls face outward, including the walls of a courtyard', () => {
  const mesh = extrudeBuildings(
    buildingTile([
      {
        type: 3,
        properties: { height: 15 },
        rings: [exteriorRect(1000, 1000, 1400, 1400), interiorRect(1100, 1100, 1300, 1300)],
      },
    ]),
    TILE,
    origin,
  )
  const centre = enuOf(1200, 1200)
  const p = mesh.positions
  let inner = 0
  let outer = 0
  for (let v = 0; v < p.length / 3; v += 1) {
    const ny = mesh.normals[v * 3 + 1]!
    if (ny !== 0) continue
    const dx = p[v * 3]! - centre.eastM
    const dz = p[v * 3 + 2]! + centre.northM
    const facing = dx * mesh.normals[v * 3]! + dz * mesh.normals[v * 3 + 2]!
    const radius = Math.max(Math.abs(dx), Math.abs(dz))
    const halfInner = (enuOf(1300, 1200).eastM - enuOf(1100, 1200).eastM) / 2
    if (radius < halfInner + 0.5) {
      inner += 1
      assert.ok(facing < 0, 'courtyard walls face the courtyard centre')
    } else {
      outer += 1
      assert.ok(facing > 0, 'outer walls face away from the centre')
    }
  }
  assert.equal(inner, 16)
  assert.equal(outer, 16)
})

test('missing heights use the default and are counted as estimated', () => {
  const mesh = extrudeBuildings(
    buildingTile([{ type: 3, rings: [exteriorRect(0 + 50, 50, 150, 150)] }]),
    TILE,
    origin,
    { defaultHeightM: 9 },
  )
  assert.equal(mesh.estimatedHeightCount, 1)
  let top = 0
  for (let i = 1; i < mesh.positions.length; i += 3) top = Math.max(top, mesh.positions[i]!)
  assert.equal(top, 9)
})

test('underground parts and parts marked extrude=false are skipped', () => {
  const mesh = extrudeBuildings(
    buildingTile([
      { type: 3, properties: { height: 10, underground: 'true' }, rings: [exteriorRect(0, 0, 100, 100)] },
      { type: 3, properties: { height: 10, extrude: 'false' }, rings: [exteriorRect(200, 200, 300, 300)] },
      { type: 2, properties: { height: 10 }, rings: [[[0, 0], [10, 10]]] },
    ]),
    TILE,
    origin,
  )
  assert.equal(mesh.buildingCount, 0)
  assert.equal(mesh.positions.length, 0)
  assert.equal(mesh.indices.length, 0)
})

test('heights clamp to maxHeightM', () => {
  const mesh = extrudeBuildings(
    buildingTile([{ type: 3, properties: { height: 9000 }, rings: [exteriorRect(10, 10, 60, 60)] }]),
    TILE,
    origin,
    { maxHeightM: 300 },
  )
  let top = 0
  for (let i = 1; i < mesh.positions.length; i += 3) top = Math.max(top, mesh.positions[i]!)
  assert.equal(top, 300)
})

test('a footprint crossing the tile edge is clipped and gets no wall on the edge', () => {
  // Spans the east edge (x = 4096) inside the vector tile buffer.
  const mesh = extrudeBuildings(
    buildingTile([{ type: 3, properties: { height: 12 }, rings: [exteriorRect(4000, 2000, 4200, 2100)] }]),
    TILE,
    origin,
  )
  const edge = enuOf(EXTENT, 2050).eastM
  let maxX = -Infinity
  for (let i = 0; i < mesh.positions.length; i += 3) maxX = Math.max(maxX, mesh.positions[i]!)
  assert.ok(Math.abs(maxX - edge) < 0.01, 'nothing past the tile edge')
  // Three real walls remain; the clip edge has none.
  const wallVertices = (mesh.positions.length / 3) - 4
  assert.equal(wallVertices, 12)
})

test('within keeps only buildings near a ground point', () => {
  const bytes = buildingTile([
    { type: 3, properties: { height: 10 }, rings: [exteriorRect(100, 100, 150, 150)] },
    { type: 3, properties: { height: 10 }, rings: [exteriorRect(3900, 3900, 3950, 3950)] },
  ])
  const near = enuOf(125, 125)
  const mesh = extrudeBuildings(bytes, TILE, origin, {
    within: { center: { eastM: near.eastM, northM: near.northM }, radiusM: 50 },
  })
  assert.equal(mesh.buildingCount, 1)
})

test('a tile without a building layer gives an empty mesh', () => {
  const mesh = extrudeBuildings(encodeVectorTile([{ name: 'water', features: [] }]), TILE, origin)
  assert.equal(mesh.buildingCount, 0)
  assert.deepEqual(mesh.tile, TILE)
})

test('bad options and tiles throw RangeError', () => {
  const bytes = buildingTile([])
  assert.throws(() => extrudeBuildings(bytes, { z: 16, x: -1, y: 0 }, origin), RangeError)
  assert.throws(() => extrudeBuildings(bytes, TILE, origin, { defaultHeightM: 0 }), RangeError)
  assert.throws(() => extrudeBuildings(bytes, TILE, origin, { maxHeightM: Number.NaN }), RangeError)
  assert.throws(
    () => extrudeBuildings(bytes, TILE, origin, { within: { center: { eastM: 0, northM: 0 }, radiusM: -1 } }),
    RangeError,
  )
})

test('unprojectFromEnu round-trips projectToEnu across Harlem', () => {
  for (const [east, north, up] of [
    [0, 0, 0],
    [429.008, -235.814, 0],
    [-800, 1200, 35],
    [1500, 1500, -10],
  ] as const) {
    const back = unprojectFromEnu(origin, { eastM: east, northM: north, upM: up })
    const again = projectToEnu(origin, back)
    assert.ok(Math.abs(again.eastM - east) < 1e-4, `east ${again.eastM} vs ${east}`)
    assert.ok(Math.abs(again.northM - north) < 1e-4, `north ${again.northM} vs ${north}`)
    assert.ok(Math.abs(again.upM - up) < 1e-4, `up ${again.upM} vs ${up}`)
  }
  assert.throws(() => unprojectFromEnu(origin, { eastM: Number.NaN, northM: 0, upM: 0 }), RangeError)
})

test('groundTileQuad sizes a z17 tile to its Web Mercator span at Harlem', () => {
  const tile = { z: 17, x: lonToTileX(APOLLO.longitude, 17), y: latToTileY(APOLLO.latitude, 17) }
  const quad = groundTileQuad(origin, tile)
  // Equatorial tile span divided by the Mercator scale 1/cos(latitude).
  const expected = (40075016.686 / 2 ** 17) * Math.cos((APOLLO.latitude * Math.PI) / 180)
  assert.ok(Math.abs(quad.widthM - expected) / expected < 0.005, `width ${quad.widthM} vs ${expected}`)
  assert.ok(Math.abs(quad.depthM - expected) / expected < 0.005, `depth ${quad.depthM} vs ${expected}`)
  assert.equal(quad.position[1], 0)
  // The origin lies inside its own tile.
  assert.ok(Math.abs(quad.position[0]) <= quad.widthM / 2)
  assert.ok(Math.abs(quad.position[2]) <= quad.depthM / 2)
  assert.equal(quad.key, `17/${tile.x}/${tile.y}`)
})

test('tilesAroundEnuPoint starts with the tile under the point and covers the circle', () => {
  const tiles = tilesAroundEnuPoint(origin, { eastM: 0, northM: 0 }, 300, 17)
  const own = { z: 17, x: lonToTileX(APOLLO.longitude, 17), y: latToTileY(APOLLO.latitude, 17) }
  assert.deepEqual(tiles[0], own)
  // A 600 m square of ~231 m tiles needs 3 to 4 columns and rows.
  assert.ok(tiles.length >= 9 && tiles.length <= 16, `got ${tiles.length}`)
  assert.throws(() => tilesAroundEnuPoint(origin, { eastM: 0, northM: 0 }, 0, 17), RangeError)
  assert.throws(() => tilesAroundEnuPoint(origin, { eastM: 0, northM: 0 }, 10, 31), RangeError)
})
