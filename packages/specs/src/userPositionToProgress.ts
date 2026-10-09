import {
  routeGeometryToCoordinates,
  type NavigationProgressSnapshot,
  type NavigationRoute,
} from '@mikevocalz/nitro-mapbox-ar/core'

import { distanceAlongM, lengthM } from './geodesy'
import type { UserPositionLike } from './UserPositionLike'

/**
 * The segment of consecutive lengths that contains `offsetM`, and where it
 * starts. Offsets past the end land on the last segment.
 */
function segmentAt(
  lengthsM: readonly number[],
  offsetM: number,
): { readonly index: number; readonly startM: number } {
  let startM = 0
  for (let index = 0; index < lengthsM.length - 1; index += 1) {
    if (offsetM < startM + lengthsM[index]!) return { index, startM }
    startM += lengthsM[index]!
  }
  return { index: Math.max(0, lengthsM.length - 1), startM }
}

/**
 * Builds a {@linkcode NavigationProgressSnapshot} for `route` from the
 * Navigation Kit's `UserPosition`.
 *
 * - `location` comes from `getGeoPosition()`.
 * - `bearing` is `getBearing()` (radians, clockwise from true north)
 *   converted to degrees in [0, 360).
 * - `fractionTraveled` is the distance along the route geometry to the point
 *   nearest the user, over the geometry's length.
 * - `distanceRemaining` and `durationRemaining` scale `route.distance` and
 *   `route.duration` by the untravelled fraction, so they assume constant
 *   speed over the route.
 * - `currentLegIndex` and `currentStepIndex` are the leg and step whose share
 *   of `route.distance` contains the travelled distance. `currentStepIndex`
 *   is absent when the leg has no steps.
 * - `speedMetersPerSecond` is absent: `UserPosition` does not report speed.
 *
 * @returns `undefined` when `getGeoPosition()` returns `null`, which the kit
 * documents as location services not working.
 * @throws {TypeError} When the route geometry is not a GeoJSON `LineString`.
 * @throws {RangeError} When the geometry has fewer than two positions or a
 * position is outside WGS84 bounds.
 * @see https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-navigation-kit/component-list
 */
export function userPositionToProgress(
  userPosition: UserPositionLike,
  route: NavigationRoute,
): NavigationProgressSnapshot | undefined {
  const position = userPosition.getGeoPosition()
  if (position === null) return undefined

  const path = routeGeometryToCoordinates(route)
  if (path.length < 2) {
    throw new RangeError('Route geometry needs at least two positions')
  }
  const location = { longitude: position.longitude, latitude: position.latitude }
  const pathLength = lengthM(path)
  const fractionTraveled =
    pathLength === 0 ? 1 : Math.min(1, distanceAlongM(path, location) / pathLength)
  const travelledM = route.distance * fractionTraveled

  const leg = segmentAt(route.legs.map((value) => value.distance), travelledM)
  const steps = route.legs[leg.index]?.steps
  const step = steps && steps.length > 0
    ? segmentAt(steps.map((value) => value.distance), travelledM - leg.startM)
    : undefined

  const bearingDeg = ((userPosition.getBearing() * 180) / Math.PI) % 360
  return {
    location,
    bearing: bearingDeg < 0 ? bearingDeg + 360 : bearingDeg,
    distanceRemaining: route.distance * (1 - fractionTraveled),
    durationRemaining: route.duration * (1 - fractionTraveled),
    fractionTraveled,
    currentLegIndex: leg.index,
    ...(step ? { currentStepIndex: step.index } : {}),
    route,
  }
}
