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

/**
 * The named WGS84 point an {@linkcode EnuOffset} is measured from. Matches the
 * frame shape of `EnuOffset` in `@viro-external/xr-contract`.
 *
 * @see {@linkcode EnuOrigin.frame}
 */
export type EnuFrame =
  | { readonly kind: 'place'; readonly placeId: string }
  | { readonly kind: 'route-start'; readonly routeId: string }

/**
 * A fixed WGS84 origin for local East-North-Up projection. Content projected
 * from it stays put while the camera moves; only the origin's placement in the
 * AR world needs updating.
 *
 * @see `projectToEnu` in `enu.ts`
 */
export interface EnuOrigin {
  /** Which place or route this origin belongs to. */
  readonly frame: EnuFrame
  /** Latitude in degrees. */
  readonly latitude: number
  /** Longitude in degrees. */
  readonly longitude: number
  /** Metres above the WGS84 ellipsoid (what ARCore Geospatial reports). */
  readonly altitude: number
}

/**
 * Local East-North-Up offset in metres from an {@linkcode EnuOrigin}.
 * Structurally identical to `EnuOffset` in `@viro-external/xr-contract`.
 *
 * @see `projectToEnu` in `enu.ts`
 */
export interface EnuOffset {
  /** The origin frame the offset is measured in. */
  readonly frame: EnuFrame
  /** Metres east of the origin. */
  readonly eastM: number
  /** Metres north of the origin. */
  readonly northM: number
  /** Metres above the origin's tangent plane. */
  readonly upM: number
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
