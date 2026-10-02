import * as React from 'react'
import type { ColorValue } from 'react-native'
import {
  ViroMaterials,
  ViroPolyline,
  gpsToArWorld,
} from '@reactvision/react-viro'

import {
  chunkWorldRoute,
  projectRouteToWorld,
  type RouteProjectionOptions,
} from './route'
import type { GeoCoordinate, ViroGeospatialPose } from './types'

type ViroPolylineProps = React.ComponentProps<typeof ViroPolyline>
type ForwardedPolylineProps = Omit<
  ViroPolylineProps,
  'points' | 'materials' | 'thickness'
>

export interface MapboxViroRouteProps extends RouteProjectionOptions {
  /** Mapbox/Directions route coordinates in WGS84 order. */
  readonly route: readonly GeoCoordinate[]
  /** Current ReactVision geospatial camera pose used as the AR projection origin. */
  readonly pose: ViroGeospatialPose
  /** Maximum points per native ViroPolyline. Adjacent chunks overlap by one point. */
  readonly maxPoints?: number
  /** Polyline thickness in metres. */
  readonly thickness?: number
  /** Convenience color used when no pre-registered material is supplied. */
  readonly color?: ColorValue
  /** Name of a pre-registered Viro material. */
  readonly materialName?: string
  /** Pre-registered Viro material name(s). Takes precedence over materialName/color. */
  readonly materials?: string | string[]
  /** Additional ViroPolyline props applied to every generated route chunk. */
  readonly polylineProps?: ForwardedPolylineProps
}

function materialSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '')
}

/**
 * Projects a geographic Mapbox route into ReactVision world space and renders
 * bounded, overlapping ViroPolyline chunks.
 *
 * The component deliberately does not create geospatial anchors for every
 * route vertex. Persistent POIs should use Terrain/WGS84/Rooftop anchors;
 * route ribbons stay lightweight and are re-projected from the current pose.
 */
export function MapboxViroRoute({
  route,
  pose,
  maxPoints = 128,
  thickness = 0.06,
  color = '#00E5FF',
  materialName,
  materials,
  polylineProps,
  fallbackAltitude,
  verticalOffset,
}: MapboxViroRouteProps): React.JSX.Element | null {
  const reactId = React.useId()
  const generatedMaterialName = React.useMemo(
    () => `mapbox-viro-route-${materialSafeId(reactId)}`,
    [reactId],
  )

  const ownsMaterial = materials === undefined && materialName === undefined
  const resolvedMaterials =
    materials ?? materialName ?? generatedMaterialName

  React.useEffect(() => {
    if (!ownsMaterial) {
      return
    }

    ViroMaterials.createMaterials({
      [generatedMaterialName]: {
        diffuseColor: color,
        lightingModel: 'Constant',
      },
    })

    return () => {
      ViroMaterials.deleteMaterials([generatedMaterialName])
    }
  }, [color, generatedMaterialName, ownsMaterial])

  const chunks = React.useMemo(() => {
    if (route.length < 2) {
      return []
    }

    const points = projectRouteToWorld(gpsToArWorld, pose, route, {
      fallbackAltitude,
      verticalOffset,
    })

    return chunkWorldRoute(points, maxPoints).filter(
      (chunk) => chunk.length >= 2,
    )
  }, [fallbackAltitude, maxPoints, pose, route, verticalOffset])

  if (chunks.length === 0) {
    return null
  }

  return (
    <>
      {chunks.map((chunk, index) => (
        <ViroPolyline
          key={index}
          {...polylineProps}
          points={chunk.map(([x, y, z]) => [x, y, z])}
          thickness={thickness}
          materials={resolvedMaterials}
        />
      ))}
    </>
  )
}
