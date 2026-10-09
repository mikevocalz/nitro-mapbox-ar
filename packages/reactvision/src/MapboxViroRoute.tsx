import * as React from 'react'
import type { ColorValue } from 'react-native'
import {
  ViroMaterials,
  ViroNode,
  ViroPolyline,
} from '@reactvision/react-viro'

import {
  projectRouteToEnu,
  type EnuPlacement,
  type solveEnuPlacement,
} from './enu'
import { chunkWorldRoute, type RouteProjectionOptions } from './route'
import type { EnuOrigin, GeoCoordinate } from './types'

/**
 * `ViroPolyline` props passed through by {@linkcode MapboxViroRoute}. The
 * component owns `points`, `materials` and `thickness`, so those are left out.
 *
 * @see {@linkcode MapboxViroRouteProps.polylineProps}
 */
export type ForwardedPolylineProps = Omit<
  React.ComponentProps<typeof ViroPolyline>,
  'points' | 'materials' | 'thickness'
>

export interface MapboxViroRouteProps extends RouteProjectionOptions {
  /** Mapbox/Directions route coordinates in WGS84 order. */
  readonly route: readonly GeoCoordinate[]
  /**
   * Fixed WGS84 origin the route is projected from, usually the route start.
   * Keep this object stable: a new origin re-projects every vertex.
   */
  readonly origin: EnuOrigin
  /**
   * Where `origin` sits in the AR world, from {@linkcode solveEnuPlacement}.
   * Updating it moves the route node without rebuilding geometry.
   * @default the AR world origin with no rotation
   */
  readonly placement?: EnuPlacement
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
 * Projects a geographic Mapbox route into the East-North-Up frame of a fixed
 * origin and renders bounded, overlapping ViroPolyline chunks under one node.
 *
 * Geometry depends only on `route` and `origin`, so camera pose updates never
 * rebuild it. Viro 3.0.2 has no JS node that follows a geospatial anchor
 * (`ViroARPlane.anchorId` binds plane anchors only), so the caller places the
 * origin with `placement`, solved from two WGS84 anchors by
 * {@linkcode solveEnuPlacement}, and refreshes it when Earth tracking improves.
 */
export function MapboxViroRoute({
  route,
  origin,
  placement,
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

    const points = projectRouteToEnu(origin, route, {
      fallbackAltitude,
      verticalOffset,
    })

    return chunkWorldRoute(points, maxPoints).filter(
      (chunk) => chunk.length >= 2,
    )
  }, [fallbackAltitude, maxPoints, origin, route, verticalOffset])

  const nodePosition = React.useMemo(
    (): [number, number, number] | undefined =>
      placement
        ? [placement.position[0], placement.position[1], placement.position[2]]
        : undefined,
    [placement],
  )
  const nodeRotation = React.useMemo(
    (): [number, number, number] | undefined =>
      placement
        ? [placement.rotation[0], placement.rotation[1], placement.rotation[2]]
        : undefined,
    [placement],
  )

  if (chunks.length === 0) {
    return null
  }

  return (
    <ViroNode
      position={nodePosition}
      rotation={nodeRotation}
    >
      {chunks.map((chunk, index) => (
        <ViroPolyline
          key={index}
          {...polylineProps}
          points={chunk.map(([x, y, z]) => [x, y, z])}
          thickness={thickness}
          materials={resolvedMaterials}
        />
      ))}
    </ViroNode>
  )
}
