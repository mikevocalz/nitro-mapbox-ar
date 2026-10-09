import type { ViroGeospatialPose } from '@reactvision/react-viro'

import { projectToDeviceFrame } from './enu'

import {
  validateCoordinate,
  validateSurfaceOffset,
} from './geo'
import {
  chunkWorldRoute,
  projectRouteToWorld,
  type RouteProjectionOptions,
} from './route'
import type {
  GeoCoordinate,
  GeoWorldPosition,
  GeospatialAnchorResult,
  GeospatialEnableResult,
  ReactVisionGeospatialNavigator,
  SpatialAnchorRequest,
} from './types'

export interface ReactVisionSpatialBridge {
  enableGeospatial(): Promise<GeospatialEnableResult>
  disableGeospatial(): void
  getCameraPose(): Promise<ViroGeospatialPose>
  checkVps(
    coordinate: Pick<GeoCoordinate, 'latitude' | 'longitude'>,
  ): ReturnType<ReactVisionGeospatialNavigator['checkVPSAvailability']>
  projectCoordinate(
    pose: ViroGeospatialPose,
    coordinate: GeoCoordinate & { readonly altitude: number },
  ): GeoWorldPosition
  projectRoute(
    pose: ViroGeospatialPose,
    route: readonly GeoCoordinate[],
    options?: RouteProjectionOptions,
  ): GeoWorldPosition[]
  projectRouteChunks(
    pose: ViroGeospatialPose,
    route: readonly GeoCoordinate[],
    options?: RouteProjectionOptions & { readonly maxPoints?: number },
  ): GeoWorldPosition[][]
  createAnchor(request: SpatialAnchorRequest): Promise<GeospatialAnchorResult>
  removeAnchor(anchorId: string): void
}

export function createReactVisionSpatialBridge(
  navigator: ReactVisionGeospatialNavigator,
): ReactVisionSpatialBridge {
  return {
    async enableGeospatial() {
      const support = await navigator.isGeospatialModeSupported()
      if (!support.supported) {
        return {
          kind: 'unsupported',
          error: support.error,
        }
      }

      const accuracy = await navigator.isLocationAccuracyReduced()
      if (accuracy.reduced) {
        return {
          kind: 'reduced-location-accuracy',
          error: accuracy.error,
        }
      }

      navigator.setGeospatialModeEnabled(true)
      return { kind: 'enabled' }
    },

    disableGeospatial() {
      navigator.setGeospatialModeEnabled(false)
    },

    async getCameraPose() {
      const result = await navigator.getCameraGeospatialPose()
      if (!result.success || !result.pose) {
        throw new Error(
          result.error ?? 'ReactVision did not return a geospatial camera pose',
        )
      }
      return result.pose
    },

    checkVps(coordinate) {
      validateCoordinate(coordinate)
      return navigator.checkVPSAvailability(
        coordinate.latitude,
        coordinate.longitude,
      )
    },

    projectCoordinate(pose, coordinate) {
      validateCoordinate(coordinate, { requireAltitude: true })
      return projectToDeviceFrame(
        pose,
        coordinate.latitude,
        coordinate.longitude,
        coordinate.altitude,
      )
    },

    projectRoute(pose, route, options) {
      return projectRouteToWorld(projectToDeviceFrame, pose, route, options)
    },

    projectRouteChunks(pose, route, options = {}) {
      const points = projectRouteToWorld(
        projectToDeviceFrame,
        pose,
        route,
        options,
      )
      return chunkWorldRoute(points, options.maxPoints)
    },

    createAnchor(request) {
      validateCoordinate(request.coordinate)

      switch (request.mode) {
        case 'wgs84':
          return navigator.createGeospatialAnchor(
            request.coordinate.latitude,
            request.coordinate.longitude,
            request.coordinate.altitude,
            request.quaternion,
          )

        case 'terrain':
          return navigator.createTerrainAnchor(
            request.coordinate.latitude,
            request.coordinate.longitude,
            validateSurfaceOffset(request.altitudeAboveSurface),
            request.quaternion,
          )

        case 'rooftop':
          return navigator.createRooftopAnchor(
            request.coordinate.latitude,
            request.coordinate.longitude,
            validateSurfaceOffset(request.altitudeAboveSurface),
            request.quaternion,
          )
      }
    },

    removeAnchor(anchorId) {
      if (anchorId.trim().length === 0) {
        throw new Error('anchorId cannot be empty')
      }
      navigator.removeGeospatialAnchor(anchorId)
    },
  }
}
