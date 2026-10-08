import * as React from 'react'
import { ViroMaterials, ViroNode, ViroQuad } from '@reactvision/react-viro'

import { groundTileQuad, type GroundTileQuad, type tilesAroundEnuPoint } from './ground'
import type { XyzTile } from './tile'
import type { EnuOrigin } from './types'

type ViroQuadProps = React.ComponentProps<typeof ViroQuad>

/** Props for {@linkcode MapboxViroGround}. */
export interface MapboxViroGroundProps {
  /** Fixed WGS84 origin; keep the object stable across renders. */
  readonly origin: EnuOrigin
  /** Tiles to lay down, for example from {@linkcode tilesAroundEnuPoint}. */
  readonly tiles: readonly XyzTile[]
  /**
   * The image URL of a tile, for example `MapboxRasterClient.satelliteTileUrl`
   * from `@mapbox/react-native-mapbox-ar/mapbox`. Viro's native image loader
   * fetches and caches it.
   */
  readonly tileUrl: (tile: XyzTile) => string
  /**
   * Height of the imagery above y = 0, in metres. A small lift keeps it above
   * a base ground quad without z-fighting.
   * @default 0
   */
  readonly liftM?: number
  /** Forwarded to every tile quad, for example `onClick` for ground teleport. */
  readonly quadProps?: Omit<ViroQuadProps, 'position' | 'rotation' | 'width' | 'height' | 'materials'>
}

function materialName(instance: string, key: string): string {
  return `mapbox-viro-ground-${instance.replace(/[^a-zA-Z0-9_-]/g, '')}-${key.replace(/\//g, '-')}`
}

function GroundTile({
  instance,
  quad,
  url,
  liftM,
  quadProps,
}: {
  instance: string
  quad: GroundTileQuad
  url: string
  liftM: number
  quadProps: MapboxViroGroundProps['quadProps']
}): React.JSX.Element | null {
  const name = materialName(instance, quad.key)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    ViroMaterials.createMaterials({
      [name]: {
        // Viro mipmaps image textures by default
        // (~/viro/android/viro_bridge/.../MaterialManager.java:820-828).
        diffuseTexture: { uri: url },
        lightingModel: 'Constant',
      },
    })
    setReady(true)
    return () => {
      setReady(false)
      ViroMaterials.deleteMaterials([name])
    }
  }, [name, url])

  if (!ready) return null
  return (
    <ViroQuad
      {...quadProps}
      position={[quad.position[0], liftM, quad.position[2]]}
      rotation={[-90, 0, 0]}
      width={quad.widthM}
      height={quad.depthM}
      materials={[name]}
    />
  )
}

/**
 * Lays map tiles (Mapbox Satellite, or any XYZ raster) flat on the ground of
 * an {@linkcode EnuOrigin}, one `ViroQuad` per tile with north up. Each tile
 * owns a Viro material named after its `z/x/y` key, created when the tile
 * appears and deleted when it leaves `tiles`, so the set can follow the
 * wearer without reloading tiles that stay.
 */
export function MapboxViroGround({
  origin,
  tiles,
  tileUrl,
  liftM = 0,
  quadProps,
}: MapboxViroGroundProps): React.JSX.Element | null {
  const instance = React.useId()
  const quads = React.useMemo(
    () => tiles.map((tile) => groundTileQuad(origin, tile)),
    [origin, tiles],
  )
  if (quads.length === 0) return null
  return (
    <ViroNode>
      {quads.map((quad) => (
        <GroundTile
          key={quad.key}
          instance={instance}
          quad={quad}
          url={tileUrl(quad.tile)}
          liftM={liftM}
          quadProps={quadProps}
        />
      ))}
    </ViroNode>
  )
}
