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
import { projectToDeviceFrame } from '../packages/reactvision/src/enu'

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
  // Points due north of the pose, measured on WGS84 by the real projector.
  const points = projectRouteToWorld(
    projectToDeviceFrame,
    pose,
    [
      { latitude: 40.001, longitude: -73.0 },
      { latitude: 40.002, longitude: -73.0, altitude: 30 },
    ],
    { verticalOffset: 0.5 },
  )

  // One thousandth of a degree of latitude at 40°N is 111.03 m.
  assert.ok(Math.abs(points[0][0]) < 1e-6)
  assert.ok(Math.abs(points[0][1] - 0.5) < 1e-9)
  assert.ok(Math.abs(points[0][2] + 111.03) < 0.05, `got ${points[0][2]}`)
  assert.ok(Math.abs(points[1][1] - 18.5) < 1e-9)
  assert.ok(Math.abs(points[1][2] + 222.06) < 0.1, `got ${points[1][2]}`)
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

test('chunking bounds every polyline at maxPoints and adds one vertex per seam', () => {
  // A 3 km walk resampled at 2 m is about 1500 vertices.
  const total = 1500
  const maxPoints = 128
  const points = Array.from({ length: total }, (_, i) => [i, 0, 0] as const)
  const chunks = chunkWorldRoute(points, maxPoints)

  assert.equal(chunks.length, Math.ceil((total - 1) / (maxPoints - 1)))
  assert.ok(chunks.every((chunk) => chunk.length <= maxPoints))
  assert.equal(
    chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    total + chunks.length - 1,
  )
  assert.deepEqual(chunks.at(-1)?.at(-1), points.at(-1))
})
