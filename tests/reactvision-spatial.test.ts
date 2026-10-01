import assert from 'node:assert/strict'
import test from 'node:test'

import {
  chunkWorldRoute,
  projectRouteToWorld,
} from '../packages/reactvision/src/route'
import {
  validateCoordinate,
  validateSurfaceOffset,
} from '../packages/reactvision/src/geo'

const pose = {
  latitude: 40.0,
  longitude: -73.0,
  altitude: 12,
  heading: 0,
  quaternion: [0, 0, 0, 1] as [number, number, number, number],
  horizontalAccuracy: 1,
  verticalAccuracy: 1,
  headingAccuracy: 1,
  orientationYawAccuracy: 1,
}

test('coordinate validation rejects impossible latitude/longitude', () => {
  assert.throws(
    () => validateCoordinate({ latitude: 91, longitude: 0 }),
    /latitude/,
  )
  assert.throws(
    () => validateCoordinate({ latitude: 0, longitude: -181 }),
    /longitude/,
  )
})

test('WGS84 validation can require altitude explicitly', () => {
  assert.throws(
    () =>
      validateCoordinate(
        { latitude: 40, longitude: -73 },
        { requireAltitude: true },
      ),
    /altitude/,
  )
})

test('surface offsets default to zero and reject non-finite values', () => {
  assert.equal(validateSurfaceOffset(undefined), 0)
  assert.equal(validateSurfaceOffset(2.5), 2.5)
  assert.throws(() => validateSurfaceOffset(Number.NaN), /finite/)
})

test('route projection uses camera altitude only when route Z is absent', () => {
  const projector = (
    _pose: typeof pose,
    lat: number,
    lng: number,
    altitude: number,
  ): [number, number, number] => [lat, altitude, lng]

  const points = projectRouteToWorld(
    projector,
    pose,
    [
      { latitude: 40.1, longitude: -73.1 },
      { latitude: 40.2, longitude: -73.2, altitude: 30 },
    ],
    { verticalOffset: 0.5 },
  )

  assert.deepEqual(points, [
    [40.1, 12.5, -73.1],
    [40.2, 30.5, -73.2],
  ])
})

test('route chunks overlap by one point so line segments remain continuous', () => {
  const points = Array.from(
    { length: 10 },
    (_, index) => [index, 0, 0] as const,
  )
  const chunks = chunkWorldRoute(points, 4)

  assert.deepEqual(chunks.map((chunk) => chunk.length), [4, 4, 4])
  assert.deepEqual(chunks[0][3], chunks[1][0])
  assert.deepEqual(chunks[1][3], chunks[2][0])
})
