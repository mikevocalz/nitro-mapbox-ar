import type { BBox } from '../types'
import { validateBBox } from '../geo/bbox'

export interface TileId {
  readonly z: number
  readonly x: number
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

export function lonToTileX(longitude: number, zoom: number): number {
  assertZoom(zoom)
  const n = 2 ** zoom
  const lon = clamp(longitude, -180, 180)
  return clamp(Math.floor(((lon + 180) / 360) * n), 0, n - 1)
}

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
