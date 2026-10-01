import type { TileId } from '../../mapbox/tiles'
import { tileGroundSpanMeters } from './grid'

export type Matrix4Like = Float32Array | readonly number[]

export interface LocalTileOffset {
  readonly x: number
  readonly z: number
}

function assertSameZoom(origin: TileId, tile: TileId): void {
  if (origin.z !== tile.z) {
    throw new RangeError(
      `multi-tile terrain requires one zoom level; got ${origin.z} and ${tile.z}`,
    )
  }
}

export function wrappedTileDeltaX(origin: TileId, tile: TileId): number {
  assertSameZoom(origin, tile)

  const extent = 2 ** origin.z
  let delta = tile.x - origin.x
  const half = extent / 2

  if (delta > half) {
    delta -= extent
  } else if (delta < -half) {
    delta += extent
  }

  return delta
}

/**
 * Places same-zoom XYZ tiles in a local tangent plane.
 *
 * All tiles in the batch use the origin tile's ground span so adjacent tile
 * boundaries meet exactly. This is intended for local AR/XR neighborhoods,
 * not continent-scale cartography.
 */
export function getLocalTileOffset(
  origin: TileId,
  tile: TileId,
  tileSpanMeters = tileGroundSpanMeters(origin),
): LocalTileOffset {
  assertSameZoom(origin, tile)

  if (!Number.isFinite(tileSpanMeters) || tileSpanMeters <= 0) {
    throw new RangeError('tileSpanMeters must be a finite positive number')
  }

  return {
    x: wrappedTileDeltaX(origin, tile) * tileSpanMeters,
    z: (tile.y - origin.y) * tileSpanMeters,
  }
}

export function makeTranslationMatrix(
  x: number,
  y: number,
  z: number,
): Float32Array {
  if (![x, y, z].every(Number.isFinite)) {
    throw new RangeError('translation values must be finite')
  }

  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ])
}

/**
 * Column-major mat4 multiplication matching WGSL's matrix * vector convention.
 */
export function multiplyMatrix4(
  a: Matrix4Like,
  b: Matrix4Like,
): Float32Array {
  if (a.length !== 16 || b.length !== 16) {
    throw new RangeError('both matrices must contain 16 values')
  }

  const out = new Float32Array(16)

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0
      for (let k = 0; k < 4; k += 1) {
        value += a[k * 4 + row] * b[column * 4 + k]
      }
      out[column * 4 + row] = value
    }
  }

  return out
}
