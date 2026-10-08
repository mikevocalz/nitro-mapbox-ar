import earcut from 'earcut'

import { projectToEnu } from './enu'
import { readVectorTileLayer, type VectorTileValue } from './mvt'
import { tilePointToLngLat, validateTile, type XyzTile } from './tile'
import type { EnuOrigin } from './types'

/**
 * Options for {@linkcode extrudeBuildings}.
 */
export interface ExtrudeBuildingsOptions {
  /**
   * Vector tile layer holding building footprints.
   * @default 'building' (Mapbox Streets v8)
   */
  readonly layerName?: string
  /**
   * Height for footprints that carry no `height`. Such buildings are counted
   * in {@linkcode BuildingMesh.estimatedHeightCount}.
   * @default 12
   */
  readonly defaultHeightM?: number
  /**
   * Heights above this are clamped. Guards against bad source data.
   * @default 500
   */
  readonly maxHeightM?: number
  /**
   * Keep only buildings whose footprint centroid lies within `radiusM` of
   * `center` (ENU metres from the origin). Omit to keep the whole tile.
   */
  readonly within?: {
    readonly center: { readonly eastM: number; readonly northM: number }
    readonly radiusM: number
  }
}

/**
 * Extruded building geometry for one vector tile, in the Viro axes of an
 * {@linkcode EnuOrigin} (x = east, y = up, z = -north; see
 * `enuToViroPosition`). Heights are metres above the origin's ground plane,
 * y = 0: the ground is treated as flat and Earth curvature is ignored, which
 * is under 8 cm across a 1 km tile.
 *
 * Triangles wind counter-clockwise seen from outside, so back-face culling is
 * safe. Walls are flat shaded: each wall quad has its own four vertices.
 *
 * @see {@linkcode extrudeBuildings}
 */
export interface BuildingMesh {
  /** The tile this mesh came from. */
  readonly tile: XyzTile
  /** `[x, y, z]` per vertex, metres. */
  readonly positions: Float32Array
  /** Unit `[x, y, z]` normal per vertex. */
  readonly normals: Float32Array
  /** Three vertex indices per triangle. */
  readonly indices: Uint32Array
  /** Building parts extruded. */
  readonly buildingCount: number
  /**
   * Parts with no `height` in the source, drawn at
   * {@linkcode ExtrudeBuildingsOptions.defaultHeightM}. Show a label such as
   * "some heights estimated" when this is above zero.
   */
  readonly estimatedHeightCount: number
}

interface Ring {
  /** Flat ENU [east, north, ...]. */
  readonly enu: number[]
  /** Flat tile units [x, y, ...] after clipping, for clip-edge detection. */
  readonly tile: number[]
}

const numeric = (value: VectorTileValue | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const isTrue = (value: VectorTileValue | undefined): boolean =>
  value === true || value === 'true'

const isFalse = (value: VectorTileValue | undefined): boolean =>
  value === false || value === 'false'

/** Surveyor's formula on flat [x, y, ...]. */
function signedArea(points: readonly number[]): number {
  let area = 0
  const n = points.length / 2
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    area += points[i * 2]! * points[j * 2 + 1]! - points[j * 2]! * points[i * 2 + 1]!
  }
  return area / 2
}

/**
 * Sutherland-Hodgman clip of a flat ring to the square [0, extent]. The box is
 * convex, so concave rings clip correctly; they may gain zero-area slivers
 * along the box edge, which become skipped clip-edge walls.
 */
function clipRing(points: readonly number[], extent: number): number[] {
  let output = points.slice()
  const edges: [axis: 0 | 1, bound: number, keepBelow: boolean][] = [
    [0, 0, false],
    [0, extent, true],
    [1, 0, false],
    [1, extent, true],
  ]
  for (const [axis, bound, keepBelow] of edges) {
    const input = output
    output = []
    const n = input.length / 2
    if (n === 0) break
    const inside = (i: number): boolean =>
      keepBelow ? input[i * 2 + axis]! <= bound : input[i * 2 + axis]! >= bound
    for (let i = 0; i < n; i += 1) {
      const j = (i + n - 1) % n
      const currentIn = inside(i)
      const previousIn = inside(j)
      if (currentIn !== previousIn) {
        const ax = input[j * 2]!
        const ay = input[j * 2 + 1]!
        const bx = input[i * 2]!
        const by = input[i * 2 + 1]!
        const a = axis === 0 ? ax : ay
        const b = axis === 0 ? bx : by
        const t = (bound - a) / (b - a)
        output.push(
          axis === 0 ? bound : ax + (bx - ax) * t,
          axis === 1 ? bound : ay + (by - ay) * t,
        )
      }
      if (currentIn) output.push(input[i * 2]!, input[i * 2 + 1]!)
    }
  }
  return output
}

