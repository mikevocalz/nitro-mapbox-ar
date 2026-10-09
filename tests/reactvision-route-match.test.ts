import assert from 'node:assert/strict'
import test from 'node:test'

import { projectRouteToEnu } from '../packages/reactvision/src/enu'
import { routeLengthM } from '../packages/reactvision/src/route'
import {
  cumulativeRouteLengthsM,
  projectOntoRoute,
  routeBearingAt,
} from '../packages/reactvision/src/routeMatch'
import type { EnuOrigin, GeoWorldPosition } from '../packages/reactvision/src/types'

// A real Mapbox mapbox/walking route recorded 2026-10-08 for the Harlem-Might
// navigation fixtures (studio-museum-harlem--via-sylvias--west-126th.json):
// all 22 geometry vertices, verbatim. It runs east on West 125th, north on
// Malcolm X Boulevard to Sylvia's, back down the same pavement, and west on
// West 126th, so it has parallel streets and a doubled-back stretch.
const U_ROUTE = [
  { latitude: 40.808515, longitude: -73.947544 },
  { latitude: 40.808278, longitude: -73.946987 },
  { latitude: 40.807755, longitude: -73.945734 },
  { latitude: 40.807789, longitude: -73.945709 },
  { latitude: 40.807853, longitude: -73.94567 },
  { latitude: 40.807926, longitude: -73.945611 },
  { latitude: 40.807961, longitude: -73.94558 },
  { latitude: 40.808468, longitude: -73.945204 },
  { latitude: 40.808519, longitude: -73.945166 },
  { latitude: 40.80858, longitude: -73.94512 },
  { latitude: 40.808543, longitude: -73.945032 },
  { latitude: 40.808479, longitude: -73.944882 },
  { latitude: 40.808442, longitude: -73.944795 },
  { latitude: 40.808673, longitude: -73.944623 },
  { latitude: 40.808442, longitude: -73.944795 },
  { latitude: 40.808479, longitude: -73.944882 },
  { latitude: 40.808543, longitude: -73.945032 },
  { latitude: 40.80858, longitude: -73.94512 },
  { latitude: 40.808519, longitude: -73.945166 },
  { latitude: 40.809061, longitude: -73.946453 },
  { latitude: 40.809099, longitude: -73.946542 },
  { latitude: 40.809534, longitude: -73.947575 },
]

const origin: EnuOrigin = {
  frame: { kind: 'route-start', routeId: 'u-route' },
  ...U_ROUTE[0]!,
  altitude: 0,
}

const route = projectRouteToEnu(origin, U_ROUTE)

