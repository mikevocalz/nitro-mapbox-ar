import assert from 'node:assert/strict'
import test from 'node:test'

import type { NavigationRoute } from '../src/navigation/client'
import { routeToPlaces, userPositionToProgress } from '../packages/specs/src/index'

// Two legs along the equator: 0 -> 0.01 -> 0.02 degrees longitude, about
// 1113 m each.
const route: NavigationRoute = {
  distance: 2226,
  duration: 1600,
  geometry: { type: 'LineString', coordinates: [[0, 0], [0.01, 0], [0.02, 0]] },
  legs: [
    {
      distance: 1113,
      duration: 800,
      steps: [
        step('depart', [0, 0], 'Head east', 'First Street', 1113),
        step('arrive', [0.01, 0], 'You have arrived at your stop', 'First Street', 0),
      ],
    },
    {
      distance: 1113,
      duration: 800,
      steps: [
        step('depart', [0.01, 0], 'Head east', 'Second Street', 556),
        step('turn', [0.015, 0], 'Continue onto Third Street', 'Third Street', 557),
        step('arrive', [0.02, 0], 'You have arrived', '', 0),
      ],
    },
  ],
}

function step(type: string, location: [number, number], instruction: string, name: string, distance: number) {
  return {
    distance,
    duration: distance,
    name,
    mode: 'walking',
    maneuver: { type, location, bearing_before: 90, bearing_after: 90, instruction },
  }
}

function userAt(longitude: number, latitude: number, bearingRad = 0) {
  return { getGeoPosition: () => ({ longitude, latitude }), getBearing: () => bearingRad }
}

test('routeToPlaces lists every manoeuvre except departures, in travel order', () => {
  const places = routeToPlaces(route)
  assert.deepEqual(
    places.map((place) => [place.longitude, place.name, place.description]),
    [
      [0.01, 'You have arrived at your stop', 'First Street'],
      [0.015, 'Continue onto Third Street', 'Third Street'],
      [0.02, 'You have arrived', ''],
    ],
  )
  assert.ok(places.every((place) => place.distanceToVisit === 10 && place.latitude === 0))
  assert.ok(places.every((place) => !('altitude' in place)))
})

test('routeToPlaces applies distanceToVisit and rejects a non-positive one', () => {
  assert.equal(routeToPlaces(route, { distanceToVisit: 25 })[0]!.distanceToVisit, 25)
  assert.throws(() => routeToPlaces(route, { distanceToVisit: 0 }), RangeError)
  assert.throws(() => routeToPlaces(route, { distanceToVisit: Number.NaN }), RangeError)
})

test('routeToPlaces requires steps', () => {
  const stepless = { ...route, legs: [{ distance: 1, duration: 1 }] }
  assert.throws(() => routeToPlaces(stepless), /steps: true/)
})

test('userPositionToProgress places the user on the second leg', () => {
  // 3/4 of the way: halfway through leg 2, at the turn onto Third Street.
  const progress = userPositionToProgress(userAt(0.0151, 0.0001, Math.PI / 2), route)
  assert.ok(progress)
  assert.ok(Math.abs(progress.fractionTraveled - 0.755) < 0.001)
  assert.ok(Math.abs(progress.distanceRemaining - 2226 * (1 - progress.fractionTraveled)) < 1e-9)
  assert.ok(Math.abs(progress.durationRemaining - 1600 * (1 - progress.fractionTraveled)) < 1e-9)
  assert.equal(progress.currentLegIndex, 1)
  assert.equal(progress.currentStepIndex, 1)
  assert.ok(Math.abs(progress.bearing! - 90) < 1e-9)
  assert.deepEqual(progress.location, { longitude: 0.0151, latitude: 0.0001 })
  assert.equal(progress.route, route)
  assert.equal('speedMetersPerSecond' in progress, false)
})

test('userPositionToProgress clamps to the route ends and wraps bearing', () => {
  const before = userPositionToProgress(userAt(-0.01, 0, -Math.PI / 2), route)!
  assert.equal(before.fractionTraveled, 0)
  assert.equal(before.currentLegIndex, 0)
  assert.equal(before.currentStepIndex, 0)
  assert.ok(Math.abs(before.bearing! - 270) < 1e-9)

  const after = userPositionToProgress(userAt(0.05, 0), route)!
  assert.equal(after.fractionTraveled, 1)
  assert.equal(after.distanceRemaining, 0)
  assert.equal(after.currentLegIndex, 1)
  assert.equal(after.currentStepIndex, 2)
})

test('userPositionToProgress returns undefined without a location fix', () => {
  const noFix = { getGeoPosition: () => null, getBearing: () => 0 }
  assert.equal(userPositionToProgress(noFix, route), undefined)
})

test('userPositionToProgress rejects an encoded polyline', () => {
  assert.throws(
    () => userPositionToProgress(userAt(0, 0), { ...route, geometry: 'abc' }),
    /encoded polyline/,
  )
})
