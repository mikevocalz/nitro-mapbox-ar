import type { GeoCoordinate, GeoWorldPosition } from './types'

export type ReactVisionPlatform =
  | 'ios'
  | 'android'
  | 'quest'
  | 'visionos'
  | 'web'

export type ColocationFamily = 'phone' | 'quest' | 'visionos' | 'none'

export interface SpatialRay {
  readonly origin: GeoWorldPosition
  readonly direction: GeoWorldPosition
  readonly hitPoint?: GeoWorldPosition
  readonly targetId?: string
}

export interface ReactVisionRuntimeCapabilities {
  readonly platform: ReactVisionPlatform
  readonly immersive: boolean
  readonly mixedReality: boolean
  readonly webRenderer: boolean
  readonly geospatialAnchors: boolean
  readonly vps: boolean
  readonly colocation: boolean
  readonly replicatedState: boolean
  readonly gaze: boolean
  /**
   * Keep false until the host has validated a Graphite-enabled visionOS build.
   */
  readonly graphiteOnVisionOS: boolean
}

export interface SpatialContextSnapshot {
  readonly platform: ReactVisionPlatform
  readonly camera?: GeoCoordinate
  readonly heading?: number
  readonly gaze?: SpatialRay
  readonly visibleAnchorIds: readonly string[]
  readonly peerCount?: number
  readonly metadata?: Readonly<Record<string, unknown>>
}

export function getColocationFamily(
  platform: ReactVisionPlatform,
): ColocationFamily {
  switch (platform) {
    case 'ios':
    case 'android':
      return 'phone'
    case 'quest':
      return 'quest'
    case 'visionos':
      return 'visionos'
    case 'web':
      return 'none'
  }
}

export function canShareColocationFrame(
  a: ReactVisionPlatform,
  b: ReactVisionPlatform,
): boolean {
  const left = getColocationFamily(a)
  return left !== 'none' && left === getColocationFamily(b)
}

export function normalizeReactVisionCapabilities(
  input: Partial<ReactVisionRuntimeCapabilities> & {
    readonly platform: ReactVisionPlatform
  },
): ReactVisionRuntimeCapabilities {
  const family = getColocationFamily(input.platform)

  return {
    platform: input.platform,
    immersive:
      input.immersive ??
      (input.platform === 'quest' || input.platform === 'visionos'),
    mixedReality:
      input.mixedReality ??
      (input.platform === 'ios' ||
        input.platform === 'android' ||
        input.platform === 'quest'),
    webRenderer: input.webRenderer ?? input.platform === 'web',
    geospatialAnchors:
      input.geospatialAnchors ??
      (input.platform === 'ios' || input.platform === 'android'),
    vps:
      input.vps ??
      (input.platform === 'ios' || input.platform === 'android'),
    colocation: input.colocation ?? family !== 'none',
    replicatedState: input.replicatedState ?? family !== 'none',
    gaze:
      input.gaze ??
      (input.platform === 'quest' || input.platform === 'visionos'),
    graphiteOnVisionOS: input.graphiteOnVisionOS ?? false,
  }
}

export function createSpatialContextSnapshot(
  capabilities: ReactVisionRuntimeCapabilities,
  input: Omit<SpatialContextSnapshot, 'platform'>,
): SpatialContextSnapshot {
  return {
    platform: capabilities.platform,
    camera: input.camera,
    heading: input.heading,
    gaze: capabilities.gaze ? input.gaze : undefined,
    visibleAnchorIds: input.visibleAnchorIds,
    peerCount: capabilities.colocation ? input.peerCount : undefined,
    metadata: input.metadata,
  }
}