const near = (actual: number, expected: number, tol: number, label: string): void => {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: expected ${expected} ±${tol}, got ${actual}`)
}

test('cumulative lengths end at routeLengthM on a flat route', () => {
  const cumulative = cumulativeRouteLengthsM(route)
  assert.equal(cumulative[0], 0)
  near(cumulative[cumulative.length - 1]!, routeLengthM(route), 1e-6, 'total')
  for (let i = 1; i < cumulative.length; i += 1) assert.ok(cumulative[i]! >= cumulative[i - 1]!)
})

test('a point on the route projects onto itself', () => {
  const cumulative = cumulativeRouteLengthsM(route)
  const a = route[0]!
  const b = route[1]!
  const mid: GeoWorldPosition = [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2]
  const p = projectOntoRoute(route, mid)
  assert.equal(p.segmentIndex, 0)
  near(p.t, 0.5, 1e-9, 't')
  near(p.distanceM, 0, 1e-9, 'distance')
  near(p.alongTrackM, cumulative[1]! / 2, 1e-9, 'along')
})

/** A point `offsetM` to the left of segment `i`'s midpoint (Viro axes). */
function leftOf(i: number, offsetM: number): GeoWorldPosition {
  const a = route[i]!
  const b = route[i + 1]!
  const de = b[0] - a[0]
  const dn = -(b[2] - a[2])
  const len = Math.hypot(de, dn)
  // Left normal of (east, north) is (−north, east); z = −north.
  const le = (-dn / len) * offsetM
  const ln = (de / len) * offsetM
  return [(a[0] + b[0]) / 2 + le, 0, (a[2] + b[2]) / 2 - ln]
}

test('cross-track is positive to the left of travel', () => {
  assert.ok(projectOntoRoute(route, leftOf(0, 5), { toSegment: 0 }).crossTrackM > 0)
  assert.ok(projectOntoRoute(route, leftOf(0, -5), { toSegment: 0 }).crossTrackM < 0)
  near(projectOntoRoute(route, leftOf(0, 5), { toSegment: 0 }).distanceM, 5, 1e-6, 'distance')
})

test('ignores height so a raised camera matches the same segment', () => {
  const a = route[1]!
  const low = projectOntoRoute(route, [a[0], 0, a[2]])
  const high = projectOntoRoute(route, [a[0], 1.6, a[2]])
  assert.equal(low.segmentIndex, high.segmentIndex)
  near(high.distanceM, 0, 1e-9, 'distance')
})

test('a segment window keeps a fix between West 125th and West 126th on the street being walked', () => {
  // 55 m north of West 125th is nearer West 126th, near the end of the route.
  const wild = leftOf(1, 55)
  const global = projectOntoRoute(route, wild)
  assert.ok(global.segmentIndex >= 18, `unrestricted match on segment ${global.segmentIndex}`)
  const windowed = projectOntoRoute(route, wild, { fromSegment: 0, toSegment: 2 })
  assert.ok(windowed.segmentIndex <= 1, `windowed match on segment ${windowed.segmentIndex}`)
})

test('bearings follow the route and bend at each turn', () => {
  const cumulative = cumulativeRouteLengthsM(route)
  const along = (vertex: number) => cumulative[vertex]! + 1
  const west125th = routeBearingAt(route, along(0))
  assert.ok(west125th > 100 && west125th < 135, `West 125th ${west125th}`)
  const malcolmX = routeBearingAt(route, along(6))
  assert.ok(malcolmX > 15 && malcolmX < 45, `Malcolm X Boulevard north ${malcolmX}`)
  const back = routeBearingAt(route, along(13))
  assert.ok(back > 180 && back < 240, `walking back ${back}`)
  const west126th = routeBearingAt(route, along(18))
  assert.ok(west126th > 270 && west126th < 330, `West 126th ${west126th}`)
  assert.equal(routeBearingAt(route, -10), routeBearingAt(route, 0))
  assert.equal(routeBearingAt(route, 1e6), routeBearingAt(route, cumulative[cumulative.length - 1]! - 0.1))
})

test('skips zero-length segments', () => {
  const doubled: GeoWorldPosition[] = [route[0]!, route[0]!, route[1]!, route[1]!, route[2]!]
  const p = projectOntoRoute(doubled, route[1]!)
  near(p.distanceM, 0, 1e-9, 'distance')
  assert.ok(Number.isFinite(routeBearingAt(doubled, 0)))
})

test('rejects invalid input', () => {
  assert.throws(() => cumulativeRouteLengthsM([route[0]!]), RangeError)
  assert.throws(() => projectOntoRoute(route, [Number.NaN, 0, 0]), RangeError)
  assert.throws(() => projectOntoRoute(route, [0, 0, 0], { fromSegment: 3, toSegment: 1 }), RangeError)
  assert.throws(() => projectOntoRoute(route, [0, 0, 0], { toSegment: 99 }), RangeError)
  assert.throws(() => projectOntoRoute([route[0]!, route[0]!], [0, 0, 0]), RangeError)
  assert.throws(() => routeBearingAt(route, Number.POSITIVE_INFINITY), RangeError)
  assert.throws(() => routeBearingAt([route[0]!, route[0]!], 0), RangeError)
})
