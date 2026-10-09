import { validateCoordinate } from './geo'
import type { GeoProjector, RouteProjectionOptions } from './route'
import type {
  EnuOffset,
  EnuOrigin,
  GeoCoordinate,
  GeoWorldPosition,
} from './types'

// WGS84 ellipsoid.
const SEMI_MAJOR_AXIS_M = 6378137
const FLATTENING = 1 / 298.257223563
const ECCENTRICITY_SQUARED = FLATTENING * (2 - FLATTENING)

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

function toEcef(
  latitude: number,
  longitude: number,
  altitude: number,
): [number, number, number] {
  const lat = toRadians(latitude)
  const lon = toRadians(longitude)
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const primeVerticalRadius =
    SEMI_MAJOR_AXIS_M / Math.sqrt(1 - ECCENTRICITY_SQUARED * sinLat * sinLat)
  return [
    (primeVerticalRadius + altitude) * cosLat * Math.cos(lon),
    (primeVerticalRadius + altitude) * cosLat * Math.sin(lon),
    (primeVerticalRadius * (1 - ECCENTRICITY_SQUARED) + altitude) * sinLat,
  ]
}

function enuComponents(
  originLatitude: number,
  originLongitude: number,
  originAltitude: number,
  latitude: number,
  longitude: number,
  altitude: number,
): [eastM: number, northM: number, upM: number] {
  const [x0, y0, z0] = toEcef(originLatitude, originLongitude, originAltitude)
  const [x, y, z] = toEcef(latitude, longitude, altitude)
  const dx = x - x0
  const dy = y - y0
  const dz = z - z0
  const lat = toRadians(originLatitude)
  const lon = toRadians(originLongitude)
  const sinLat = Math.sin(lat)
  const cosLat = Math.cos(lat)
  const sinLon = Math.sin(lon)
  const cosLon = Math.cos(lon)
  return [
    -sinLon * dx + cosLon * dy,
    -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz,
    cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz,
  ]
}

function validateOrigin(origin: EnuOrigin): void {
  validateCoordinate(origin, { requireAltitude: true })
}

/**
 * Projects a WGS84 coordinate into the local East-North-Up frame of `origin`
 * (WGS84 to ECEF to ENU). Distances and bearings match the WGS84 ellipsoid to
 * well under a centimetre at city scale, and `upM` includes Earth curvature.
 *
 * @throws {RangeError} When either position is out of range or not finite.
 * @see {@linkcode enuToViroPosition}
 */
export function projectToEnu(
  origin: EnuOrigin,
  coordinate: GeoCoordinate & { readonly altitude: number },
): EnuOffset {
  validateOrigin(origin)
  validateCoordinate(coordinate, { requireAltitude: true })
  const [eastM, northM, upM] = enuComponents(
    origin.latitude,
    origin.longitude,
    origin.altitude,
    coordinate.latitude,
    coordinate.longitude,
    coordinate.altitude,
  )
  return { frame: origin.frame, eastM, northM, upM }
}

/**
 * Converts an {@linkcode EnuOffset} to Viro's right-handed axes:
 * x = east, y = up, z = -north (Viro's East-Up-South frame).
 *
 * @see {@linkcode projectToEnu}
 */
export function enuToViroPosition(offset: EnuOffset): GeoWorldPosition {
  return [offset.eastM, offset.upM, -offset.northM]
}

/**
 * A {@linkcode GeoProjector} with the frame semantics of Viro's
 * `gpsToArWorld` (relative to the camera, rotated by compass heading, +x right,
 * -z forward), but measured on the WGS84 ellipsoid. Viro 3.0.2 uses spherical
 * Web Mercator with no cos(latitude) correction, which overstates distances by
 * 1/cos(latitude): about 32% in Harlem.
 */
export const projectToDeviceFrame: GeoProjector = (
  pose,
  latitude,
  longitude,
  altitude,
) => {
  validateCoordinate(pose, { requireAltitude: true })
  validateCoordinate({ latitude, longitude, altitude }, { requireAltitude: true })
  if (!Number.isFinite(pose.heading)) {
    throw new RangeError('pose.heading must be finite')
  }
  const [east, north] = enuComponents(
    pose.latitude,
    pose.longitude,
    pose.altitude,
    latitude,
    longitude,
    altitude,
  )
  const heading = toRadians(pose.heading)
  const cosHeading = Math.cos(heading)
  const sinHeading = Math.sin(heading)
  return [
    east * cosHeading - north * sinHeading,
    altitude - pose.altitude,
    -(east * sinHeading + north * cosHeading),
  ]
}

/**
 * Projects a route into the Viro axes of a fixed {@linkcode EnuOrigin}
 * (see {@linkcode enuToViroPosition}). The result depends only on the route and
 * the origin, so it can be memoised across camera pose updates.
 *
 * Coordinates without altitude use `options.fallbackAltitude`, which defaults
 * to the origin altitude.
 *
 * @throws {RangeError} When a coordinate or option is invalid.
 */
