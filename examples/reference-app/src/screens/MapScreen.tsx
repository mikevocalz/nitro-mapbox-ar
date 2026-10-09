import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { callback } from 'react-native-nitro-modules'
import { MapboxAR } from '@mikevocalz/nitro-mapbox-ar'
import { MapboxMaps, MapboxMapView } from '@mikevocalz/nitro-mapbox-ar-maps'

import { copy } from '../copy'
import { StatusText } from '../design/StatusText'
import { colors, fontSize, radius, spacing } from '../design/tokens'
import { MAP_STYLE_URI, useMapScreenStore } from '../mapStore'
import { TIMES_SQUARE, token } from '../services'

// The map reads the process-wide token when it creates its native view.
MapboxAR.accessToken = token

/** Mapbox Standard Satellite over Times Square with 3D terrain and one marker. */
export function MapScreen() {
  const status = useMapScreenStore((state) => state.map)
  const lastTap = useMapScreenStore((state) => state.lastTap)
  const attach = useMapScreenStore((state) => state.attach)
  const detach = useMapScreenStore((state) => state.detach)

  useEffect(() => detach, [detach])

  if (!MapboxMaps.isMapViewAvailable) {
    // visionOS: the maps pod builds without the Mapbox Maps SDK.
    return (
      <View style={styles.center}>
        <Text style={styles.copy}>{copy.map.unavailable}</Text>
      </View>
    )
  }

  if (token === '') {
    return (
      <View style={styles.center}>
        <Text style={styles.copy}>{copy.map.missingToken}</Text>
      </View>
    )
  }

  const statusText =
    status.status === 'failed'
      ? copy.map.failed(status.message)
      : status.status === 'loading'
        ? copy.map.loading
        : lastTap === undefined
          ? copy.map.ready
          : copy.map.tapped(lastTap.coordinate.latitude, lastTap.coordinate.longitude)

  return (
    <View style={styles.fill}>
      <MapboxMapView
        style={styles.fill}
        styleUri={MAP_STYLE_URI}
        camera={{ center: TIMES_SQUARE, zoom: 14, bearingDeg: 0, pitchDeg: 55 }}
        projection="globe"
        hybridRef={callback(attach)}
      />
      {/* The scrim keeps the status readable over any imagery. */}
      <View pointerEvents="none" style={styles.statusBar}>
        {status.status === 'loading' ? (
          <ActivityIndicator accessibilityLabel={copy.map.loading} color={colors.textPrimary} />
        ) : null}
        <StatusText
          text={statusText}
          tone={status.status === 'failed' ? 'error' : 'neutral'}
          style={styles.status}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  copy: { color: colors.textBody, fontSize: fontSize.body },
  statusBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.control,
    backgroundColor: colors.scrim,
  },
  status: { flexShrink: 1, fontSize: fontSize.caption },
})