/** Drops consecutive duplicate points (clipping can create them). */
function dedupe(points: readonly number[]): number[] {
  const out: number[] = []
  const n = points.length / 2
  for (let i = 0; i < n; i += 1) {
    const x = points[i * 2]!
    const y = points[i * 2 + 1]!
    const last = out.length - 2
    if (last >= 0 && out[last] === x && out[last + 1] === y) continue
    out.push(x, y)
  }
  if (out.length >= 4 && out[0] === out[out.length - 2] && out[1] === out[out.length - 1]) {
    out.length -= 2
  }
  return out
}

/** True when segment a-b runs along one edge of the tile box. */
function onTileEdge(ax: number, ay: number, bx: number, by: number, extent: number): boolean {
  return (
    (ax === 0 && bx === 0) ||
    (ax === extent && bx === extent) ||
    (ay === 0 && by === 0) ||
    (ay === extent && by === extent)
  )
}

/** Groups MVT rings into polygons: an exterior ring followed by its holes. */
function polygonsOf(rings: readonly (readonly number[])[]): number[][][] {
  const polygons: number[][][] = []
  for (const ring of rings) {
    if (ring.length < 6) continue
    // MVT exteriors have positive area with y pointing down (spec 4.3.4.4).
    const area = signedArea(ring)
    if (area > 0) polygons.push([ring.slice()])
    else if (area < 0 && polygons.length > 0) polygons[polygons.length - 1]!.push(ring.slice())
  }
  return polygons
}

class MeshBuilder {
  readonly positions: number[] = []
  readonly normals: number[] = []
  readonly indices: number[] = []

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
    this.positions.push(x, y, z)
    this.normals.push(nx, ny, nz)
    return this.positions.length / 3 - 1
  }

  /** Adds a triangle wound so its geometric normal agrees with (nx, ny, nz). */
  triangle(a: number, b: number, c: number, nx: number, ny: number, nz: number): void {
    const p = this.positions
    const ux = p[b * 3]! - p[a * 3]!
    const uy = p[b * 3 + 1]! - p[a * 3 + 1]!
    const uz = p[b * 3 + 2]! - p[a * 3 + 2]!
    const vx = p[c * 3]! - p[a * 3]!
    const vy = p[c * 3 + 1]! - p[a * 3 + 1]!
    const vz = p[c * 3 + 2]! - p[a * 3 + 2]!
    const dot =
      (uy * vz - uz * vy) * nx + (uz * vx - ux * vz) * ny + (ux * vy - uy * vx) * nz
    if (dot >= 0) this.indices.push(a, b, c)
    else this.indices.push(a, c, b)
  }
}

/**
 * Extrudes the building footprints of one Mapbox Vector Tile into a mesh in
 * the Viro axes of `origin`, ready for `MapboxViroBuildings`.
 *
 * Reads Mapbox Streets v8 `building` properties: `height` and `min_height`
 * in metres, `extrude` (parts marked `false` are covered by other parts and
 * skipped) and `underground` (skipped). Footprints are clipped to the tile so
 * neighbouring tiles meet without overlapping, and walls along the tile edge
 * (cut by the clip, not real facades) are left out.
 *
 * The result depends only on the bytes, `tile`, `origin` and options, so it
 * can be cached per tile for a fixed origin.
 *
 * @throws {RangeError} When the tile is outside its zoom's grid, an option is
 * not finite and positive, or the bytes are not a vector tile.
 */
