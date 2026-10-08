import { enuToViroPosition, projectToEnu, unprojectFromEnu } from './enu'
import { tileKey, tilePointToLngLat, validateTile, type XyzTile } from './tile'
import type { EnuOrigin, GeoWorldPosition } from './types'

/**
 * Where a map tile lies flat on the ground of an {@linkcode EnuOrigin}, in
 * Viro axes: centre `position` (y = 0) and its east-west `widthM` and
 * north-south `depthM`. A `ViroQuad` with `rotation={[-90, 0, 0]}`, `width`
 * and `height` set to these sizes shows the tile image with north up.
 *
 * @see {@linkcode groundTileQuad}
 */
export interface GroundTileQuad {
  readonly tile: XyzTile
  /** `z/x/y`, stable across renders. */
  readonly key: string
  readonly position: GeoWorldPosition
  readonly widthM: number
  readonly depthM: number
}

/**
 * Places a Web Mercator tile on the ground plane of `origin`. The tile is
 * treated as a rectangle measured through its centre; at street zooms
 * (z15 and above) its edges are off by under 0.1% from the true trapezoid.
 *
 * @throws {RangeError} When the tile is outside its zoom's grid.
 */
export function groundTileQuad(origin: EnuOrigin, tile: XyzTile): GroundTileQuad {
  validateTile(tile)
  const at = (px: number, py: number) => {
    const { latitude, longitude } = tilePointToLngLat(tile, px, py, 1)
    return projectToEnu(origin, { latitude, longitude, altitude: origin.altitude })
  }
  const center = at(0.5, 0.5)
  const west = at(0, 0.5)
  const east = at(1, 0.5)
  const north = at(0.5, 0)
  const south = at(0.5, 1)
  const [x, , z] = enuToViroPosition(center)
  return {
    tile: { z: tile.z, x: tile.x, y: tile.y },
    key: tileKey(tile),
    position: [x, 0, z],
    widthM: Math.hypot(east.eastM - west.eastM, east.northM - west.northM),
    depthM: Math.hypot(north.eastM - south.eastM, north.northM - south.northM),
  }
}

const lonToX = (longitude: number, n: number): number =>
  Math.min(n - 1, Math.max(0, Math.floor(((longitude + 180) / 360) * n)))

const latToY = (latitude: number, n: number): number => {
  const radians = (latitude * Math.PI) / 180
  const y = (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2
  return Math.min(n - 1, Math.max(0, Math.floor(y * n)))
}

/**
 * Tiles at `zoom` that touch a circle of `radiusM` around a ground point
 * given in ENU metres from `origin`, ordered by the distance from that point
 * to each tile's centre. Use it to load imagery and
 * buildings around where the wearer stands.
 *
 * @throws {RangeError} When `zoom` is not an integer in 0..30 or `radiusM` is
 * not positive and finite.
 */
export function tilesAroundEnuPoint(
  origin: EnuOrigin,
  center: { readonly eastM: number; readonly northM: number },
  radiusM: number,
  zoom: number,
): XyzTile[] {
  if (!Number.isSafeInteger(zoom) || zoom < 0 || zoom > 30) {
    throw new RangeError('zoom must be an integer between 0 and 30')
  }
  if (!(radiusM > 0) || !Number.isFinite(radiusM)) {
    throw new RangeError('radiusM must be a positive finite number')
  }
  const corner = (de: number, dn: number) =>
    unprojectFromEnu(origin, { eastM: center.eastM + de, northM: center.northM + dn, upM: 0 })
  const southWest = corner(-radiusM, -radiusM)
  const northEast = corner(radiusM, radiusM)
  const n = 2 ** zoom
  const minX = lonToX(southWest.longitude, n)
  const maxX = lonToX(northEast.longitude, n)
  const minY = latToY(northEast.latitude, n)
  const maxY = latToY(southWest.latitude, n)

  const tiles: { tile: XyzTile; distanceM: number }[] = []
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      const tile = { z: zoom, x, y }
      const quad = groundTileQuad(origin, tile)
      // Distance from the circle centre to the tile rectangle.
      const dx = Math.max(0, Math.abs(quad.position[0] - center.eastM) - quad.widthM / 2)
      const dz = Math.max(0, Math.abs(-quad.position[2] - center.northM) - quad.depthM / 2)
      if (Math.hypot(dx, dz) > radiusM) continue
      tiles.push({
        tile,
        distanceM: Math.hypot(quad.position[0] - center.eastM, -quad.position[2] - center.northM),
      })
    }
  }
  return tiles.sort((a, b) => a.distanceM - b.distanceM).map((entry) => entry.tile)
}
