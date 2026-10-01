export type BBox = readonly [
  west: number,
  south: number,
  east: number,
  north: number,
]

export type RendererPreference =
  | 'auto'
  | 'graphite'
  | 'webgpu'
  | 'nitro'
  | 'cpu'
export type TerrainQuality = 'performance' | 'balanced' | 'quality'
export type ImageryMode = 'satellite' | 'none'

export interface CacheOptions {
  memoryBytes?: number
  diskBytes?: number
}

export interface MapboxAROptions {
  accessToken: string
  renderer?: RendererPreference
  cache?: CacheOptions
}

export interface NormalizedMapboxARConfig {
  accessToken: string
  renderer: RendererPreference
  cache: {
    memoryBytes: number
    diskBytes: number
  }
}

export interface TerrainLoadOptions {
  bbox: BBox
  imagery?: ImageryMode
  exaggeration?: number
  quality?: TerrainQuality
}
