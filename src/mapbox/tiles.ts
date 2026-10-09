import type { BBox } from '../types'
import { validateBBox } from '../geo/bbox'

/**
 * A Web Mercator XYZ tile address, as {@linkcode tilesForBBox} returns it.
 *
 * @see {@linkcode tileBounds}
 */
export interface TileId {
  /** Zoom level, an integer from 0 to 30. */
  readonly z: number
  /** Column, from 0 at longitude -180° to `2^z - 1`. */
  readonly x: number
  /** Row, from 0 at the northern edge to `2^z - 1`. */
  readonly y: number
}

const MAX_MERCATOR_LATITUDE = 85.05112878

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function assertZoom(zoom: number): void {
  if (!Number.isSafeInteger(zoom) || zoom < 0 || zoom > 30) {
    throw new RangeError('zoom must be an integer between 0 and 30')
  }
}

/**
 * The XYZ tile column containing a longitude. Longitudes outside ±180° are
 * clamped.
 *
 * @param longitude Longitude in degrees.
 * @param zoom Zoom level.
 * @throws {RangeError} When `zoom` is not an integer from 0 to 30.
 */
export function lonToTileX(longitude: number, zoom: number): number {
  assertZoom(zoom)
  const n = 2 ** zoom
  const lon = clamp(longitude, -180, 180)
  return clamp(Math.floor(((lon + 180) / 360) * n), 0, n - 1)
}

/**
 * The XYZ tile row containing a latitude. Latitudes beyond the Web Mercator
 * limit of ±85.05112878° are clamped.
 *
 * @param latitude Latitude in degrees.
 * @param zoom Zoom level.
 * @throws {RangeError} When `zoom` is not an integer from 0 to 30.
 */
export function latToTileY(latitude: number, zoom: number): number {
  assertZoom(zoom)
  const n = 2 ** zoom
  const lat = clamp(latitude, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE)
  const radians = (lat * Math.PI) / 180
  const normalized =
    (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2

  return clamp(Math.floor(normalized * n), 0, n - 1)
}

function tilesForSegment(
  west: number,
  south: number,
  east: number,
  north: number,
  zoom: number,
): TileId[] {
  const minX = lonToTileX(west, zoom)
  const maxX = lonToTileX(east, zoom)
  const minY = latToTileY(north, zoom)
  const maxY = latToTileY(south, zoom)

  const tiles: TileId[] = []
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      tiles.push({ z: zoom, x, y })
    }
  }

  return tiles
}

/**
 * Returns XYZ tiles covering a bbox.
 *
 * Antimeridian-crossing bboxes are split into two segments rather than pulling
 * almost the entire world.
 */
export function tilesForBBox(bbox: BBox, zoom: number): TileId[] {
  validateBBox(bbox)
  assertZoom(zoom)

  const [west, south, east, north] = bbox
  if (west < east) {
    return tilesForSegment(west, south, east, north, zoom)
  }

  const western = tilesForSegment(west, south, 180, north, zoom)
  const eastern = tilesForSegment(-180, south, east, north, zoom)

  const seen = new Set<string>()
  return [...western, ...eastern].filter((tile) => {
    const key = `${tile.z}/${tile.x}/${tile.y}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

/** WGS84 bounds of an XYZ tile, in degrees. */
export interface TileBounds {
  /** Western edge longitude. */
  readonly west: number
  /** Southern edge latitude. */
  readonly south: number
  /** Eastern edge longitude. */
  readonly east: number
  /** Northern edge latitude. */
  readonly north: number
}

const tileLongitude = (x: number, n: number): number => (x / n) * 360 - 180

const tileLatitude = (y: number, n: number): number =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI

/**
 * The WGS84 bounds of a Web Mercator XYZ tile: the inverse of
 * {@linkcode lonToTileX} and {@linkcode latToTileY} at the tile's corners.
 *
 * @throws {RangeError} When the zoom is outside 0..30 or x/y fall outside the
 * zoom's tile grid.
 */
export function tileBounds(tile: TileId): TileBounds {
  assertZoom(tile.z)
  const n = 2 ** tile.z
  if (
    !Number.isSafeInteger(tile.x) ||
    !Number.isSafeInteger(tile.y) ||
    tile.x < 0 ||
    tile.y < 0 ||
    tile.x >= n ||
    tile.y >= n
  ) {
    throw new RangeError(`tile x/y must be within [0, ${n - 1}] for zoom ${tile.z}`)
  }
  return {
    west: tileLongitude(tile.x, n),
    east: tileLongitude(tile.x + 1, n),
    north: tileLatitude(tile.y, n),
    south: tileLatitude(tile.y + 1, n),
  }
}
