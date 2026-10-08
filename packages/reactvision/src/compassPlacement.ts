import { enuToViroPosition, type EnuPlacement } from './enu'
import type { EnuOffset, GeoWorldPosition } from './types'

const DEG = Math.PI / 180

/** Below this horizontal length the camera is looking almost straight up or down. */
const MIN_HORIZONTAL_FORWARD = 0.2

/** Eye height used when the caller has no ground estimate. */
const DEFAULT_EYE_HEIGHT_M = 1.4

function wrapDegrees(degrees: number): number {
  const wrapped = ((((degrees + 180) % 360) + 360) % 360) - 180
  return wrapped === -180 ? 180 : wrapped
}

function assertFinite(values: readonly number[], label: string): void {
  if (!values.every(Number.isFinite)) {
    throw new RangeError(`${label} must be finite`)
  }
}

/**
 * Yaw of a Viro camera in degrees, counter-clockwise seen from above, with 0
 * when the camera looks along world −z. This is `atan2(−f.x, −f.z)` for the
 * camera `forward` vector reported by Viro's `onCameraTransformUpdate`, so it
 * uses the same sign as a Viro node's Y rotation. Pitch does not change it.
 *
 * @throws {RangeError} When `forward` is not finite or points within about
 * 78° of straight up or down, where its horizontal direction is noise.
 * @see {@linkcode solveCompassPlacement}
 */
export function cameraYawDeg(forward: GeoWorldPosition): number {
  assertFinite(forward, 'forward')
  const horizontal = Math.hypot(forward[0], forward[2])
  const length = Math.hypot(forward[0], forward[1], forward[2])
  if (length === 0 || horizontal / length < MIN_HORIZONTAL_FORWARD) {
    throw new RangeError('camera forward is too close to vertical to give a yaw')
  }
  return Math.atan2(-forward[0], -forward[2]) / DEG
}

/**
 * How far a {@linkcode CompassPlacement} can be trusted.
 *
 * - `high`: heading accuracy ≤ 10° and horizontal accuracy ≤ 10 m.
 * - `medium`: heading accuracy ≤ 25° and horizontal accuracy ≤ 25 m.
 * - `low`: anything worse, or either accuracy unknown.
 *
 * @see {@linkcode CompassPlacement.confidence}
 */
export type CompassPlacementConfidence = 'high' | 'medium' | 'low'

/** Input to {@linkcode solveCompassPlacement}. */
export interface CompassPlacementInput {
  /** Camera position in the AR world, from `onCameraTransformUpdate`. */
  readonly cameraWorldPosition: GeoWorldPosition
  /** Camera forward vector in the AR world, from `onCameraTransformUpdate`. */
  readonly cameraForward: GeoWorldPosition
  /**
   * True-north compass heading, in degrees clockwise, of the direction the
   * camera looks, sampled at the same moment as {@linkcode cameraForward}.
   * Use a heading for the rear camera axis, not the top edge of the device.
   */
  readonly trueHeadingDeg: number
  /**
   * 68% heading uncertainty in degrees. Negative or missing means unknown,
   * which makes the placement `low` confidence.
   */
  readonly headingAccuracyDeg?: number
  /**
   * ENU offset of the camera's geographic position from the origin the route
   * was projected from, usually the matched position from `projectToEnu`.
   * `upM` is ignored; {@linkcode groundWorldY} sets the height.
   */
  readonly cameraEnuOffset: Pick<EnuOffset, 'eastM' | 'northM' | 'upM'>
  /** 68% horizontal radius of {@linkcode cameraEnuOffset}, in metres. Missing means unknown. */
  readonly horizontalAccuracyM?: number
  /**
   * AR world height of the ground under the camera, for example from a
   * horizontal plane anchor.
   * @default camera y − 1.4 m
   */
  readonly groundWorldY?: number
}

/**
 * An {@linkcode EnuPlacement} solved from the compass, with its uncertainty.
 *
 * @see {@linkcode solveCompassPlacement}
 */
