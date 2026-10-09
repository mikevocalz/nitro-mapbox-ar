import assert from 'node:assert/strict'
import test from 'node:test'

import { layoutRouteChevrons } from '../packages/reactvision/src/chevrons'
import { projectRouteToEnu } from '../packages/reactvision/src/enu'
import { projectOntoRoute, routeBearingAt } from '../packages/reactvision/src/routeMatch'
import type { EnuOrigin, GeoWorldPosition } from '../packages/reactvision/src/types'

const near = (actual: number, expected: number, tol: number, label: string): void => {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: expected ${expected} ±${tol}, got ${actual}`)
}

// An L in Viro axes: 20 m north (−z), then 20 m east (+x).
const L_ROUTE: GeoWorldPosition[] = [
  [0, 0, 0],
  [0, 0, -20],
  [20, 0, -20],
]

test('chevrons are world fixed on multiples of the spacing', () => {
  const a = layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0.3 })
  const b = layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0.9 })
  assert.deepEqual(a.map((c) => c.alongTrackM), [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25])
  assert.equal(b[0]!.alongTrackM, 5, 'first chevron at least 2 m ahead')
  for (const c of a) near(c.alongTrackM % 2.5, 0, 1e-9, 'phase')
})

test('chevrons stop at the stop distance, the route end, the lookahead or maxCount', () => {
  const toTurn = layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0, stopAlongTrackM: 25 })
  assert.equal(toTurn[toTurn.length - 1]!.alongTrackM, 25, 'next manoeuvre + 5 m')
  const end = layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 30, maxCount: 50 })
  assert.equal(end[end.length - 1]!.alongTrackM, 40, 'route end')
  const short = layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0, lookaheadM: 8 })
  assert.deepEqual(short.map((c) => c.alongTrackM), [2.5, 5, 7.5])
  assert.equal(layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0, maxCount: 4 }).length, 4)
  assert.equal(layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 39 }).length, 0, 'past the end')
  assert.equal(layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0, stopAlongTrackM: 1 }).length, 0)
})

test('chevrons face along the route and bend at the turn', () => {
  const chevrons = layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 10, maxCount: 10 })
  const beforeTurn = chevrons.filter((c) => c.alongTrackM < 20)
  const afterTurn = chevrons.filter((c) => c.alongTrackM >= 20)
  assert.ok(beforeTurn.length > 0 && afterTurn.length > 0)
  for (const c of beforeTurn) {
    near(c.bearingDeg, 0, 1e-9, 'north leg bearing')
    near(c.rotation[1], 0, 1e-9, 'north leg yaw')
  }
  for (const c of afterTurn) {
    near(c.bearingDeg, 90, 1e-9, 'east leg bearing')
    near(c.rotation[1], -90, 1e-9, 'Viro yaw is −bearing')
  }
})

test('Viro yaw −bearing turns a −z arrow onto the bearing', () => {
  // A chevron authored pointing at −z, rotated by [0, yaw, 0].
  for (const bearing of [0, 45, 90, 180, 270, 359]) {
    const yaw = (-bearing * Math.PI) / 180
    const x = Math.sin(yaw) * -1
    const z = Math.cos(yaw) * -1
    const east = x
    const north = -z
    near(east, Math.sin((bearing * Math.PI) / 180), 1e-9, `east ${bearing}`)
    near(north, Math.cos((bearing * Math.PI) / 180), 1e-9, `north ${bearing}`)
  }
})

test('chevron positions lie on the route geometry', () => {
  for (const c of layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0, maxCount: 20, lookaheadM: 40 })) {
    const match = projectOntoRoute(L_ROUTE, c.position)
    near(match.distanceM, 0, 1e-9, `on route at ${c.alongTrackM}`)
    near(match.alongTrackM, c.alongTrackM, 1e-9, 'along-track')
  }
})

test('the last chevrons fade only when the lookahead cuts the run', () => {
  const cut = layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0, lookaheadM: 25, maxCount: 20 })
  assert.deepEqual(cut.slice(-3).map((c) => c.opacity), [0.75, 0.5, 0.25])
  assert.ok(cut.slice(0, -3).every((c) => c.opacity === 1))
  const atTurn = layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0, stopAlongTrackM: 20 })
  assert.ok(atTurn.every((c) => c.opacity === 1), 'no fade before a manoeuvre')
  const none = layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0, lookaheadM: 25, fadeCount: 0 })
  assert.ok(none.every((c) => c.opacity === 1))
})

test('bearings match routeBearingAt on a recorded Harlem route', () => {
  // West 125th then Malcolm X Boulevard, from the recorded mapbox/walking
  // fixture used in reactvision-route-match.test.ts (first 8 vertices).
  const coords = [
    { latitude: 40.808515, longitude: -73.947544 },
    { latitude: 40.808278, longitude: -73.946987 },
    { latitude: 40.807755, longitude: -73.945734 },
    { latitude: 40.807789, longitude: -73.945709 },
    { latitude: 40.807853, longitude: -73.94567 },
    { latitude: 40.807926, longitude: -73.945611 },
    { latitude: 40.807961, longitude: -73.94558 },
    { latitude: 40.808468, longitude: -73.945204 },
  ]
  const origin: EnuOrigin = { frame: { kind: 'route-start', routeId: 'h' }, ...coords[0]!, altitude: 0 }
  const points = projectRouteToEnu(origin, coords)
  const chevrons = layoutRouteChevrons(points, { fromAlongTrackM: 100, maxCount: 10 })
  assert.equal(chevrons.length, 10)
  for (const c of chevrons) {
    near(c.bearingDeg, routeBearingAt(points, c.alongTrackM), 1e-9, `bearing at ${c.alongTrackM}`)
    near(c.rotation[1], -c.bearingDeg, 1e-12, 'yaw')
  }
})

test('layoutRouteChevrons rejects invalid options', () => {
  assert.throws(() => layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: Number.NaN }), RangeError)
  assert.throws(() => layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0, spacingM: 0 }), RangeError)
  assert.throws(() => layoutRouteChevrons(L_ROUTE, { fromAlongTrackM: 0, maxCount: -1 }), RangeError)
  assert.throws(() => layoutRouteChevrons([[0, 0, 0]], { fromAlongTrackM: 0 }), RangeError)
})
