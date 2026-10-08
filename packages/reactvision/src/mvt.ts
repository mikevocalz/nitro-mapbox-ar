/**
 * A minimal Mapbox Vector Tile 2.1 reader: one layer at a time, polygons and
 * lines as rings of tile coordinates, scalar properties. Enough for building
 * extrusion without pulling a protobuf runtime into the bundle.
 *
 * Spec: https://github.com/mapbox/vector-tile-spec/tree/master/2.1
 */

/** A property value from a vector tile feature. */
export type VectorTileValue = string | number | boolean

/** Geometry type of a {@linkcode VectorTileFeature}. */
export type VectorTileGeometryType = 'unknown' | 'point' | 'linestring' | 'polygon'

/**
 * One feature of a {@linkcode VectorTileLayer}.
 *
 * @see {@linkcode readVectorTileLayer}
 */
export interface VectorTileFeature {
  /** Feature id, when the tile carries one. Ids above 2^53 lose precision. */
  readonly id?: number
  readonly type: VectorTileGeometryType
  readonly properties: Readonly<Record<string, VectorTileValue>>
  /**
   * Rings (polygons), lines or point groups as flat `[x0, y0, x1, y1, ...]`
   * arrays in tile units, y pointing south. Polygon rings are not closed: the
   * last point is not repeated.
   */
  readonly geometry: readonly (readonly number[])[]
}

/**
 * A decoded layer of a vector tile.
 *
 * @see {@linkcode readVectorTileLayer}
 */
export interface VectorTileLayer {
  readonly name: string
  /** Tile units per tile edge, usually 4096. */
  readonly extent: number
  readonly features: readonly VectorTileFeature[]
}

const GEOMETRY_TYPES: readonly VectorTileGeometryType[] = [
  'unknown',
  'point',
  'linestring',
  'polygon',
]

const textDecoder = new TextDecoder()

class Reader {
  pos: number
  readonly end: number
  readonly bytes: Uint8Array

  constructor(bytes: Uint8Array, pos = 0, end = bytes.length) {
    this.bytes = bytes
    this.pos = pos
    this.end = end
  }

  varint(): number {
    let result = 0
    let multiplier = 1
    for (let i = 0; i < 10; i += 1) {
      if (this.pos >= this.end) throw new RangeError('Truncated varint in vector tile')
      const byte = this.bytes[this.pos++]!
      result += (byte & 0x7f) * multiplier
      if (byte < 0x80) return result
      multiplier *= 128
    }
    throw new RangeError('Varint longer than 10 bytes in vector tile')
  }

  length(): number {
    const length = this.varint()
    if (this.pos + length > this.end) throw new RangeError('Truncated field in vector tile')
    return length
  }

  sub(): Reader {
    const length = this.length()
    const reader = new Reader(this.bytes, this.pos, this.pos + length)
    this.pos += length
    return reader
  }

  string(): string {
    const length = this.length()
    const value = textDecoder.decode(this.bytes.subarray(this.pos, this.pos + length))
    this.pos += length
    return value
  }

  packed(): number[] {
    const sub = this.sub()
    const values: number[] = []
    while (sub.pos < sub.end) values.push(sub.varint())
    return values
  }

  skip(wireType: number): void {
    switch (wireType) {
      case 0:
        this.varint()
        return
      case 1:
        this.pos += 8
        break
      case 2:
        this.pos += this.length()
        return
      case 5:
        this.pos += 4
        break
      default:
        throw new RangeError(`Unsupported protobuf wire type ${wireType} in vector tile`)
    }
    if (this.pos > this.end) throw new RangeError('Truncated field in vector tile')
  }

  view(): DataView {
    return new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength)
  }
}

const zigzag = (value: number): number =>
  value % 2 === 0 ? value / 2 : -(value + 1) / 2

function readValue(reader: Reader): VectorTileValue | undefined {
  let value: VectorTileValue | undefined
  while (reader.pos < reader.end) {
    const tag = reader.varint()
    const field = Math.floor(tag / 8)
    const wireType = tag & 7
    if (field === 1 && wireType === 2) value = reader.string()
    else if (field === 2 && wireType === 5) {
      value = reader.view().getFloat32(reader.pos, true)
      reader.pos += 4
    } else if (field === 3 && wireType === 1) {
      value = reader.view().getFloat64(reader.pos, true)
      reader.pos += 8
    } else if ((field === 4 || field === 5) && wireType === 0) value = reader.varint()
    else if (field === 6 && wireType === 0) value = zigzag(reader.varint())
    else if (field === 7 && wireType === 0) value = reader.varint() !== 0
    else reader.skip(wireType)
  }
  return value
}

