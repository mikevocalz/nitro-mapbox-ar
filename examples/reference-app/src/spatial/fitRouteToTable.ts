import type { GeoWorldPosition } from '@mikevocalz/nitro-mapbox-ar-reactvision'

/** Transform for the node that holds a route projected in metres. */
export interface TabletopFit {
  /** Uniform scale from route metres to table metres. */
  readonly scale: number
  /**
   * Node-local offset, in table metres, that centres the route horizontally
   * and rests its lowest point on the node origin.
   */
  readonly offset: GeoWorldPosition
}

/**
 * Scales a projected route (Viro axes, metres, from `projectRouteToEnu`) so
 * its widest horizontal extent from the centre equals `tableRadiusM`.
 *
 * A route whose points all coincide keeps scale 1.
 *
 * @throws {RangeError} When `points` is empty, a point is not finite, or
 * `tableRadiusM` is not a positive finite number.
 */
export function fitRouteToTable(
  points: readonly GeoWorldPosition[],
  tableRadiusM: number,
): TabletopFit {
  if (!Number.isFinite(tableRadiusM) || tableRadiusM <= 0) {
    throw new RangeError('tableRadiusM must be a positive finite number')
  }
  if (points.length === 0) {
    throw new RangeError('A route needs at least one point')
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x, y, z] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new RangeError('Route points must be finite')
    }
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }

  const centreX = (minX + maxX) / 2
  const centreZ = (minZ + maxZ) / 2
  let radius = 0
  for (const [x, , z] of points) {
    radius = Math.max(radius, Math.hypot(x - centreX, z - centreZ))
  }

  const scale = radius === 0 ? 1 : tableRadiusM / radius
  return {
    scale,
    offset: [-centreX * scale, -minY * scale, -centreZ * scale],
  }
}
