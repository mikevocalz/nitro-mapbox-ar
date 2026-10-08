import assert from 'node:assert/strict'
import test from 'node:test'

import {
  cameraYawDeg,
  slewPlacement,
  solveCompassPlacement,
} from '../packages/reactvision/src/compassPlacement'
import { enuToViroPosition, projectToEnu } from '../packages/reactvision/src/enu'
import type { EnuPlacement } from '../packages/reactvision/src/enu'
import type { EnuOrigin, GeoWorldPosition } from '../packages/reactvision/src/types'

const near = (actual: number, expected: number, tol: number, label: string): void => {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: expected ${expected} ±${tol}, got ${actual}`)
}

/** World position of a node-local point under a Viro [0, yaw, 0] parent. */
function toWorld(placement: EnuPlacement, local: GeoWorldPosition): GeoWorldPosition {
  const yaw = (placement.rotation[1] * Math.PI) / 180
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return [
    placement.position[0] + c * local[0] + s * local[2],
    placement.position[1] + local[1],
    placement.position[2] - s * local[0] + c * local[2],
  ]
}

/** Viro forward vector for a camera turned `yawDeg` counter-clockwise from −z. */
function forwardForYaw(yawDeg: number, pitchDeg = 0): GeoWorldPosition {
  const y = (yawDeg * Math.PI) / 180
  const p = (pitchDeg * Math.PI) / 180
  return [-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)]
}

const ZERO_OFFSET = { eastM: 0, northM: 0, upM: 0 } as const

test('cameraYawDeg is 0 facing −z and grows counter-clockwise', () => {
  near(cameraYawDeg([0, 0, -1]), 0, 1e-9, 'facing −z')
  near(cameraYawDeg([-1, 0, 0]), 90, 1e-9, 'facing −x (turned left)')
  near(cameraYawDeg([1, 0, 0]), -90, 1e-9, 'facing +x (turned right)')
  near(Math.abs(cameraYawDeg([0, 0, 1])), 180, 1e-9, 'facing +z')
  near(cameraYawDeg(forwardForYaw(33, -40)), 33, 1e-9, 'pitch does not change yaw')
})

test('cameraYawDeg rejects a camera looking straight down', () => {
  assert.throws(() => cameraYawDeg([0, -1, 0]), RangeError)
  assert.throws(() => cameraYawDeg(forwardForYaw(0, -85)), RangeError)
})

test('facing −z and true north: ENU north is world −z', () => {
  const placement = solveCompassPlacement({
    cameraWorldPosition: [0, 1.4, 0],
    cameraForward: [0, 0, -1],
    trueHeadingDeg: 0,
    cameraEnuOffset: ZERO_OFFSET,
  })
  near(placement.rotation[1], 0, 1e-9, 'yaw')
  const north = toWorld(placement, enuToViroPosition({ ...ZERO_OFFSET, frame: { kind: 'place', placeId: 'x' }, northM: 10 }))
  near(north[0], 0, 1e-9, 'x')
  near(north[2], -10, 1e-9, 'z')
})

test('facing −z and true east: ENU north is to the left (world −x)', () => {
  const placement = solveCompassPlacement({
    cameraWorldPosition: [0, 1.4, 0],
    cameraForward: [0, 0, -1],
    trueHeadingDeg: 90,
    cameraEnuOffset: ZERO_OFFSET,
  })
  near(placement.yawDeg, 90, 1e-9, 'yaw = cameraYaw + heading')
  const north = toWorld(placement, [0, 0, -10])
  near(north[0], -10, 1e-9, 'north x')
  near(north[2], 0, 1e-9, 'north z')
  const east = toWorld(placement, [10, 0, 0])
  near(east[0], 0, 1e-9, 'east x')
  near(east[2], -10, 1e-9, 'east lies straight ahead')
})

test('a point at the compass heading lands straight ahead of the camera, any start yaw', () => {
  for (const cameraYaw of [-170, -90, -20, 0, 45, 135, 179]) {
    for (const heading of [0, 15, 90, 200, 359]) {
      const forward = forwardForYaw(cameraYaw, -10)
      const placement = solveCompassPlacement({
        cameraWorldPosition: [3, 1.5, -7],
        cameraForward: forward,
        trueHeadingDeg: heading,
        cameraEnuOffset: { eastM: 40, northM: -25, upM: 0 },
      })
      const h = (heading * Math.PI) / 180
      // 20 m from the camera along the heading, in ENU.
      const target = toWorld(placement, enuToViroPosition({
        frame: { kind: 'place', placeId: 'x' },
        eastM: 40 + 20 * Math.sin(h),
        northM: -25 + 20 * Math.cos(h),
        upM: 0,
      }))
      const dx = target[0] - 3
      const dz = target[2] + 7
      const horizontal = Math.hypot(forward[0], forward[2])
      near(dx, 20 * (forward[0] / horizontal), 1e-6, `x yaw ${cameraYaw} heading ${heading}`)
      near(dz, 20 * (forward[2] / horizontal), 1e-6, `z yaw ${cameraYaw} heading ${heading}`)
    }
  }
})

test('the camera ENU offset maps onto the camera world position', () => {
  const origin: EnuOrigin = {
    frame: { kind: 'route-start', routeId: 'r' },
    latitude: 40.808515,
    longitude: -73.947544,
    altitude: 0,
  }
  // A camera about 220 m west-northwest of the origin.
  const camera = projectToEnu(origin, { latitude: 40.81002, longitude: -73.95, altitude: 0 })
  const placement = solveCompassPlacement({
    cameraWorldPosition: [1, 1.6, 2],
    cameraForward: forwardForYaw(70),
    trueHeadingDeg: 250,
    cameraEnuOffset: camera,
    groundWorldY: -0.1,
  })
  const world = toWorld(placement, enuToViroPosition({ ...camera, upM: 0 }))
  near(world[0], 1, 1e-6, 'x')
  near(world[2], 2, 1e-6, 'z')
  near(placement.position[1], -0.1, 1e-12, 'origin sits on the ground plane')
})

test('yaw wraps into (−180, 180]', () => {
  const placement = solveCompassPlacement({
    cameraWorldPosition: [0, 0, 0],
    cameraForward: forwardForYaw(170),
    trueHeadingDeg: 350,
    cameraEnuOffset: ZERO_OFFSET,
  })
  near(placement.yawDeg, 160, 1e-9, '170 + 350 = 520 → 160')
  assert.equal(placement.rotation[1], placement.yawDeg)
  const negative = solveCompassPlacement({
    cameraWorldPosition: [0, 0, 0],
    cameraForward: forwardForYaw(-100),
    trueHeadingDeg: 5,
    cameraEnuOffset: ZERO_OFFSET,
  })
  near(negative.yawDeg, -95, 1e-9, '−100 + 5')
})

test('ground defaults to 1.4 m under the camera', () => {
  const placement = solveCompassPlacement({
    cameraWorldPosition: [0, 1.5, 0],
    cameraForward: [0, 0, -1],
    trueHeadingDeg: 0,
    cameraEnuOffset: ZERO_OFFSET,
  })
  near(placement.position[1], 0.1, 1e-12, 'y')
})

test('confidence follows heading and horizontal accuracy', () => {
  const base = {
    cameraWorldPosition: [0, 0, 0] as const,
    cameraForward: [0, 0, -1] as const,
    trueHeadingDeg: 0,
    cameraEnuOffset: ZERO_OFFSET,
  }
  assert.equal(solveCompassPlacement({ ...base, headingAccuracyDeg: 8, horizontalAccuracyM: 6 }).confidence, 'high')
  assert.equal(solveCompassPlacement({ ...base, headingAccuracyDeg: 20, horizontalAccuracyM: 6 }).confidence, 'medium')
  assert.equal(solveCompassPlacement({ ...base, headingAccuracyDeg: 8, horizontalAccuracyM: 18 }).confidence, 'medium')
  assert.equal(solveCompassPlacement({ ...base, headingAccuracyDeg: 45, horizontalAccuracyM: 6 }).confidence, 'low')
  assert.equal(solveCompassPlacement({ ...base, headingAccuracyDeg: 8, horizontalAccuracyM: 40 }).confidence, 'low')
  assert.equal(solveCompassPlacement(base).confidence, 'low', 'unknown accuracy is low')
  // iOS reports a negative headingAccuracy when the heading is invalid.
  assert.equal(solveCompassPlacement({ ...base, headingAccuracyDeg: -1, horizontalAccuracyM: 5 }).confidence, 'low')
  const p = solveCompassPlacement({ ...base, headingAccuracyDeg: 10, horizontalAccuracyM: 5 })
  near(p.lateralErrorAt10mM, 5 + 10 * Math.tan((10 * Math.PI) / 180), 1e-9, 'lateral error budget')
})

test('solveCompassPlacement rejects non-finite input', () => {
  assert.throws(() => solveCompassPlacement({
    cameraWorldPosition: [0, Number.NaN, 0],
    cameraForward: [0, 0, -1],
    trueHeadingDeg: 0,
    cameraEnuOffset: ZERO_OFFSET,
  }), RangeError)
  assert.throws(() => solveCompassPlacement({
    cameraWorldPosition: [0, 0, 0],
    cameraForward: [0, 0, -1],
    trueHeadingDeg: Number.POSITIVE_INFINITY,
    cameraEnuOffset: ZERO_OFFSET,
  }), RangeError)
})

const placementAt = (x: number, z: number, yaw: number): EnuPlacement => ({
  position: [x, 0, z],
  rotation: [0, yaw, 0],
})

test('slewPlacement turns the short way across ±180', () => {
  const step = slewPlacement({
    current: placementAt(0, 0, 179),
    target: placementAt(0, 0, -179),
    pivot: [0, 0, 0],
    elapsedS: 0.1,
  })
  near(step.placement.rotation[1], 179.5, 1e-9, '5°/s × 0.1 s toward −179 through 180')
  assert.equal(step.isSettled, false)
  const wrapped = slewPlacement({
    current: placementAt(0, 0, 179.8),
    target: placementAt(0, 0, -179),
    pivot: [0, 0, 0],
    elapsedS: 0.1,
  })
  near(wrapped.placement.rotation[1], -179.7, 1e-9, 'result stays in (−180, 180]')
})

test('slewPlacement limits yaw and shift rates and pivots about the user', () => {
  // User 120 m along the route from the origin. A 4° correction about the
  // origin would throw content near the user 8 m sideways in one frame.
  const pivot: GeoWorldPosition = [0, 0, -120]
  const current = placementAt(0, 0, 0)
  const target = placementAt(0, 0, 4)
  const step = slewPlacement({ current, target, pivot, elapsedS: 0.1 })
  near(step.placement.rotation[1], 0.5, 1e-9, 'yaw limited to 5°/s')
  const before = toWorld(current, pivot)
  const after = toWorld(step.placement, pivot)
  const moved = Math.hypot(after[0] - before[0], after[2] - before[2])
  assert.ok(moved <= 0.05 + 1e-9, `pivot moved ${moved} m, limit 0.5 m/s × 0.1 s`)
})

test('slewPlacement converges and reports settled', () => {
  const target = placementAt(3, -2, 12)
  let current: EnuPlacement = placementAt(0, 0, 0)
  let settled = false
  for (let i = 0; i < 200 && !settled; i += 1) {
    const step = slewPlacement({ current, target, pivot: [5, 0, -30], elapsedS: 0.1 })
    current = step.placement
    settled = step.isSettled
  }
  assert.ok(settled, 'settles within 20 s')
  near(current.rotation[1], 12, 1e-9, 'yaw')
  near(current.position[0], 3, 1e-6, 'x')
  near(current.position[2], -2, 1e-6, 'z')
})

test('slewPlacement honours custom rates and rejects bad input', () => {
  const step = slewPlacement({
    current: placementAt(0, 0, 0),
    target: placementAt(0, 0, 90),
    pivot: [0, 0, 0],
    elapsedS: 1,
    maxYawRateDegPerS: 30,
  })
  near(step.placement.rotation[1], 30, 1e-9, 'custom rate')
  assert.throws(() => slewPlacement({
    current: placementAt(0, 0, 0),
    target: placementAt(0, 0, 0),
    pivot: [0, 0, 0],
    elapsedS: -1,
  }), RangeError)
  assert.throws(() => slewPlacement({
    current: placementAt(0, 0, 0),
    target: placementAt(0, 0, 0),
    pivot: [0, 0, 0],
    elapsedS: 0.1,
    maxYawRateDegPerS: 0,
  }), RangeError)
})

test('compass placement agrees with the two-anchor solve', async () => {
  const { solveEnuPlacement } = await import('../packages/reactvision/src/enu')
  const compass = solveCompassPlacement({
    cameraWorldPosition: [2, 1.4, -3],
    cameraForward: forwardForYaw(-60),
    trueHeadingDeg: 140,
    cameraEnuOffset: { eastM: 12, northM: 30, upM: 0 },
    groundWorldY: 0,
  })
  const reference = { frame: { kind: 'place', placeId: 'r' }, eastM: 50, northM: -20, upM: 0 } as const
  const anchors = solveEnuPlacement({
    originWorldPosition: compass.position,
    referenceWorldPosition: toWorld(compass, enuToViroPosition(reference)),
    reference,
  })
  near(anchors.rotation[1], compass.yawDeg, 1e-9, 'same yaw convention')
})
