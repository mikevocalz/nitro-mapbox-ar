import type { GeoCoordinate } from './types'

function assertFinite(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be finite`)
  }
  return value
}

export function validateCoordinate(
  coordinate: GeoCoordinate,
  options: { requireAltitude?: boolean } = {},
): GeoCoordinate {
  const latitude = assertFinite(coordinate.latitude, 'latitude')
  const longitude = assertFinite(coordinate.longitude, 'longitude')

  if (latitude < -90 || latitude > 90) {
    throw new RangeError('latitude must be between -90 and 90 degrees')
  }
  if (longitude < -180 || longitude > 180) {
    throw new RangeError('longitude must be between -180 and 180 degrees')
  }

  if (coordinate.altitude !== undefined) {
    assertFinite(coordinate.altitude, 'altitude')
  } else if (options.requireAltitude) {
    throw new RangeError('altitude is required for this operation')
  }

  return coordinate
}

export function validateSurfaceOffset(
  value: number | undefined,
): number {
  const offset = value ?? 0
  return assertFinite(offset, 'altitudeAboveSurface')
}