export interface CompassPlacement extends EnuPlacement {
  /** Yaw between ENU and the AR world in degrees, in (−180, 180]; equals `rotation[1]`. */
  readonly yawDeg: number
  /** Coarse trust level for UI decisions such as hiding a destination marker. */
  readonly confidence: CompassPlacementConfidence
  /**
   * Worst-case sideways error, in metres, of content 10 m from the camera:
   * horizontal accuracy plus `10 · tan(heading accuracy)`. `Infinity` when
   * either accuracy is unknown.
   */
  readonly lateralErrorAt10mM: number
}

function confidenceFor(
  headingAccuracyDeg: number | undefined,
  horizontalAccuracyM: number | undefined,
): CompassPlacementConfidence {
  if (
    headingAccuracyDeg === undefined ||
    horizontalAccuracyM === undefined ||
    headingAccuracyDeg < 0 ||
    horizontalAccuracyM < 0
  ) {
    return 'low'
  }
  if (headingAccuracyDeg <= 10 && horizontalAccuracyM <= 10) return 'high'
  if (headingAccuracyDeg <= 25 && horizontalAccuracyM <= 25) return 'medium'
  return 'low'
}

/**
 * Places an ENU origin in the AR world from one compass heading, for sessions
 * without geospatial anchors (no ARCore Earth or VPS, or before Earth
 * localises). Compare {@linkcode solveEnuPlacement}, which uses two anchors.
 *
 * The yaw is `cameraYaw + trueHeading`, where `cameraYaw` comes from
 * {@linkcode cameraYawDeg}. Solve it once and keep it: subtracting the live
 * heading every frame makes world content swing with the phone. Refine it
 * with {@linkcode slewPlacement} so corrections never jump.
 *
 * The origin's horizontal position puts {@linkcode CompassPlacementInput.cameraEnuOffset}
 * under the camera; its height is the ground.
 *
 * @throws {RangeError} When any input is not finite or the camera looks
 * almost straight up or down.
 */
export function solveCompassPlacement(input: CompassPlacementInput): CompassPlacement {
  assertFinite(input.cameraWorldPosition, 'cameraWorldPosition')
  assertFinite([input.trueHeadingDeg], 'trueHeadingDeg')
  assertFinite(
    [input.cameraEnuOffset.eastM, input.cameraEnuOffset.northM],
    'cameraEnuOffset',
  )
  const groundWorldY =
    input.groundWorldY === undefined
      ? input.cameraWorldPosition[1] - DEFAULT_EYE_HEIGHT_M
      : input.groundWorldY
  assertFinite([groundWorldY], 'groundWorldY')

  const yawDeg = wrapDegrees(cameraYawDeg(input.cameraForward) + input.trueHeadingDeg)
  const [localX, , localZ] = enuToViroPosition({
    frame: { kind: 'place', placeId: '' },
    eastM: input.cameraEnuOffset.eastM,
    northM: input.cameraEnuOffset.northM,
    upM: 0,
  })
  const [rotatedX, rotatedZ] = rotateHorizontal(localX, localZ, yawDeg)

  const { headingAccuracyDeg, horizontalAccuracyM } = input
  const known =
    headingAccuracyDeg !== undefined &&
    horizontalAccuracyM !== undefined &&
    headingAccuracyDeg >= 0 &&
    horizontalAccuracyM >= 0 &&
    headingAccuracyDeg < 90
  return {
    position: [
      input.cameraWorldPosition[0] - rotatedX,
      groundWorldY,
      input.cameraWorldPosition[2] - rotatedZ,
    ],
    rotation: [0, yawDeg, 0],
    yawDeg,
    confidence: confidenceFor(headingAccuracyDeg, horizontalAccuracyM),
    lateralErrorAt10mM: known
      ? horizontalAccuracyM + 10 * Math.tan(headingAccuracyDeg * DEG)
      : Number.POSITIVE_INFINITY,
  }
}

/** Rotates a local (x, z) by a Viro Y rotation in degrees. */
function rotateHorizontal(x: number, z: number, yawDeg: number): [number, number] {
  const c = Math.cos(yawDeg * DEG)
  const s = Math.sin(yawDeg * DEG)
  return [c * x + s * z, -s * x + c * z]
}

