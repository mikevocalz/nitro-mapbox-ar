import * as React from 'react'
import type { ColorValue } from 'react-native'
import { ViroGeometry, ViroMaterials } from '@reactvision/react-viro'

import type { BuildingMesh, extrudeBuildings } from './buildings'

type ViroGeometryProps = React.ComponentProps<typeof ViroGeometry>

/** Props for {@linkcode MapboxViroBuildings}. */
export interface MapboxViroBuildingsProps {
  /** One tile's buildings, from {@linkcode extrudeBuildings}. */
  readonly mesh: BuildingMesh
  /**
   * Fill colour when no `materials` are given. The component then owns a
   * Lambert material, which needs a light in the scene (for example a
   * `ViroAmbientLight` plus a `ViroDirectionalLight`) or the walls render black.
   * @default '#8A8378'
   */
  readonly color?: ColorValue
  /** Pre-registered Viro material name(s). Takes precedence over `color`. */
  readonly materials?: string | string[]
  /** Forwarded to the geometry, for example `onClick` for ground teleport. */
  readonly geometryProps?: Omit<
    ViroGeometryProps,
    'vertices' | 'normals' | 'triangleIndices' | 'texcoords' | 'materials'
  >
}

function materialSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '')
}

/**
 * Renders one tile of extruded buildings as a single `ViroGeometry` (one draw
 * call). Place it under the node that holds the mesh's {@linkcode EnuOrigin}
 * content, next to `MapboxViroRoute`.
 *
 * The native props are rebuilt only when `mesh` changes, so cache meshes per
 * tile and origin rather than re-extruding on every render.
 */
export function MapboxViroBuildings({
  mesh,
  color = '#8A8378',
  materials,
  geometryProps,
}: MapboxViroBuildingsProps): React.JSX.Element | null {
  const reactId = React.useId()
  const generatedMaterialName = React.useMemo(
    () => `mapbox-viro-buildings-${materialSafeId(reactId)}`,
    [reactId],
  )
  const ownsMaterial = materials === undefined

  React.useEffect(() => {
    if (!ownsMaterial) return
    ViroMaterials.createMaterials({
      [generatedMaterialName]: { diffuseColor: color, lightingModel: 'Lambert' },
    })
    return () => {
      ViroMaterials.deleteMaterials([generatedMaterialName])
    }
  }, [color, generatedMaterialName, ownsMaterial])

  const native = React.useMemo(() => {
    const vertices: [number, number, number][] = []
    const normals: [number, number, number][] = []
    // One texcoord per vertex: VRTGeometry always uploads a texcoord source
    // (~/virocore/ViroRenderer/capi/Geometry_JNI.cpp:182-203), and an empty
    // one would be shorter than the position source.
    const texcoords: [number, number][] = []
    for (let i = 0; i < mesh.positions.length; i += 3) {
      vertices.push([mesh.positions[i]!, mesh.positions[i + 1]!, mesh.positions[i + 2]!])
      normals.push([mesh.normals[i]!, mesh.normals[i + 1]!, mesh.normals[i + 2]!])
      texcoords.push([0, 0])
    }
    // The native prop is one flat index list per submesh
    // (~/viro/android/viro_bridge/.../VRTGeometryManager.java:101-118 reads
    // each entry as a list of ints), although ViroGeometry.tsx types it as
    // Viro3DPoint[]. One submesh, one material.
    const triangleIndices = [Array.from(mesh.indices)] as unknown as ViroGeometryProps['triangleIndices']
    return { vertices, normals, texcoords, triangleIndices }
  }, [mesh])

  if (mesh.indices.length === 0) return null

  return (
    <ViroGeometry
      {...geometryProps}
      vertices={native.vertices}
      normals={native.normals}
      texcoords={native.texcoords}
      triangleIndices={native.triangleIndices}
      materials={materials ?? generatedMaterialName}
    />
  )
}