export function projectRouteToEnu(
  origin: EnuOrigin,
  route: readonly GeoCoordinate[],
  options: RouteProjectionOptions = {},
): GeoWorldPosition[] {
  validateOrigin(origin)
  const fallbackAltitude = options.fallbackAltitude ?? origin.altitude
  const verticalOffset = options.verticalOffset ?? 0
  if (!Number.isFinite(fallbackAltitude)) {
    throw new RangeError('fallbackAltitude must be finite')
  }
  if (!Number.isFinite(verticalOffset)) {
    throw new RangeError('verticalOffset must be finite')
  }

  return route.map((coordinate) => {
    const [x, y, z] = enuToViroPosition(
      projectToEnu(origin, {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        altitude: coordinate.altitude ?? fallbackAltitude,
      }),
    )
    return [x, y + verticalOffset, z] as const
  })
}

/**
 * Transform for a node that holds content projected from an
 * {@linkcode EnuOrigin}: pass `position` and `rotation` to the parent node.
 *
 * @see {@linkcode solveEnuPlacement}
 */
export interface EnuPlacement {
  /** AR world position of the origin, in metres. */
  readonly position: GeoWorldPosition
  /** Euler rotation in degrees; only yaw (index 1) is non-zero. */
  readonly rotation: GeoWorldPosition
}

/** Input to {@linkcode solveEnuPlacement}. */
export interface EnuPlacementInput {
  /** AR world position of a WGS84 geospatial anchor created at the origin. */
  readonly originWorldPosition: GeoWorldPosition
  /** AR world position of a second WGS84 anchor at `reference`. */
  readonly referenceWorldPosition: GeoWorldPosition
  /** ENU offset of the second anchor from the origin. */
  readonly reference: EnuOffset
}

/** Below this horizontal separation the yaw is too noisy to trust. */
const MIN_REFERENCE_DISTANCE_M = 1

/**
 * Solves where an {@linkcode EnuOrigin} sits in the AR world from two
 * geospatial anchors. Viro 3.0.2 reports an anchor's world `position` but not
 * its rotation, and has no node that follows a geospatial anchor, so the yaw
 * between ENU and the AR world comes from the direction between two anchors.
 * Gravity keeps the AR world's +y up, so yaw is the only rotation needed.
 *
 * @throws {RangeError} When either the world or the ENU reference is closer
 * than 1 m horizontally to the origin.
 */
export function solveEnuPlacement(input: EnuPlacementInput): EnuPlacement {
  const [localX, , localZ] = enuToViroPosition(input.reference)
  const worldX = input.referenceWorldPosition[0] - input.originWorldPosition[0]
  const worldZ = input.referenceWorldPosition[2] - input.originWorldPosition[2]
  if (
    Math.hypot(localX, localZ) < MIN_REFERENCE_DISTANCE_M ||
    Math.hypot(worldX, worldZ) < MIN_REFERENCE_DISTANCE_M
  ) {
    throw new RangeError(
      `reference anchor must be at least ${MIN_REFERENCE_DISTANCE_M} m from the origin horizontally`,
    )
  }
  const yawRad = Math.atan2(worldX, worldZ) - Math.atan2(localX, localZ)
  const yawDeg = ((((yawRad * 180) / Math.PI) % 360) + 540) % 360 - 180
  return {
    position: input.originWorldPosition,
    rotation: [0, yawDeg, 0],
  }
}

/**
 * Inverse of {@linkcode projectToEnu}: the WGS84 position of an ENU offset
 * from `origin` (ENU to ECEF to geodetic, Bowring's method with two
 * refinements). Round-trips with `projectToEnu` to well under a millimetre at
 * city scale.
 *
 * Use it to turn a point in a street scene (where the wearer stands) back
 * into a coordinate for a Directions request.
 *
 * @throws {RangeError} When the origin is invalid or the offset is not finite.
 */
export function unprojectFromEnu(
  origin: EnuOrigin,
  offset: Pick<EnuOffset, 'eastM' | 'northM' | 'upM'>,
): GeoCoordinate & { readonly altitude: number } {
  validateOrigin(origin)
  if (![offset.eastM, offset.northM, offset.upM].every(Number.isFinite)) {
    throw new RangeError('offset east/north/up must be finite')
  }
  const [x0, y0, z0] = toEcef(origin.latitude, origin.longitude, origin.altitude)
  const lat0 = toRadians(origin.latitude)
  const lon0 = toRadians(origin.longitude)
  const sinLat = Math.sin(lat0)
  const cosLat = Math.cos(lat0)
  const sinLon = Math.sin(lon0)
  const cosLon = Math.cos(lon0)
  const { eastM: e, northM: n, upM: u } = offset
  const x = x0 - sinLon * e - sinLat * cosLon * n + cosLat * cosLon * u
  const y = y0 + cosLon * e - sinLat * sinLon * n + cosLat * sinLon * u
  const z = z0 + cosLat * n + sinLat * u

  const p = Math.hypot(x, y)
  const longitude = Math.atan2(y, x)
  let latitude = Math.atan2(z, p * (1 - ECCENTRICITY_SQUARED))
  let altitude = 0
  for (let i = 0; i < 3; i += 1) {
    const sin = Math.sin(latitude)
    const radius = SEMI_MAJOR_AXIS_M / Math.sqrt(1 - ECCENTRICITY_SQUARED * sin * sin)
    altitude = p / Math.cos(latitude) - radius
    latitude = Math.atan2(z, p * (1 - (ECCENTRICITY_SQUARED * radius) / (radius + altitude)))
  }
  return {
    latitude: (latitude * 180) / Math.PI,
    longitude: (longitude * 180) / Math.PI,
    altitude,
  }
}
