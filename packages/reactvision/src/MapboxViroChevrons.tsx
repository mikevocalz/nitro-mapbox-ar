import * as React from 'react'
import type { ColorValue } from 'react-native'
import { ViroMaterials, ViroNode, ViroPolygon } from '@reactvision/react-viro'

import {
  layoutRouteChevrons,
  type RouteChevron,
  type RouteChevronLayoutOptions,
} from './chevrons'
import type { EnuPlacement } from './enu'
import type { GeoWorldPosition } from './types'

export interface MapboxViroChevronsProps extends RouteChevronLayoutOptions {
  /**
   * Route points in node-local Viro axes, from `projectRouteToEnu`. Keep the
   * array stable per route version; a new array re-runs the layout.
   */
  readonly points: readonly GeoWorldPosition[]
  /**
   * Where the route's ENU origin sits in the AR world, from
   * `solveEnuPlacement` or `solveCompassPlacement`. Use the same value as the
   * route node so chevrons and line stay together.
   * @default the AR world origin with no rotation
   */
  readonly placement?: EnuPlacement
  /** Chevron width across the path, in metres. @default 0.5 */
  readonly widthM?: number
  /** Chevron length along the path, in metres. @default 0.35 */
  readonly lengthM?: number
  /** Arm thickness, in metres. @default 0.1 */
  readonly thicknessM?: number
  /** Height above the route points, so chevrons do not z-fight the ground. @default 0.02 */
  readonly heightOffsetM?: number
  /** Convenience colour used when no pre-registered material is supplied. @default '#FFFFFF' */
  readonly color?: ColorValue
  /** Pre-registered Viro material name(s). Takes precedence over `color`. */
  readonly materials?: string | string[]
  /**
   * Custom content for each chevron, rendered inside a node that is already
   * positioned and yawed; author it pointing at −z on the ground plane.
   * Replaces the default flat chevron.
   */
  readonly renderChevron?: (chevron: RouteChevron, index: number) => React.ReactNode
}

function materialSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '')
}

/** Flat chevron outline in the XY plane, tip at +y, centred on the origin. */
function chevronVertices(
  widthM: number,
  lengthM: number,
  thicknessM: number,
): [number, number][] {
  const w = widthM / 2
  const h = lengthM / 2
  const t = Math.min(thicknessM, lengthM * 0.9)
  return [
    [0, h],
    [-w, -h + t],
    [-w, -h],
    [0, h - t],
    [w, -h],
    [w, -h + t],
  ]
}

/**
 * Ground chevrons along a projected route, from the user's matched position
 * toward the next manoeuvre. Layout comes from {@linkcode layoutRouteChevrons}:
 * chevrons are world fixed, sit only on route geometry, and face the route
 * direction where they stand (Viro yaw `[0, −bearing, 0]`).
 *
 * Only the chevrons near the user change as `fromAlongTrackM` advances;
 * `placement` moves the parent node without re-running the layout.
 */
export function MapboxViroChevrons({
  points,
  placement,
  widthM = 0.5,
  lengthM = 0.35,
  thicknessM = 0.1,
  heightOffsetM = 0.02,
  color = '#FFFFFF',
  materials,
  renderChevron,
  fromAlongTrackM,
  startOffsetM,
  lookaheadM,
  stopAlongTrackM,
  spacingM,
  maxCount,
  fadeCount,
}: MapboxViroChevronsProps): React.JSX.Element | null {
  const reactId = React.useId()
  const generatedMaterialName = React.useMemo(
    () => `mapbox-viro-chevron-${materialSafeId(reactId)}`,
    [reactId],
  )
  const ownsMaterial = materials === undefined && renderChevron === undefined
  const resolvedMaterials = materials ?? generatedMaterialName

  React.useEffect(() => {
    if (!ownsMaterial) return
    ViroMaterials.createMaterials({
      [generatedMaterialName]: {
        diffuseColor: color,
        lightingModel: 'Constant',
        cullMode: 'None',
      },
    })
    return () => {
      ViroMaterials.deleteMaterials([generatedMaterialName])
    }
  }, [color, generatedMaterialName, ownsMaterial])

  const chevrons = React.useMemo(
    () =>
      points.length < 2
        ? []
        : layoutRouteChevrons(points, {
            fromAlongTrackM,
            startOffsetM,
            lookaheadM,
            stopAlongTrackM,
            spacingM,
            maxCount,
            fadeCount,
          }),
    [fadeCount, fromAlongTrackM, lookaheadM, maxCount, points, spacingM, startOffsetM, stopAlongTrackM],
  )
  const vertices = React.useMemo(
    () => chevronVertices(widthM, lengthM, thicknessM),
    [lengthM, thicknessM, widthM],
  )

  if (chevrons.length === 0) return null

  return (
    <ViroNode
      position={placement ? [placement.position[0], placement.position[1], placement.position[2]] : undefined}
      rotation={placement ? [placement.rotation[0], placement.rotation[1], placement.rotation[2]] : undefined}
    >
      {chevrons.map((chevron, index) => (
        <ViroNode
          key={chevron.alongTrackM}
          position={[chevron.position[0], chevron.position[1] + heightOffsetM, chevron.position[2]]}
          rotation={[0, chevron.rotation[1], 0]}
          opacity={chevron.opacity}
        >
          {renderChevron ? (
            renderChevron(chevron, index)
          ) : (
            <ViroPolygon
              vertices={vertices}
              holes={[]}
              rotation={[-90, 0, 0]}
              materials={resolvedMaterials}
            />
          )}
        </ViroNode>
      ))}
    </ViroNode>
  )
}
