import type { BBox } from '../types'

const MAX_MERCATOR_LATITUDE = 85.05112878

function assertFiniteCoordinate(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number`)
  }
}

/**
 * Checks a {@linkcode BBox} and returns it unchanged.
 *
 * @throws {RangeError} When a coordinate is not finite, a longitude is outside
 * ±180°, a latitude is outside ±85.05112878°, `south >= north`, or
 * `west === east`.
 */
export function validateBBox(bbox: BBox): BBox {
  const [west, south, east, north] = bbox

  assertFiniteCoordinate(west, 'bbox west')
  assertFiniteCoordinate(south, 'bbox south')
  assertFiniteCoordinate(east, 'bbox east')
  assertFiniteCoordinate(north, 'bbox north')

  if (west < -180 || west > 180 || east < -180 || east > 180) {
    throw new RangeError('bbox longitudes must be between -180 and 180')
  }

  if (
    south < -MAX_MERCATOR_LATITUDE ||
    south > MAX_MERCATOR_LATITUDE ||
    north < -MAX_MERCATOR_LATITUDE ||
    north > MAX_MERCATOR_LATITUDE
  ) {
    throw new RangeError(
      `bbox latitudes must be within Web Mercator bounds ±${MAX_MERCATOR_LATITUDE}`,
    )
  }

  if (south >= north) {
    throw new RangeError('bbox south must be less than bbox north')
  }

  if (west === east) {
    throw new RangeError('bbox must have non-zero longitudinal width')
  }

  return bbox
}

/**
 * Whether a {@linkcode BBox} crosses the antimeridian, meaning `west > east`.
 *
 * @throws {RangeError} When the bbox is invalid, as
 * {@linkcode validateBBox} defines it.
 */
export function bboxCrossesAntimeridian(bbox: BBox): boolean {
  validateBBox(bbox)
  return bbox[0] > bbox[2]
}
