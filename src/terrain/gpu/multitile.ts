import type { TileId } from '../../mapbox/tiles'
import { tileGroundSpanMeters } from './grid'

/**
 * A 4x4 matrix as 16 numbers in column-major order, the layout WGSL
 * `mat4x4<f32>` uses. Accepted by {@linkcode multiplyMatrix4}.
 */
export type Matrix4Like = Float32Array | readonly number[]

/**
 * Position of a tile's center relative to the origin tile's center, in metres
 * on the origin's local tangent plane. Returned by
 * {@linkcode getLocalTileOffset}.
 */
export interface LocalTileOffset {
  /** East offset in metres. Wraps across the antimeridian. */
  readonly x: number
  /** South offset in metres. XYZ tile rows grow southward, so +z is south. */
  readonly z: number
}

function assertSameZoom(origin: TileId, tile: TileId): void {
  if (origin.z !== tile.z) {
    throw new RangeError(
      `multi-tile terrain requires one zoom level; got ${origin.z} and ${tile.z}`,
    )
  }
}

/**
 * Column difference `tile.x - origin.x`, wrapped into
 * `[-2^z / 2, 2^z / 2]` so the last XYZ column and column zero stay
 * neighbours across the antimeridian.
 *
 * @returns Signed column delta in whole tiles.
 * @throws {RangeError} When the two tiles have different zoom levels.
 */
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

/**
 * Builds a column-major 4x4 translation matrix. The translation sits in
 * elements 12 to 14, matching {@linkcode Matrix4Like}.
 *
 * @param x Translation along x, in the caller's world units (metres for
 * terrain).
 * @param y Translation along y.
 * @param z Translation along z.
 * @throws {RangeError} When any component is not finite.
 */
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