/** Input to {@linkcode slewPlacement}. */
export interface PlacementSlewInput {
  /** The placement currently on screen. */
  readonly current: EnuPlacement
  /** The newly solved placement to move toward. */
  readonly target: EnuPlacement
  /**
   * Node-local point to keep steady, in the same Viro axes as the projected
   * route; usually the user's matched position. Rotation turns about it, so
   * a yaw fix for an origin 300 m back does not sweep nearby chevrons sideways.
   */
  readonly pivot: GeoWorldPosition
  /** Seconds since the previous step. */
  readonly elapsedS: number
  /** Largest yaw change per second. @default 5 */
  readonly maxYawRateDegPerS?: number
  /** Largest movement of the pivot's world position per second, in metres. @default 0.5 */
  readonly maxShiftRateMPerS?: number
}

/** Result of {@linkcode slewPlacement}. */
export interface PlacementSlewStep {
  /** The placement to render this frame. */
  readonly placement: EnuPlacement
  /** True when {@linkcode placement} equals the target, so stepping can stop. */
  readonly isSettled: boolean
}

function worldOf(placement: EnuPlacement, local: GeoWorldPosition): GeoWorldPosition {
  const [x, z] = rotateHorizontal(local[0], local[2], placement.rotation[1])
  return [
    placement.position[0] + x,
    placement.position[1] + local[1],
    placement.position[2] + z,
  ]
}

function assertRate(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`)
  }
}

/**
 * Moves a placement one step toward a re-solved one at bounded speed, so a
 * corrected heading or anchor never makes the route jump. Yaw turns the short
 * way across ±180°. Call it once per frame or pose update with the elapsed
 * time until {@linkcode PlacementSlewStep.isSettled} is true.
 *
 * Only yaw is slewed; pitch and roll stay at 0 because the AR world is
 * gravity aligned. When the route itself changes (a reroute), use the new
 * placement directly instead.
 *
 * @throws {RangeError} When `elapsedS` is negative or not finite, a rate is
 * not positive, or a placement or the pivot is not finite.
 */
export function slewPlacement(input: PlacementSlewInput): PlacementSlewStep {
  const maxYawRate = input.maxYawRateDegPerS ?? 5
  const maxShiftRate = input.maxShiftRateMPerS ?? 0.5
  assertRate(maxYawRate, 'maxYawRateDegPerS')
  assertRate(maxShiftRate, 'maxShiftRateMPerS')
  if (!Number.isFinite(input.elapsedS) || input.elapsedS < 0) {
    throw new RangeError('elapsedS must be a finite number ≥ 0')
  }
  assertFinite([...input.current.position, input.current.rotation[1]], 'current')
  assertFinite([...input.target.position, input.target.rotation[1]], 'target')
  assertFinite(input.pivot, 'pivot')

  const currentYaw = input.current.rotation[1]
  const yawDelta = wrapDegrees(input.target.rotation[1] - currentYaw)
  const yawStep = maxYawRate * input.elapsedS
  const yawReached = Math.abs(yawDelta) <= yawStep
  const nextYaw = yawReached
    ? wrapDegrees(input.target.rotation[1])
    : wrapDegrees(currentYaw + Math.sign(yawDelta) * yawStep)

  const from = worldOf(input.current, input.pivot)
  const to = worldOf(input.target, input.pivot)
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const distance = Math.hypot(dx, dy, dz)
  const shiftStep = maxShiftRate * input.elapsedS
  const shiftReached = distance <= shiftStep
  const scale = shiftReached || distance === 0 ? 1 : shiftStep / distance
  const pivotWorld: GeoWorldPosition = [
    from[0] + dx * scale,
    from[1] + dy * scale,
    from[2] + dz * scale,
  ]

  if (yawReached && shiftReached) {
    return {
      placement: {
        position: input.target.position,
        rotation: [0, nextYaw, 0],
      },
      isSettled: true,
    }
  }

  const [rx, rz] = rotateHorizontal(input.pivot[0], input.pivot[2], nextYaw)
  return {
    placement: {
      position: [pivotWorld[0] - rx, pivotWorld[1] - input.pivot[1], pivotWorld[2] - rz],
      rotation: [0, nextYaw, 0],
    },
    isSettled: false,
  }
}
