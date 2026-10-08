import assert from 'node:assert/strict'
import test from 'node:test'

import {
  enuToViroPosition,
  projectRouteToEnu,
  projectToDeviceFrame,
  projectToEnu,
  solveEnuPlacement,
} from '../packages/reactvision/src/enu'
import type { EnuOrigin } from '../packages/reactvision/src/types'
import { vincentyInverse, webMercatorDistanceM } from './helpers/geodesic'

// WGS84 [lat, lng] from Harlem-Might packages/app/features/explore/explore.store.ts
// (OpenStreetMap Nominatim). Expected ENU values below were computed once with
// WGS84 -> ECEF -> ENU and cross-checked against Vincenty's inverse.
const APOLLO = { latitude: 40.8100895, longitude: -73.9499948 }
const PLACES = {
  'red-rooster-harlem': { latitude: 40.8079659, longitude: -73.9449105, east: 429.008, north: -235.814 },
  'sylvias-restaurant': { latitude: 40.8086285, longitude: -73.9445189, east: 462.046, north: -162.23 },
  'schomburg-center': { latitude: 40.8146476, longitude: -73.9409874, east: 759.958, north: 506.217 },
  'studio-museum-harlem': { latitude: 40.8084179, longitude: -73.947616, east: 200.719, north: -185.629 },
  'marcus-garvey-park': { latitude: 40.8044856, longitude: -73.943669, east: 533.792, north: -622.295 },
} as const

const origin: EnuOrigin = {
  frame: { kind: 'place', placeId: 'apollo-theater' },
  ...APOLLO,
  altitude: 0,
}

