import assert from 'node:assert/strict'
import test from 'node:test'

import { projectRouteToEnu } from '../packages/reactvision/src/enu'
import { pointAlongRoute, routeLengthM } from '../packages/reactvision/src/route'
import type { EnuOrigin, GeoWorldPosition } from '../packages/reactvision/src/types'

// Apollo Theater -> Studio Museum -> Sylvia's, WGS84 from Harlem-Might
// packages/app/features/explore/explore.store.ts.
const APOLLO = { latitude: 40.8100895, longitude: -73.9499948 }
const STUDIO_MUSEUM = { latitude: 40.8084179, longitude: -73.947616 }
const SYLVIAS = { latitude: 40.8086285, longitude: -73.9445189 }

const origin: EnuOrigin = {
  frame: { kind: 'place', placeId: 'apollo-theater' },
  ...APOLLO,
  altitude: 0,
}

const near = (actual: number, expected: number, tol: number, label: string): void => {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: expected ${expected} ±${tol}, got ${actual}`,
  )
}

const assertPoint = (
  actual: GeoWorldPosition,
  expected: GeoWorldPosition,
  tol: number,
): void => {
  near(actual[0], expected[0], tol, 'x')
  near(actual[1], expected[1], tol, 'y')
  near(actual[2], expected[2], tol, 'z')
}

test('routeLengthM sums segment lengths in metres', () => {
  const points: GeoWorldPosition[] = [[0, 0, 0], [3, 0, -4], [3, 0, -10]]
  assert.equal(routeLengthM(points), 11)
})

test('routeLengthM is 0 for a single point and throws for none', () => {
  assert.equal(routeLengthM([[1, 2, 3]]), 0)
  assert.throws(() => routeLengthM([]), RangeError)
})

test('pointAlongRoute returns the first point at 0 and the last at the full length', () => {
  const points: GeoWorldPosition[] = [[0, 0, 0], [3, 0, -4], [3, 0, -10]]
  assertPoint(pointAlongRoute(points, 0), [0, 0, 0], 1e-9)
  assertPoint(pointAlongRoute(points, 11), [3, 0, -10], 1e-9)
})

test('pointAlongRoute interpolates inside a segment', () => {
  assertPoint(pointAlongRoute([[0, 0, 0], [10, 2, 0]], Math.hypot(10, 2) / 2), [5, 1, 0], 1e-9)
  assertPoint(pointAlongRoute([[0, 0, 0], [3, 0, -4], [3, 0, -10]], 8), [3, 0, -7], 1e-9)
})

test('pointAlongRoute clamps distances outside the route', () => {
  const points: GeoWorldPosition[] = [[0, 0, 0], [0, 0, -5]]
  assertPoint(pointAlongRoute(points, -3), [0, 0, 0], 1e-9)
  assertPoint(pointAlongRoute(points, 50), [0, 0, -5], 1e-9)
})

test('pointAlongRoute skips zero-length segments', () => {
  const points: GeoWorldPosition[] = [[0, 0, 0], [0, 0, 0], [4, 0, 0]]
  assertPoint(pointAlongRoute(points, 1), [1, 0, 0], 1e-9)
})

test('pointAlongRoute rejects non-finite distances and empty routes', () => {
  assert.throws(() => pointAlongRoute([[0, 0, 0], [1, 0, 0]], Number.NaN), RangeError)
  assert.throws(() => pointAlongRoute([[0, 0, 0], [1, 0, 0]], Infinity), RangeError)
  assert.throws(() => pointAlongRoute([], 0), RangeError)
})

test('pointAlongRoute on a projected Harlem route stays on the WGS84 ENU geometry', () => {
  const projected = projectRouteToEnu(origin, [APOLLO, STUDIO_MUSEUM, SYLVIAS])
  const length = routeLengthM(projected)
  // WGS84 ENU from Apollo: Apollo -> Studio Museum 273.40 m, Studio Museum ->
  // Sylvia's 262.37 m. The tolerance tests projection and summation together.
  near(length, 535.77, 0.05, 'route length')

  // The first leg ends at the Studio Museum.
  const firstLeg = routeLengthM(projected.slice(0, 2))
  assertPoint(pointAlongRoute(projected, firstLeg), projected[1]!, 1e-6)

  // Halfway along the first leg lies halfway between Apollo and the museum.
  const half = pointAlongRoute(projected, firstLeg / 2)
  assertPoint(half, [projected[1]![0] / 2, projected[1]![1] / 2, projected[1]![2] / 2], 1e-6)
})
