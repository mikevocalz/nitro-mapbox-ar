import type {
  ViroGeospatialPose,
  ViroQuaternion,
} from '@reactvision/react-viro'

export type GeoWorldPosition = readonly [x: number, y: number, z: number]

export interface GeoCoordinate {
  readonly latitude: number
  readonly longitude: number
  /**
   * WGS84 altitude in metres.
   *
   * Projection helpers require an altitude. Route projection can deliberately
   * fall back to the current camera altitude when route geometry has no Z data.
   */
  readonly altitude?: number
}

export interface GeospatialAnchor {
  readonly anchorId: string
  readonly position: [number, number, number]
  readonly latitude?: number
  readonly longitude?: number
  readonly altitude?: number
  readonly type?: string
}

export interface GeospatialAnchorResult {
  readonly success: boolean
  readonly anchor?: GeospatialAnchor
  readonly error?: string
}

export interface ReactVisionGeospatialNavigator {
  isGeospatialModeSupported(): Promise<{
    supported: boolean
    error?: string
  }>
  isLocationAccuracyReduced(): Promise<{
    reduced: boolean
    error?: string
  }>
  setGeospatialModeEnabled(enabled: boolean): void
  getEarthTrackingState(): Promise<{
    state: string
    error?: string
  }>
  getCameraGeospatialPose(): Promise<{
    success: boolean
    pose?: ViroGeospatialPose
    error?: string
  }>
  checkVPSAvailability(
    latitude: number,
    longitude: number,
  ): Promise<{
    availability: 'Available' | 'Unavailable' | 'Unknown'
    error?: string
  }>
  createGeospatialAnchor(
    latitude: number,
    longitude: number,
    altitude: number,
    quaternion?: ViroQuaternion,
  ): Promise<GeospatialAnchorResult>
  createTerrainAnchor(
    latitude: number,
    longitude: number,
    altitudeAboveTerrain: number,
    quaternion?: ViroQuaternion,
  ): Promise<GeospatialAnchorResult>
  createRooftopAnchor(
    latitude: number,
    longitude: number,
    altitudeAboveRooftop: number,
    quaternion?: ViroQuaternion,
  ): Promise<GeospatialAnchorResult>
  removeGeospatialAnchor(anchorId: string): void
}

export type SpatialAnchorRequest =
  | {
      readonly mode: 'wgs84'
      readonly coordinate: GeoCoordinate & { readonly altitude: number }
      readonly quaternion?: ViroQuaternion
    }
  | {
      readonly mode: 'terrain'
      readonly coordinate: GeoCoordinate
      readonly altitudeAboveSurface?: number
      readonly quaternion?: ViroQuaternion
    }
  | {
      readonly mode: 'rooftop'
      readonly coordinate: GeoCoordinate
      readonly altitudeAboveSurface?: number
      readonly quaternion?: ViroQuaternion
    }

export type GeospatialEnableResult =
  | {
      readonly kind: 'enabled'
    }
  | {
      readonly kind: 'unsupported'
      readonly error?: string
    }
  | {
      readonly kind: 'reduced-location-accuracy'
      readonly error?: string
    }

export type {
  ViroGeospatialPose,
  ViroQuaternion,
}
