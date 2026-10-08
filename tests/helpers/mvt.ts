/**
 * A tiny Mapbox Vector Tile 2.1 encoder for host tests. It writes exactly
 * what the spec describes (layers, keys/values, zigzag command geometry), so
 * the decoder under test is checked against the spec, not against itself.
 */

export type TestValue = string | number | boolean

export interface TestFeature {
  readonly id?: number
  /** 1 point, 2 linestring, 3 polygon. */
  readonly type: 1 | 2 | 3
  readonly properties?: Record<string, TestValue>
  /** Rings as [[x, y], ...]; polygon rings are written open and closed with ClosePath. */
  readonly rings: readonly (readonly (readonly [number, number])[])[]
}

export interface TestLayer {
  readonly name: string
  readonly extent?: number
  readonly features: readonly TestFeature[]
}

function varint(out: number[], value: number): void {
  let v = value
  while (v >= 0x80) {
    out.push((v % 128) | 0x80)
    v = Math.floor(v / 128)
  }
  out.push(v)
}

const zz = (n: number): number => (n >= 0 ? n * 2 : -n * 2 - 1)

function field(out: number[], number: number, wireType: number): void {
  varint(out, number * 8 + wireType)
}

function bytesField(out: number[], number: number, bytes: readonly number[]): void {
  field(out, number, 2)
  varint(out, bytes.length)
  out.push(...bytes)
}

function stringField(out: number[], number: number, value: string): void {
  bytesField(out, number, [...new TextEncoder().encode(value)])
}

function packed(out: number[], number: number, values: readonly number[]): void {
  const body: number[] = []
  for (const value of values) varint(body, value)
  bytesField(out, number, body)
}

function encodeValue(value: TestValue): number[] {
  const out: number[] = []
  if (typeof value === 'string') stringField(out, 1, value)
  else if (typeof value === 'boolean') {
    field(out, 7, 0)
    varint(out, value ? 1 : 0)
  } else if (Number.isInteger(value) && value >= 0) {
    field(out, 5, 0)
    varint(out, value)
  } else if (Number.isInteger(value)) {
    field(out, 6, 0)
    varint(out, zz(value))
  } else {
    field(out, 3, 1)
    const view = new DataView(new ArrayBuffer(8))
    view.setFloat64(0, value, true)
    out.push(...new Uint8Array(view.buffer))
  }
  return out
}

function encodeGeometry(feature: TestFeature): number[] {
  const commands: number[] = []
  let x = 0
  let y = 0
  for (const ring of feature.rings) {
    const [first, ...rest] = ring
    if (!first) continue
    commands.push(1 | (1 << 3), zz(first[0] - x), zz(first[1] - y))
    x = first[0]
    y = first[1]
    if (rest.length > 0) {
      commands.push(2 | (rest.length << 3))
      for (const [px, py] of rest) {
        commands.push(zz(px - x), zz(py - y))
        x = px
        y = py
      }
    }
    if (feature.type === 3) commands.push(7 | (1 << 3))
  }
  return commands
}

export function encodeVectorTile(layers: readonly TestLayer[]): Uint8Array {
  const tile: number[] = []
  for (const layer of layers) {
    const keys: string[] = []
    const values: TestValue[] = []
    const body: number[] = []
    field(body, 15, 0)
    varint(body, 2)
    stringField(body, 1, layer.name)
    for (const feature of layer.features) {
      const f: number[] = []
      if (feature.id !== undefined) {
        field(f, 1, 0)
        varint(f, feature.id)
      }
      const tags: number[] = []
      for (const [key, value] of Object.entries(feature.properties ?? {})) {
        let k = keys.indexOf(key)
        if (k < 0) k = keys.push(key) - 1
        let v = values.indexOf(value)
        if (v < 0) v = values.push(value) - 1
        tags.push(k, v)
      }
      if (tags.length > 0) packed(f, 2, tags)
      field(f, 3, 0)
      varint(f, feature.type)
      packed(f, 4, encodeGeometry(feature))
      bytesField(body, 2, f)
    }
    for (const key of keys) stringField(body, 3, key)
    for (const value of values) bytesField(body, 4, encodeValue(value))
    field(body, 5, 0)
    varint(body, layer.extent ?? 4096)
    bytesField(tile, 3, body)
  }
  return Uint8Array.from(tile)
}

/**
 * A rectangle ring in tile units with positive surveyor's area when y points
 * down, which is what MVT requires of exterior rings.
 */
export function exteriorRect(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]
}

/** The same rectangle wound the other way: an MVT interior ring (hole). */
export function interiorRect(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  return exteriorRect(x0, y0, x1, y1).reverse()
}