export function extrudeBuildings(
  data: ArrayBuffer | Uint8Array,
  tile: XyzTile,
  origin: EnuOrigin,
  options: ExtrudeBuildingsOptions = {},
): BuildingMesh {
  validateTile(tile)
  const defaultHeightM = options.defaultHeightM ?? 12
  const maxHeightM = options.maxHeightM ?? 500
  if (!(defaultHeightM > 0) || !Number.isFinite(defaultHeightM)) {
    throw new RangeError('defaultHeightM must be a positive finite number')
  }
  if (!(maxHeightM > 0) || !Number.isFinite(maxHeightM)) {
    throw new RangeError('maxHeightM must be a positive finite number')
  }
  const within = options.within
  if (within && (!(within.radiusM > 0) || !Number.isFinite(within.radiusM))) {
    throw new RangeError('within.radiusM must be a positive finite number')
  }

  const mesh = new MeshBuilder()
  let buildingCount = 0
  let estimatedHeightCount = 0
  const layer = readVectorTileLayer(data, options.layerName ?? 'building')
  const extent = layer?.extent ?? 4096

  const toEnu = (px: number, py: number): [number, number] => {
    const { latitude, longitude } = tilePointToLngLat(tile, px, py, extent)
    const offset = projectToEnu(origin, { latitude, longitude, altitude: origin.altitude })
    return [offset.eastM, offset.northM]
  }

  for (const feature of layer?.features ?? []) {
    if (feature.type !== 'polygon') continue
    const props = feature.properties
    if (isTrue(props.underground) || isFalse(props.extrude)) continue
    const sourceHeight = numeric(props.height)
    const heightM = Math.min(maxHeightM, sourceHeight ?? defaultHeightM)
    const minHeightM = Math.max(0, numeric(props.min_height) ?? 0)
    if (!(heightM > minHeightM)) continue

    for (const polygon of polygonsOf(feature.geometry)) {
      const rings: Ring[] = []
      for (const [index, raw] of polygon.entries()) {
        const clipped = dedupe(clipRing(raw, extent))
        if (clipped.length < 6 || signedArea(clipped) === 0) {
          if (index === 0) break
          continue
        }
        const enu: number[] = []
        for (let i = 0; i < clipped.length; i += 2) {
          enu.push(...toEnu(clipped[i]!, clipped[i + 1]!))
        }
        rings.push({ enu, tile: clipped })
      }
      if (rings.length === 0) continue
      const outer = rings[0]!

      if (within) {
        let east = 0
        let north = 0
        const n = outer.enu.length / 2
        for (let i = 0; i < n; i += 1) {
          east += outer.enu[i * 2]!
          north += outer.enu[i * 2 + 1]!
        }
        const distance = Math.hypot(east / n - within.center.eastM, north / n - within.center.northM)
        if (distance > within.radiusM) continue
      }

      buildingCount += 1
      if (sourceHeight === undefined) estimatedHeightCount += 1

      // Roof (and floor for raised parts): one triangulation for both.
      const flat: number[] = []
      const holes: number[] = []
      for (const ring of rings) {
        if (flat.length > 0) holes.push(flat.length / 2)
        flat.push(...ring.enu)
      }
      const triangles = earcut(flat, holes, 2)
      const caps: [y: number, ny: number][] = [[heightM, 1]]
      if (minHeightM > 0) caps.push([minHeightM, -1])
      for (const [y, ny] of caps) {
        const base = mesh.positions.length / 3
        for (let i = 0; i < flat.length; i += 2) {
          mesh.vertex(flat[i]!, y, -flat[i + 1]!, 0, ny, 0)
        }
        for (let i = 0; i < triangles.length; i += 3) {
          mesh.triangle(
            base + triangles[i]!,
            base + triangles[i + 1]!,
            base + triangles[i + 2]!,
            0,
            ny,
            0,
          )
        }
      }

      // Walls. Orient each ring so the solid lies to its left in ENU (outer
      // counter-clockwise, holes clockwise); the outward normal is then to the
      // right of each edge.
      for (const [index, ring] of rings.entries()) {
        const ccw = signedArea(ring.enu) > 0
        const reverse = index === 0 ? !ccw : ccw
        const n = ring.enu.length / 2
        for (let k = 0; k < n; k += 1) {
          const i = reverse ? n - 1 - k : k
          const j = reverse ? (i + n - 1) % n : (i + 1) % n
          if (
            onTileEdge(ring.tile[i * 2]!, ring.tile[i * 2 + 1]!, ring.tile[j * 2]!, ring.tile[j * 2 + 1]!, extent)
          ) {
            continue
          }
          const ae = ring.enu[i * 2]!
          const an = ring.enu[i * 2 + 1]!
          const be = ring.enu[j * 2]!
          const bn = ring.enu[j * 2 + 1]!
          const length = Math.hypot(be - ae, bn - an)
          if (length === 0) continue
          // Right of (de, dn) in ENU is (dn, -de); Viro z is -north.
          const nx = (bn - an) / length
          const nz = (be - ae) / length
          const a0 = mesh.vertex(ae, minHeightM, -an, nx, 0, nz)
          const b0 = mesh.vertex(be, minHeightM, -bn, nx, 0, nz)
          const b1 = mesh.vertex(be, heightM, -bn, nx, 0, nz)
          const a1 = mesh.vertex(ae, heightM, -an, nx, 0, nz)
          mesh.triangle(a0, b0, b1, nx, 0, nz)
          mesh.triangle(a0, b1, a1, nx, 0, nz)
        }
      }
    }
  }

  return {
    tile: { z: tile.z, x: tile.x, y: tile.y },
    positions: Float32Array.from(mesh.positions),
    normals: Float32Array.from(mesh.normals),
    indices: Uint32Array.from(mesh.indices),
    buildingCount,
    estimatedHeightCount,
  }
}
