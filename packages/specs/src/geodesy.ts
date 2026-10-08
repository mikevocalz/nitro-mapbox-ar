const EARTH_RADIUS_M = 6_371_000
const RAD = Math.PI / 180

interface LatLng {
  readonly latitude: number
  readonly longitude: number
}

/** Great-circle distance in metres (haversine, mean Earth radius). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (b.latitude - a.latitude) * RAD
  const dLng = (b.longitude - a.longitude) * RAD
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * RAD) * Math.cos(b.latitude * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Metres along a polyline to the point on it closest to `point`. Each
 * segment is projected in a local equirectangular plane, which is accurate at
 * route-segment lengths.
 */
export function distanceAlongM(path: readonly LatLng[], point: LatLng): number {
  let best = Number.POSITIVE_INFINITY
  let along = 0
  let travelled = 0
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]!
    const b = path[i]!
    const cosLat = Math.cos(a.latitude * RAD)
    const bx = (b.longitude - a.longitude) * cosLat
    const by = b.latitude - a.latitude
    const px = (point.longitude - a.longitude) * cosLat
    const py = point.latitude - a.latitude
    const lengthSq = bx * bx + by * by
    const t = lengthSq === 0 ? 0 : Math.min(1, Math.max(0, (px * bx + py * by) / lengthSq))
    const closest = {
      latitude: a.latitude + by * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    }
    const offset = distanceM(point, closest)
    const segment = distanceM(a, b)
    if (offset < best) {
      best = offset
      along = travelled + segment * t
    }
    travelled += segment
  }
  return along
}

/** Total length of a polyline in metres. */
export function lengthM(path: readonly LatLng[]): number {
  let total = 0
  for (let i = 1; i < path.length; i += 1) total += distanceM(path[i - 1]!, path[i]!)
  return total
}