const TOLERANCE_M = 0.5
// Fixture values carry three decimals; ECEF and Vincenty agree to the millimetre.
const FIXTURE_TOLERANCE_M = 0.01
const toDeg = (rad: number): number => (rad * 180) / Math.PI
const near = (actual: number, expected: number, tol: number, label: string): void => {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected} ±${tol}, got ${actual}`,
  )
}

test('the origin projects to a zero offset in its own frame', () => {
  const offset = projectToEnu(origin, { ...APOLLO, altitude: 0 })
  assert.deepEqual(offset.frame, origin.frame)
  near(offset.eastM, 0, 1e-6, 'east')
  near(offset.northM, 0, 1e-6, 'north')
  near(offset.upM, 0, 1e-6, 'up')
})

for (const [placeId, place] of Object.entries(PLACES)) {
  test(`${placeId}: ENU matches the hardcoded ECEF result and Vincenty`, () => {
    const offset = projectToEnu(origin, { ...place, altitude: 0 })
    near(offset.eastM, place.east, FIXTURE_TOLERANCE_M, 'east')
    near(offset.northM, place.north, FIXTURE_TOLERANCE_M, 'north')

    const geodesic = vincentyInverse(
      APOLLO.latitude,
      APOLLO.longitude,
      place.latitude,
      place.longitude,
    )
    near(Math.hypot(offset.eastM, offset.northM), geodesic.distanceM, FIXTURE_TOLERANCE_M, 'distance')
    const bearing = (toDeg(Math.atan2(offset.eastM, offset.northM)) + 360) % 360
    near(bearing, geodesic.initialBearingDeg, 0.01, 'bearing')
  })
}

test('Web Mercator (Viro gpsToArWorld) overstates Harlem distances by about 32%', () => {
  const s = PLACES['schomburg-center']
  const mercator = webMercatorDistanceM(APOLLO.latitude, APOLLO.longitude, s.latitude, s.longitude)
  const offset = projectToEnu(origin, { ...s, altitude: 0 })
  near(Math.hypot(offset.eastM, offset.northM), 913.122, TOLERANCE_M, 'ENU')
  near(mercator, 1206.2, 0.5, 'Mercator')
})

test('up follows ellipsoidal height and includes Earth curvature', () => {
  near(projectToEnu(origin, { ...APOLLO, altitude: 10 }).upM, 10, 1e-6, 'straight up')
  // 913 m away at the same ellipsoidal height sits d²/2R ≈ 6.5 cm below the tangent plane.
  near(projectToEnu(origin, { ...PLACES['schomburg-center'], altitude: 0 }).upM, -0.065, 0.002, 'curvature')
})

test('ENU maps onto Viro axes as x = east, y = up, z = -north', () => {
  assert.deepEqual(
    enuToViroPosition({ frame: origin.frame, eastM: 3, northM: 4, upM: 5 }),
    [3, 5, -4],
  )
})

test('projectToEnu rejects invalid input', () => {
  assert.throws(() => projectToEnu({ ...origin, altitude: Number.NaN }, { ...APOLLO, altitude: 0 }), /altitude/)
  assert.throws(() => projectToEnu(origin, { latitude: 91, longitude: 0, altitude: 0 }), /latitude/)
})

const pose = {
  latitude: APOLLO.latitude,
  longitude: APOLLO.longitude,
  altitude: 12,
  heading: 0,
  quaternion: [0, 0, 0, 1] as [number, number, number, number],
  horizontalAccuracy: 1,
  verticalAccuracy: 1,
  headingAccuracy: 1,
  orientationYawAccuracy: 1,
}

test('device-frame projector facing north gives [east, dAlt, -north] in metres', () => {
  const s = PLACES['schomburg-center']
  const [x, y, z] = projectToDeviceFrame(pose, s.latitude, s.longitude, 12)
  near(x, s.east, TOLERANCE_M, 'x')
  near(y, 0, 0.1, 'y')
  near(z, -s.north, TOLERANCE_M, 'z')
})

test('device-frame projector rotates by compass heading', () => {
  const s = PLACES['schomburg-center']
  // Facing east, a point due east is straight ahead (-z) and north is to the left (-x).
  const [x, , z] = projectToDeviceFrame({ ...pose, heading: 90 }, s.latitude, s.longitude, 12)
  near(x, -s.north, TOLERANCE_M, 'x')
  near(z, -s.east, TOLERANCE_M, 'z')
})

test('device-frame projector keeps distance and turns bearing by any heading', () => {
  const s = PLACES['marcus-garvey-park']
  const trueBearing = toDeg(Math.atan2(s.east, s.north))
  for (const heading of [37, 211.5, -64]) {
    const [x, , z] = projectToDeviceFrame({ ...pose, heading }, s.latitude, s.longitude, 12)
    near(Math.hypot(x, z), Math.hypot(s.east, s.north), FIXTURE_TOLERANCE_M, 'distance')
    const relative = toDeg(Math.atan2(x, -z))
    const delta = ((((relative - (trueBearing - heading)) % 360) + 540) % 360) - 180
    // Fixture east/north are rounded to 1 mm, about 1e-4° at this range.
    near(delta, 0, 1e-3, `heading ${heading}`)
  }
  assert.throws(
    () => projectToDeviceFrame({ ...pose, heading: Number.NaN }, s.latitude, s.longitude, 12),
    /heading/,
  )
})

test('route projection to ENU falls back to the origin altitude and applies verticalOffset', () => {
  const routeOrigin: EnuOrigin = {
    frame: { kind: 'route-start', routeId: 'r1' },
    ...APOLLO,
    altitude: 20,
  }
  const s = PLACES['studio-museum-harlem']
  const points = projectRouteToEnu(
    routeOrigin,
    [APOLLO, { latitude: s.latitude, longitude: s.longitude, altitude: 30 }],
    { verticalOffset: 0.5 },
  )
  assert.equal(points.length, 2)
  near(points[0][0], 0, 1e-6, 'start x')
  near(points[0][1], 0.5, 1e-6, 'start y')
  near(points[1][0], s.east, TOLERANCE_M, 'end x')
  near(points[1][1], 10.5, 0.05, 'end y')
  near(points[1][2], -s.north, TOLERANCE_M, 'end z')
})

test('route projection to ENU is deterministic for a fixed origin', () => {
  const route = Object.values(PLACES).map(({ latitude, longitude }) => ({ latitude, longitude }))
  assert.deepEqual(projectRouteToEnu(origin, route), projectRouteToEnu(origin, route))
})

// Right-handed rotation about +Y, as applied by a node's `rotation: [0, θ, 0]`.
const rotateY = ([x, y, z]: readonly [number, number, number], deg: number): [number, number, number] => {
  const t = (deg * Math.PI) / 180
  return [x * Math.cos(t) + z * Math.sin(t), y, -x * Math.sin(t) + z * Math.cos(t)]
}

test('solveEnuPlacement recovers the yaw between ENU and the AR world frame', () => {
  const reference = projectToEnu(origin, { ...PLACES['schomburg-center'], altitude: 0 })
  const local = enuToViroPosition(reference)
  const worldOrigin: [number, number, number] = [1.5, -0.2, 4]
  for (const yawDeg of [0, 37, -120, 179]) {
    const rotated = rotateY(local, yawDeg)
    const referenceWorld: [number, number, number] = [
      worldOrigin[0] + rotated[0],
      worldOrigin[1] + rotated[1],
      worldOrigin[2] + rotated[2],
    ]
    const placement = solveEnuPlacement({
      originWorldPosition: worldOrigin,
      referenceWorldPosition: referenceWorld,
      reference,
    })
    assert.deepEqual(placement.position, worldOrigin)
    assert.equal(placement.rotation[0], 0)
    assert.equal(placement.rotation[2], 0)
    const delta = (((placement.rotation[1] - yawDeg) % 360) + 540) % 360 - 180
    near(delta, 0, 1e-9, `yaw ${yawDeg}`)
  }
})

test('solveEnuPlacement refuses a reference too close to the origin', () => {
  assert.throws(
    () =>
      solveEnuPlacement({
        originWorldPosition: [0, 0, 0],
        referenceWorldPosition: [0.1, 0, 0],
        reference: { frame: origin.frame, eastM: 0.1, northM: 0, upM: 0 },
      }),
    /reference/,
  )
})
