import React, { useEffect, useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  ViroAmbientLight,
  ViroARScene,
  ViroMaterials,
  ViroNode,
  ViroScene,
  ViroSphere,
  ViroXRSceneNavigator,
  isVisionOS,
} from '@reactvision/react-viro'
import { SpatialWindow } from '@metavr/layout-window-compat'
import {
  MapboxViroRoute,
  enuToViroPosition,
  projectRouteToEnu,
  projectToEnu,
  type EnuOrigin,
  type GeoWorldPosition,
  type ReactVisionGeospatialNavigator,
} from '@mikevocalz/nitro-mapbox-ar-reactvision'

import { copy } from '../copy'
import { ActionButton } from '../design/ActionButton'
import { StatusText } from '../design/StatusText'
import { colors, fontSize, spacing } from '../design/tokens'
import { useReferenceStore, type HostState } from '../store'
import { fitRouteToTable } from '../spatial/fitRouteToTable'

/** Table centre relative to where the session started, in metres. */
const TABLE_POSITION: [number, number, number] = [0, -0.4, -1]
/** Half the width of the miniature route on the table. */
const TABLE_RADIUS_M = 0.35
/** Rendered route thickness on the table. */
const TABLE_LINE_M = 0.006
const USER_MARKER = 'tabletop-user-marker'
const ROUTE_DOT = 'tabletop-route-dot'
/** Dots drawn along the route where ViroPolyline cannot render. */
const MAX_ROUTE_DOTS = 64

ViroMaterials.createMaterials({
  [USER_MARKER]: { diffuseColor: colors.userMarker, lightingModel: 'Constant' },
  [ROUTE_DOT]: { diffuseColor: colors.routeLine, lightingModel: 'Constant' },
})

// visionOS rejects ARKit-rooted scenes ("View config not found for component
// VRTARScene") and cannot compile ViroPolyline's GLSL shader modifier, per
// Viro's visionOS setup guide. The headset scene is rooted in ViroScene and
// draws the route as dots. isVisionOS() is needed because Platform.OS reports
// "ios" there.
const ON_VISION_OS = isVisionOS()

interface TabletopSceneProps {
  /**
   * Passed by ViroARSceneNavigator on phones
   * (dist/components/AR/ViroARSceneNavigator.js:1054); the Quest VR
   * navigator passes none.
   */
  readonly arSceneNavigator?: ReactVisionGeospatialNavigator
}

// Viro types the scene factory as `() => JSX.Element` but passes the
// navigator props when it mounts the scene, so the props are optional here.
function TabletopScene({ arSceneNavigator }: TabletopSceneProps = {}) {
  return <TabletopContent arSceneNavigator={arSceneNavigator} rootedInAR />
}

function HeadsetTabletopScene() {
  return <TabletopContent rootedInAR={false} />
}

function TabletopContent({
  arSceneNavigator,
  rootedInAR,
}: TabletopSceneProps & { readonly rootedInAR: boolean }) {
  const Root = rootedInAR ? ViroARScene : ViroScene
  const probeHost = useReferenceStore((state) => state.probeHost)
  const loadTabletopRoute = useReferenceStore((state) => state.loadTabletopRoute)
  const route = useReferenceStore((state) => state.tabletopRoute)
  const host = useReferenceStore((state) => state.host)

  useEffect(() => {
    void probeHost(arSceneNavigator)
  }, [arSceneNavigator, probeHost])

  useEffect(() => {
    void loadTabletopRoute()
  }, [loadTabletopRoute])

  const coordinates = route.status === 'ready' ? route.coordinates : undefined
  const start = coordinates?.[0]

  const origin = useMemo((): EnuOrigin | undefined => {
    if (start === undefined) {
      return undefined
    }
    return {
      frame: { kind: 'route-start', routeId: 'tabletop-trip' },
      latitude: start.latitude,
      longitude: start.longitude,
      altitude: 0,
    }
  }, [start])

  const fit = useMemo(() => {
    if (origin === undefined || coordinates === undefined) {
      return undefined
    }
    return fitRouteToTable(projectRouteToEnu(origin, coordinates), TABLE_RADIUS_M)
  }, [coordinates, origin])

  const pose = host.status === 'ready' && host.placement.kind === 'geospatial'
    ? host.placement.pose
    : undefined

  const userPosition = useMemo((): GeoWorldPosition | undefined => {
    if (pose === undefined || origin === undefined || fit === undefined) {
      return undefined
    }
    const [x, y, z] = enuToViroPosition(
      projectToEnu(origin, {
        latitude: pose.latitude,
        longitude: pose.longitude,
        altitude: origin.altitude,
      }),
    )
    return [
      x * fit.scale + fit.offset[0],
      y * fit.scale + fit.offset[1],
      z * fit.scale + fit.offset[2],
    ]
  }, [fit, origin, pose])

  const routeDots = useMemo((): GeoWorldPosition[] => {
    if (rootedInAR || origin === undefined || coordinates === undefined) {
      return []
    }
    const enu = projectRouteToEnu(origin, coordinates)
    const step = Math.max(1, Math.ceil(enu.length / MAX_ROUTE_DOTS))
    return enu.filter((_, index) => index % step === 0)
  }, [coordinates, origin, rootedInAR])

  return (
    <Root>
      <ViroAmbientLight color={colors.textPrimary} />
      {origin !== undefined && coordinates !== undefined && fit !== undefined ? (
        <ViroNode position={TABLE_POSITION}>
          <ViroNode
            position={[fit.offset[0], fit.offset[1], fit.offset[2]]}
            scale={[fit.scale, fit.scale, fit.scale]}
          >
            {rootedInAR ? (
              <MapboxViroRoute
                route={coordinates}
                origin={origin}
                thickness={TABLE_LINE_M / fit.scale}
              />
            ) : (
              routeDots.map((position, index) => (
                <ViroSphere
                  key={index}
                  position={[position[0], position[1], position[2]]}
                  radius={TABLE_LINE_M / fit.scale}
                  materials={[ROUTE_DOT]}
                />
              ))
            )}
          </ViroNode>
          {userPosition !== undefined ? (
            <ViroSphere
              position={[userPosition[0], userPosition[1], userPosition[2]]}
              radius={0.01}
              materials={[USER_MARKER]}
            />
          ) : null}
        </ViroNode>
      ) : null}
    </Root>
  )
}