/** Decodes MVT geometry commands into flat coordinate groups. */
function decodeGeometry(commands: readonly number[]): number[][] {
  const groups: number[][] = []
  let current: number[] | null = null
  let x = 0
  let y = 0
  let i = 0
  while (i < commands.length) {
    const command = commands[i++]!
    const id = command & 7
    const count = Math.floor(command / 8)
    if (id === 1 || id === 2) {
      for (let k = 0; k < count; k += 1) {
        if (i + 1 >= commands.length) throw new RangeError('Truncated geometry in vector tile')
        x += zigzag(commands[i++]!)
        y += zigzag(commands[i++]!)
        if (id === 1) {
          current = []
          groups.push(current)
        }
        if (!current) throw new RangeError('LineTo before MoveTo in vector tile geometry')
        current.push(x, y)
      }
    } else if (id === 7) {
      // ClosePath: rings are kept open; nothing to add.
    } else {
      throw new RangeError(`Unknown geometry command ${id} in vector tile`)
    }
  }
  return groups
}

interface RawFeature {
  id?: number
  type: number
  tags: number[]
  geometry: number[]
}

function readFeature(reader: Reader): RawFeature {
  const feature: RawFeature = { type: 0, tags: [], geometry: [] }
  while (reader.pos < reader.end) {
    const tag = reader.varint()
    const field = Math.floor(tag / 8)
    const wireType = tag & 7
    if (field === 1 && wireType === 0) feature.id = reader.varint()
    else if (field === 2 && wireType === 2) feature.tags = reader.packed()
    else if (field === 3 && wireType === 0) feature.type = reader.varint()
    else if (field === 4 && wireType === 2) feature.geometry = reader.packed()
    else reader.skip(wireType)
  }
  return feature
}

function readLayer(reader: Reader, wanted: string): VectorTileLayer | undefined {
  let name: string | undefined
  let extent = 4096
  const keys: string[] = []
  const values: (VectorTileValue | undefined)[] = []
  const rawFeatures: RawFeature[] = []
  while (reader.pos < reader.end) {
    const tag = reader.varint()
    const field = Math.floor(tag / 8)
    const wireType = tag & 7
    if (field === 1 && wireType === 2) {
      name = reader.string()
      if (name !== wanted) return undefined
    } else if (field === 2 && wireType === 2) rawFeatures.push(readFeature(reader.sub()))
    else if (field === 3 && wireType === 2) keys.push(reader.string())
    else if (field === 4 && wireType === 2) values.push(readValue(reader.sub()))
    else if (field === 5 && wireType === 0) extent = reader.varint()
    else reader.skip(wireType)
  }
  if (name !== wanted) return undefined
  if (!(extent > 0)) throw new RangeError('Vector tile layer extent must be positive')

  const features = rawFeatures.map((raw): VectorTileFeature => {
    const properties: Record<string, VectorTileValue> = {}
    for (let i = 0; i + 1 < raw.tags.length; i += 2) {
      const key = keys[raw.tags[i]!]
      const value = values[raw.tags[i + 1]!]
      if (key !== undefined && value !== undefined) properties[key] = value
    }
    return {
      ...(raw.id === undefined ? {} : { id: raw.id }),
      type: GEOMETRY_TYPES[raw.type] ?? 'unknown',
      properties,
      geometry: decodeGeometry(raw.geometry),
    }
  })
  return { name: wanted, extent, features }
}

/**
 * Reads one named layer from a Mapbox Vector Tile. Other layers are skipped
 * without decoding their features.
 *
 * Returns `undefined` when the tile has no layer with that name, which is
 * normal for tiles with no buildings (open water, parks).
 *
 * @throws {RangeError} When the bytes are not a well-formed vector tile.
 */
export function readVectorTileLayer(
  data: ArrayBuffer | Uint8Array,
  layerName: string,
): VectorTileLayer | undefined {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const reader = new Reader(bytes)
  while (reader.pos < reader.end) {
    const tag = reader.varint()
    const field = Math.floor(tag / 8)
    const wireType = tag & 7
    if (field === 3 && wireType === 2) {
      const layer = readLayer(reader.sub(), layerName)
      if (layer) return layer
    } else {
      reader.skip(wireType)
    }
  }
  return undefined
}
