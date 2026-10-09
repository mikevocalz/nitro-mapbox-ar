import React, { useEffect, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  ViroAmbientLight,
  ViroARScene,
  ViroMaterials,
  ViroNode,
  ViroSphere,
  ViroXRSceneNavigator,
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

import { useReferenceStore, type HostState } from '../store'
import { fitRouteToTable } from '../spatial/fitRouteToTable'

/** Table centre relative to where the session started, in metres. */
const TABLE_POSITION: [number, number, number] = [0, -0.4, -1]
/** Half the width of the miniature route on the table. */
const TABLE_RADIUS_M = 0.35
/** Rendered route thickness on the table. */
const TABLE_LINE_M = 0.006
const USER_MARKER = 'tabletop-user-marker'

ViroMaterials.createMaterials({
  [USER_MARKER]: { diffuseColor: '#f97316', lightingModel: 'Constant' },
})

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

  return (
    <ViroARScene>
      <ViroAmbientLight color="#ffffff" />
      {origin !== undefined && coordinates !== undefined && fit !== undefined ? (
        <ViroNode position={TABLE_POSITION}>
          <ViroNode
            position={[fit.offset[0], fit.offset[1], fit.offset[2]]}
            scale={[fit.scale, fit.scale, fit.scale]}
          >
            <MapboxViroRoute
              route={coordinates}
              origin={origin}
              thickness={TABLE_LINE_M / fit.scale}
            />
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
    </ViroARScene>
  )
}

function describeHost(host: HostState): string {
  switch (host.status) {
    case 'idle':
    case 'probing':
      return 'Reading host capabilities…'
    case 'failed':
      return `Host probe failed: ${host.message}`
    case 'ready':
      return host.placement.kind === 'geospatial'
        ? 'Route on the table, with your position from geospatial tracking.'
        : 'Route on the table. This host has no device location, so no position is shown.'
  }
}

function QuestPanel({ enter }: { enter: () => void }) {
  const host = useReferenceStore((state) => state.host)
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Tabletop route</Text>
      <Text style={styles.copy}>{describeHost(host)}</Text>
      <Pressable style={styles.action} onPress={enter}>
        <Text style={styles.actionText}>Enter immersive view</Text>
      </Pressable>
    </View>
  )
}

const tabletopScene = { scene: TabletopScene }

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
        initialScene={tabletopScene}
        renderQuestPanel={(enter) => <QuestPanel enter={enter} />}
      />
      <Text style={styles.status}>
        {route.status === 'failed' ? `Route failed: ${route.message}` : describeHost(host)}
      </Text>
      {map === undefined ? (
        <Text style={styles.status}>The Mapbox map view is not available on this device.</Text>
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
  panel: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  title: { color: 'white', fontSize: 26, fontWeight: '700' },
  copy: { color: '#d4d8df', fontSize: 16 },
  status: { color: '#aab2c0', paddingHorizontal: 16, paddingVertical: 8 },
  action: { padding: 14, borderRadius: 12, backgroundColor: '#2563eb' },
  actionText: { color: 'white', textAlign: 'center', fontWeight: '700' },
})