function describeHost(host: HostState): string {
  switch (host.status) {
    case 'idle':
    case 'probing':
      return copy.tabletop.probing
    case 'failed':
      return copy.tabletop.probeFailed(host.message)
    case 'ready':
      return host.placement.kind === 'geospatial'
        ? copy.tabletop.geospatial
        : copy.tabletop.tableOnly
  }
}

function QuestPanel({ enter }: { enter: () => void }) {
  const host = useReferenceStore((state) => state.host)
  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>
        {copy.tabletop.title}
      </Text>
      <StatusText text={describeHost(host)} tone={host.status === 'failed' ? 'error' : 'neutral'} />
      <ActionButton label={copy.tabletop.enter} onPress={enter} />
    </View>
  )
}

const tabletopScene = { scene: TabletopScene }
const headsetTabletopScene = { scene: HeadsetTabletopScene }

export interface TabletopScreenProps {
  /**
   * The map shown in a spatial window beside the scene. `undefined` when the
   * native map view is not linked (visionOS).
   */
  readonly map: React.ReactNode | undefined
}

/**
 * Times Square to Brooklyn Bridge as a miniature on a table.
 *
 * The scene is AR-rooted, so it runs over passthrough on Meta Quest and over
 * the camera on phones. The map sits in a `SpatialWindow`: promoted to its
 * own window beside the panel on Quest, inline below the scene elsewhere.
 */
export function TabletopScreen({ map }: TabletopScreenProps) {
  const route = useReferenceStore((state) => state.tabletopRoute)
  const host = useReferenceStore((state) => state.host)

  return (
    <View style={styles.fill}>
      <ViroXRSceneNavigator
        style={styles.fill}
        arInitialScene={tabletopScene}
        // Quest keeps the AR-rooted scene for passthrough; visionOS needs ViroScene.
        vrInitialScene={ON_VISION_OS ? headsetTabletopScene : tabletopScene}
        visionOSImmersionStyle="mixed"
        renderQuestPanel={(enter) => <QuestPanel enter={enter} />}
      />
      <StatusText
        text={route.status === 'failed' ? copy.tabletop.routeFailed(route.message) : describeHost(host)}
        tone={route.status === 'failed' || host.status === 'failed' ? 'error' : 'neutral'}
        style={styles.status}
      />
      {map === undefined ? (
        <Text style={styles.status}>{copy.tabletop.mapUnavailable}</Text>
      ) : (
        <SpatialWindow
          label="tabletop-map"
          windowWidth={960}
          windowHeight={640}
          anchor="end"
          fallback="inline"
        >
          <View style={styles.map}>{map}</View>
        </SpatialWindow>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  map: { height: 280 },
  panel: { flex: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg },
  title: { color: colors.textPrimary, fontSize: fontSize.title, fontWeight: '700' },
  status: { color: colors.textMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
})
